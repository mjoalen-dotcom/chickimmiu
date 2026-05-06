import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-δ — Products.aliasSlugs[] (舊 URL / 別名)
 * ─────────────────────────────────────────────
 * 加 array 子表 `products_alias_slugs` 讓 Products 支援多個 alias slug。
 * 前台 PDP 找不到 canonical slug 時 fallback 到 alias，命中後 301 redirect。
 *
 * 用途：
 *   - Shopline 7,226 商品匯入時把舊 slug 寫入這個欄位（Wave 2 PR-η）
 *   - admin 手動補
 *
 * 表結構（與 Payload 對 array sub-field 的慣例對齊）：
 *   _order        integer NOT NULL  排序
 *   _parent_id    integer NOT NULL  → products(id) ON DELETE CASCADE
 *   id            text PRIMARY KEY  Payload 自動產 UUID
 *   slug          text NOT NULL     舊 URL slug（不含 /products/）
 *   source        text DEFAULT 'manual'   manual / shopline / csv / other
 *
 * 索引：
 *   _order_idx        — Payload 列表排序
 *   _parent_id_idx    — JOIN 回 products
 *   slug_idx          — PDP 每次 fallback 都查它，缺 index 會 full scan
 *
 * 冪等：CREATE TABLE / INDEX 都用 IF NOT EXISTS。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, name: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${name}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ─── products_alias_slugs ───
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS \`products_alias_slugs\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`slug\` text NOT NULL,
      \`source\` text DEFAULT 'manual',
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
  `)

  if (!(await indexExists(db, 'products_alias_slugs_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`products_alias_slugs_order_idx\` ON \`products_alias_slugs\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'products_alias_slugs_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`products_alias_slugs_parent_id_idx\` ON \`products_alias_slugs\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'products_alias_slugs_slug_idx'))) {
    await db.run(
      sql`CREATE INDEX \`products_alias_slugs_slug_idx\` ON \`products_alias_slugs\` (\`slug\`);`,
    )
  }
}

export async function down({ db }: MigrateUpArgs | MigrateDownArgs): Promise<void> {
  if (await indexExists(db, 'products_alias_slugs_slug_idx')) {
    await db.run(sql`DROP INDEX \`products_alias_slugs_slug_idx\`;`)
  }
  if (await indexExists(db, 'products_alias_slugs_parent_id_idx')) {
    await db.run(sql`DROP INDEX \`products_alias_slugs_parent_id_idx\`;`)
  }
  if (await indexExists(db, 'products_alias_slugs_order_idx')) {
    await db.run(sql`DROP INDEX \`products_alias_slugs_order_idx\`;`)
  }
  await db.run(sql`DROP TABLE IF EXISTS \`products_alias_slugs\`;`)
}
