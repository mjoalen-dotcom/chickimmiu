import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Wave 1 PR-α — `product_list_settings` global
 *   新增主表 `product_list_settings`（單列 singleton）+ 1 個 array 子表
 *   `product_list_settings_page_size_options`（前台可切換的每頁筆數選項）。
 *
 *   主表含一個 upload 欄 `banner_image_id` → media(id) ON DELETE set null
 *   + 對應 index `product_list_settings_banner_banner_image_idx`。
 *
 *   Globals 不需要在 `payload_locked_documents_rels` 加 FK（lock_rels 只
 *   追 collection 文件鎖；singletons 不會多人同時編輯到衝突）。
 *
 *   冪等：用 sqlite_master 判斷表是否已存在。對應 pattern：
 *   20260421_200000_add_checkout_order_settings.ts。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
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
  // ─────────────── product_list_settings ───────────────
  if (!(await tableExists(db, 'product_list_settings'))) {
    await db.run(sql`CREATE TABLE \`product_list_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`page_size\` numeric DEFAULT 24,
      \`default_sort\` text DEFAULT 'newest',
      \`max_price_cap\` numeric DEFAULT 10000,
      \`hide_out_of_stock\` integer DEFAULT false,
      \`show_size_filter\` integer DEFAULT true,
      \`default_related_count\` numeric DEFAULT 4,
      \`banner_image_id\` integer REFERENCES media(id) ON UPDATE no action ON DELETE set null,
      \`banner_overline\` text DEFAULT 'PRODUCTS',
      \`banner_title\` text DEFAULT '全部商品',
      \`banner_subtitle\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );`)
  }
  if (!(await indexExists(db, 'product_list_settings_banner_banner_image_idx'))) {
    await db.run(
      sql`CREATE INDEX \`product_list_settings_banner_banner_image_idx\` ON \`product_list_settings\` (\`banner_image_id\`);`,
    )
  }

  // ─────────────── product_list_settings_page_size_options ───────────────
  if (!(await tableExists(db, 'product_list_settings_page_size_options'))) {
    await db.run(sql`CREATE TABLE \`product_list_settings_page_size_options\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`value\` numeric NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_list_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`product_list_settings_page_size_options_order_idx\` ON \`product_list_settings_page_size_options\` (\`_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`product_list_settings_page_size_options_parent_id_idx\` ON \`product_list_settings_page_size_options\` (\`_parent_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 刪除順序：先刪 child，再刪 parent，避免 FK 擋住
  if (await tableExists(db, 'product_list_settings_page_size_options')) {
    await db.run(sql`DROP TABLE \`product_list_settings_page_size_options\`;`)
  }
  if (await tableExists(db, 'product_list_settings')) {
    await db.run(sql`DROP TABLE \`product_list_settings\`;`)
  }
}
