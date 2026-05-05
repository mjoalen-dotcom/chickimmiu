import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-E1 follow-up — `payload_locked_documents_rels` 補 `ad_audiences_id`
 * ─────────────────────────────────────────────
 * `20260505_200000_add_ad_audiences` 建了 `ad_audiences` 與 `ad_audiences_rels`，
 * 但漏掉 Payload 用來追蹤「目前哪份文件被誰編輯」的關聯表
 * `payload_locked_documents_rels` 的 FK 欄位 + index。
 *
 * 結果：admin 任一讀取 lock 狀態的查詢（含 `find({collection:'payload_locked_documents'})`）
 *     會在 SELECT 階段炸 `SQLITE_ERROR: no such column: ad_audiences_id`，
 *     導致 `/admin` 整頁 500（ref digest 2412191298）。
 *
 * 同類 bug 已於 `20260505_160000_add_utm_lock_rels` 修復過 PR-B 的 product_view_events / utm_campaigns；
 * 此檔複用同 pattern。
 *
 * Hot-fix：補加 1 欄 + 1 index。冪等（columnExists / indexExists）。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, name: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${name}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ─── ad_audiences_id ───
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'ad_audiences_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`ad_audiences_id\` integer REFERENCES ad_audiences(id) ON UPDATE no action ON DELETE cascade;`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_ad_audiences_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_ad_audiences_id_idx\` ON \`payload_locked_documents_rels\` (\`ad_audiences_id\`);`,
    )
  }
}

export async function down({ db }: MigrateUpArgs | MigrateDownArgs): Promise<void> {
  // SQLite ALTER TABLE DROP COLUMN 在舊版本不支援；保留欄位即可（無資料）。
  // 只移除 index，避免 reapply 衝突。
  if (await indexExists(db, 'payload_locked_documents_rels_ad_audiences_id_idx')) {
    await db.run(sql`DROP INDEX \`payload_locked_documents_rels_ad_audiences_id_idx\`;`)
  }
}
