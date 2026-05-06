import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-B follow-up — `payload_locked_documents_rels` 補欄位
 * ─────────────────────────────────────────────
 * `20260429_180000_add_utm_attribution` 建了 `product_view_events` 與
 * `utm_campaigns` collection table，但漏掉 Payload 用來追蹤
 * 「目前哪份文件被誰編輯」的關聯表 `payload_locked_documents_rels`
 * 的兩個 FK 欄位 + index。
 *
 * 結果：admin 任何讀取 lock 狀態的查詢（含 `findGlobal({slug:'game-settings'})`）
 *     會在 SELECT 階段炸 `SQLITE_ERROR: no such column: product_view_events_id`，
 *     導致 admin 表單 SSR 整個失敗（畫面空白）+
 *     前台 `/games/[slug]` 也走同 query 觸發 throw → notFound() → 404。
 *
 * Hot-fix：補加 2 欄 + 2 index。冪等（columnExists / indexExists）。
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
  // ─── product_view_events_id ───
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'product_view_events_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`product_view_events_id\` integer REFERENCES product_view_events(id) ON UPDATE no action ON DELETE cascade;`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_product_view_events_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_product_view_events_id_idx\` ON \`payload_locked_documents_rels\` (\`product_view_events_id\`);`,
    )
  }

  // ─── utm_campaigns_id ───
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'utm_campaigns_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`utm_campaigns_id\` integer REFERENCES utm_campaigns(id) ON UPDATE no action ON DELETE cascade;`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_utm_campaigns_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_utm_campaigns_id_idx\` ON \`payload_locked_documents_rels\` (\`utm_campaigns_id\`);`,
    )
  }
}

export async function down({ db }: MigrateUpArgs | MigrateDownArgs): Promise<void> {
  // SQLite ALTER TABLE DROP COLUMN 在舊版本不支援；保留欄位即可（無資料）。
  // 只移除 index，避免 reapply 衝突。
  if (await indexExists(db, 'payload_locked_documents_rels_product_view_events_id_idx')) {
    await db.run(
      sql`DROP INDEX \`payload_locked_documents_rels_product_view_events_id_idx\`;`,
    )
  }
  if (await indexExists(db, 'payload_locked_documents_rels_utm_campaigns_id_idx')) {
    await db.run(sql`DROP INDEX \`payload_locked_documents_rels_utm_campaigns_id_idx\`;`)
  }
}
