/**
 * SQLite → PostgreSQL 資料搬移（DB-PG-001 Phase 1，Prompt P2）
 * ────────────────────────────────────────────────────────────
 * 前提：PG 端的全新 schema 已經用 `payload migrate`（走 src/migrations-pg）
 * 建好（見 payload.config.ts 的 postgresAdapter migrationDir 設定）。這支
 * 腳本只搬「資料列」，不碰 schema。
 *
 * 刻意繞過 Payload Local API（不用 payload.create()）——用 Local API 建單/建列
 * 會觸發每個 collection 的 hooks（發信、觸發行銷旅程、庫存重算…），對搬移
 * 幾萬筆歷史資料來說是災難。這裡直接用 SQL 對資料庫層搬，不經過任何
 * application-level 業務邏輯。
 *
 * FK 依賴排序：用 `session_replication_role = replica` 整段停用 FK/trigger
 * 檢查（Prompt P2 允許的替代方案），搬完再打開，省掉手動算 287 張表的
 * 拓樸排序。
 *
 * 型別轉換：
 *   - boolean 欄位：SQLite 存 0/1 integer，PG 是真的 boolean，依 PG
 *     information_schema 的欄位型別決定要不要轉換。
 *   - jsonb 欄位：SQLite 存 JSON 字串（TEXT），要 JSON.parse() 過再交給 pg
 *     driver（driver 會自己把 JS 物件序列化成 jsonb，不能整段字串塞進去，
 *     否則變成「jsonb 欄位裡存了一個 JSON 字串」的雙重序列化）。
 *   - 其餘型別（number/text/timestamp）：SQLite 存的值可以直接餵給 pg。
 *
 * 用法：
 *   DATABASE_URI_PG_REHEARSAL 需已在 .env 設好（見 payload.config.ts 旁的
 *   .env.example 說明）。
 *
 *   MIGRATE_DRY_RUN=1 pnpm payload run scripts/migrate-sqlite-to-pg.ts   # 只列計畫不寫
 *   MIGRATE_DRY_RUN=0 pnpm payload run scripts/migrate-sqlite-to-pg.ts   # 實際搬
 *   MIGRATE_TRUNCATE_FIRST=1 ...                                        # 搬之前先清空PG各表（演練重跑用，正式cutover不可用）
 *
 * DoD 對帳：跑完印出每表 SQLite count vs PG count，不一致的表另外彙總在
 * 最後印出（不會中途中止，讓你一次看到所有落差，而不是抓到第一個就停）。
 */
import { createRequire } from 'node:module'
import { createClient } from '@libsql/client'

const require = createRequire(import.meta.url)
// 走 @payloadcms/db-postgres 自己的 node_modules 解析找 pg，不用 pnpm 的
// 版本 hash 目錄硬編路徑（版本一改路徑就斷），也不需要把 pg 加進
// package.json（避免動到已有未提交 WIP 的 package.json/pnpm-lock.yaml）。
// pg 沒有安裝進本專案 package.json（避免動到已有未提交 WIP 的
// package.json/pnpm-lock.yaml），這裡動態解析+require，型別上用 any——
// 這是一次性操作腳本，不是應用程式碼，務實優先不追求嚴格型別。
const pgModulePath = require.resolve('pg', { paths: [require.resolve('@payloadcms/db-postgres')] })
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgModule = require(pgModulePath) as { Client: new (config: { connectionString: string }) => PgClientType }

interface PgClientType {
  connect(): Promise<void>
  end(): Promise<void>
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>
}
const PgClient = pgModule.Client

const DRY_RUN = process.env.MIGRATE_DRY_RUN !== '0'
const TRUNCATE_FIRST = process.env.MIGRATE_TRUNCATE_FIRST === '1'

const SQLITE_PATH = (process.env.DATABASE_URI || 'file:./data/chickimmiu.db').replace(/^file:/, '')
const PG_URI = process.env.DATABASE_URI_PG_REHEARSAL
if (!PG_URI) {
  console.error('缺 DATABASE_URI_PG_REHEARSAL，先在 .env 設好演練用的 PG 連線字串')
  process.exit(1)
}

type ColumnMeta = { name: string; udtName: string; dataType: string }

async function main() {
  console.log(`[migrate] DRY_RUN=${DRY_RUN} TRUNCATE_FIRST=${TRUNCATE_FIRST}`)
  console.log(`[migrate] SQLite: ${SQLITE_PATH}`)

  const sqlite = createClient({ url: `file:${SQLITE_PATH}` })
  const pg = new PgClient({ connectionString: PG_URI as string })
  await pg.connect()

  try {
    // ── 1. 取 PG 端的表清單（權威——由 payload migrate 產生的 schema 決定要搬哪些表）──
    const pgTablesRes = await pg.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
    )
    const pgTables = pgTablesRes.rows.map((r) => r.table_name)

    // ── 2. 取 SQLite 端表清單，找出 SQLite 有但 PG 沒有的表（已知案例：
    //      hasMany select 在 PG 端變成 array 欄位而非獨立表，如
    //      mkt_fest_channels——0 筆資料可以安全跳過，非 0 筆要中止人工檢查）──
    const sqliteTablesRes = await sqlite.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    )
    const sqliteTableNames = new Set(sqliteTablesRes.rows.map((r) => String(r.name)))
    const pgTableSet = new Set(pgTables)
    const sqliteOnlyTables = [...sqliteTableNames].filter((t) => !pgTableSet.has(t))

    for (const t of sqliteOnlyTables) {
      const cnt = await sqlite.execute(`SELECT COUNT(*) as c FROM "${t}"`)
      const rowCount = Number(cnt.rows[0]?.c ?? 0)
      if (rowCount > 0) {
        console.error(
          `[migrate] 中止：SQLite 表 "${t}" 在 PG 端找不到對應表，但有 ${rowCount} 筆資料——` +
            `需要人工確認這是 hasMany-select 的 array 欄位轉換（安全）還是真的漏了 schema（不安全），` +
            `不自動跳過非 0 筆的表。`,
        )
        process.exit(1)
      }
      console.log(`[migrate] 跳過 "${t}"（PG 無對應表，SQLite 端 0 筆，屬已知 hasMany-select→array 欄位轉換）`)
    }

    // ── 3. 停用 FK/trigger 檢查（省掉手動拓樸排序）──
    if (!DRY_RUN) {
      await pg.query(`SET session_replication_role = replica`)
    }

    const reconciliation: { table: string; sqlite: number; pg: number; ok: boolean }[] = []

    for (const table of pgTables) {
      if (!sqliteTableNames.has(table)) {
        // PG 有但 SQLite 沒有：不該發生（PG schema 是從同一套 collection 定義生的），
        // 記錄但不中止，最後對帳表會顯示 sqlite=0。
        reconciliation.push({ table, sqlite: 0, pg: 0, ok: true })
        continue
      }

      const sqliteRowsRes = await sqlite.execute(`SELECT * FROM "${table}"`)
      const sqliteRows = sqliteRowsRes.rows
      const sqliteColumns = sqliteRowsRes.columns

      if (sqliteRows.length === 0) {
        reconciliation.push({ table, sqlite: 0, pg: 0, ok: true })
        continue
      }

      // 取 PG 該表欄位型別，決定 boolean / jsonb 轉換
      const colsRes = await pg.query<ColumnMeta>(
        `SELECT column_name as name, udt_name as "udtName", data_type as "dataType"
         FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
        [table],
      )
      const colMeta = new Map(colsRes.rows.map((c) => [c.name, c]))

      // 只搬 PG 端也真的有的欄位（理論上兩邊欄位集合一致，防禦性交集）
      const columns = sqliteColumns.filter((c) => colMeta.has(c))
      if (columns.length === 0) {
        reconciliation.push({ table, sqlite: sqliteRows.length, pg: 0, ok: false })
        continue
      }

      if (TRUNCATE_FIRST && !DRY_RUN) {
        await pg.query(`TRUNCATE TABLE "${table}" CASCADE`)
      }

      if (!DRY_RUN) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
        const colList = columns.map((c) => `"${c}"`).join(', ')
        const insertSql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`

        for (const row of sqliteRows) {
          const values = columns.map((col) => {
            const raw = (row as unknown as Record<string, unknown>)[col]
            const meta = colMeta.get(col)
            if (raw === null || raw === undefined) return null
            if (meta?.dataType === 'boolean') {
              return raw === 1 || raw === '1' || raw === true
            }
            if (meta?.udtName === 'jsonb' || meta?.udtName === 'json') {
              if (typeof raw === 'string') {
                try {
                  return JSON.parse(raw)
                } catch {
                  return raw // 不是合法 JSON 字串就原樣塞（極少數欄位可能本來就是 plain text）
                }
              }
              return raw
            }
            return raw
          })
          try {
            await pg.query(insertSql, values)
          } catch (err) {
            console.error(`[migrate] 表 "${table}" 插入失敗 (id=${(row as unknown as Record<string, unknown>).id}):`, err)
            throw err
          }
        }
      }

      const pgCountRes = await pg.query<{ c: string }>(`SELECT COUNT(*) as c FROM "${table}"`)
      const pgCount = DRY_RUN ? 0 : Number(pgCountRes.rows[0]?.c ?? 0)
      reconciliation.push({
        table,
        sqlite: sqliteRows.length,
        pg: pgCount,
        ok: DRY_RUN || sqliteRows.length === pgCount,
      })
      console.log(
        `[migrate] ${table}: sqlite=${sqliteRows.length} pg=${pgCount} ${DRY_RUN ? '(dry-run)' : sqliteRows.length === pgCount ? 'OK' : '❌ MISMATCH'}`,
      )
    }

    if (!DRY_RUN) {
      await pg.query(`SET session_replication_role = DEFAULT`)

      // ── 4. sequence setval：每個有 id serial 欄位的表，撥到 max(id)+1 ──
      for (const table of pgTables) {
        const seqRes = await pg.query<{ seq: string | null }>(
          `SELECT pg_get_serial_sequence($1, 'id') as seq`,
          [table],
        )
        const seq = seqRes.rows[0]?.seq
        if (!seq) continue
        await pg.query(
          `SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT MAX(id) FROM "${table}") IS NOT NULL)`,
          [seq],
        )
      }
      console.log('[migrate] sequence setval 完成')
    }

    // ── 5. 對帳彙總 ──
    const mismatches = reconciliation.filter((r) => !r.ok)
    console.log('\n========== 對帳彙總 ==========')
    console.log(`共 ${reconciliation.length} 表，SQLite 總筆數 ${reconciliation.reduce((s, r) => s + r.sqlite, 0)}`)
    if (mismatches.length > 0) {
      console.error(`❌ ${mismatches.length} 表不一致：`)
      mismatches.forEach((m) => console.error(`   ${m.table}: sqlite=${m.sqlite} pg=${m.pg}`))
      process.exitCode = 1
    } else {
      console.log(DRY_RUN ? '(dry-run，未實際寫入)' : '✅ 全表 count 對帳通過')
    }
  } finally {
    await pg.end()
    sqlite.close()
  }
}

await main()
