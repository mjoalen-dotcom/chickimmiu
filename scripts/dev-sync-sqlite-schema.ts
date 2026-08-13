/**
 * dev-sync-sqlite-schema — 非互動版 schema 追平工具（僅限本機 dev DB）
 * ─────────────────────────────────────────────────────────────────
 * 跑法：cross-env NODE_OPTIONS=--no-deprecation payload run scripts/dev-sync-sqlite-schema.ts
 *
 * 背景：本機 dev DB 常落後 payload config（drizzle push 的互動選單無法自動化、
 * migration 鏈只覆蓋 prod 路徑）。本腳本走 payload 的 drizzle schema 物件
 * （用 Symbol.for('drizzle:*') 全域符號讀取，避開 pnpm 下 drizzle-orm 不可直接
 * import 的問題），把「缺的表」CREATE、「缺的欄位」ADD COLUMN 一次補齊。
 *
 * 安全邊界：
 * - 只做加法（不 DROP / 不 RENAME / 不改型別）→ 不會弄丟資料
 * - ADD COLUMN 一律 nullable（SQLite 限制 + dev 夠用）
 * - CREATE TABLE 不含 FK（dev 便利優先；正式 schema 由 migration 定義）
 * - ⚠️ 禁止對 prod 跑：prod 一律走 pnpm payload migrate
 */
import { createClient } from '@libsql/client'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const log = (...args: unknown[]) => console.error('[dev-sync]', ...args)
const keepAlive = setInterval(() => {}, 60_000)

const TABLE_NAME = Symbol.for('drizzle:Name')
const TABLE_COLUMNS = Symbol.for('drizzle:Columns')

interface DrizzleColumnLike {
  name: string
  getSQLType: () => string
  primary: boolean
  notNull: boolean
}

async function main() {
  const payload = await getPayload({ config: await config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = payload.db as any
  const tables = adapter.tables as Record<string, Record<PropertyKey, unknown>>

  const dbUrl = process.env.DATABASE_URI || 'file:./data/chickimmiu.db'
  const db = createClient({ url: dbUrl })
  log('target:', dbUrl)

  const existing = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  )
  const existingTables = new Set(existing.rows.map((r) => String(r.name)))

  let createdTables = 0
  let addedColumns = 0
  for (const key of Object.keys(tables)) {
    const table = tables[key]
    const name = table[TABLE_NAME] as string | undefined
    const colsObj = table[TABLE_COLUMNS] as Record<string, DrizzleColumnLike> | undefined
    if (!name || !colsObj) continue
    const colList = Object.values(colsObj)

    if (!existingTables.has(name)) {
      const defs = colList
        .map((c) => `\`${c.name}\` ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}`)
        .join(', ')
      await db.execute(`CREATE TABLE \`${name}\` (${defs})`)
      createdTables++
      log(`+table ${name}（${colList.length} cols）`)
      continue
    }

    const info = await db.execute(`PRAGMA table_info('${name}')`)
    const have = new Set(info.rows.map((r) => String(r.name)))
    for (const c of colList) {
      if (have.has(c.name)) continue
      await db.execute(`ALTER TABLE \`${name}\` ADD COLUMN \`${c.name}\` ${c.getSQLType()}`)
      addedColumns++
    }
  }

  db.close()
  log(`done：+${createdTables} tables、+${addedColumns} columns`)
  clearInterval(keepAlive)
  process.exit(0)
}

await main().catch((err) => {
  console.error('[dev-sync] FATAL', err)
  process.exit(1)
})
