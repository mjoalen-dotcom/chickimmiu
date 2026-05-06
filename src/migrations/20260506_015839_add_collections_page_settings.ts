import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Wave 1 PR-β — CollectionsPageSettings global
 * ─────────────────────────────────────────────
 * 新增「主題精選頁設定」global，控制 /collections 的 hero 文案與
 * 主題卡片陣列（每張卡片可選 collectionTags 多選 → /collections/<slug>）。
 *
 * 對應 schema：
 *   1. `collections_page_settings`            — global root（hero group flat 為 hero_*）
 *   2. `collections_page_settings_cards`      — 卡片陣列子表（image FK media、seo group flat）
 *   3. `collections_page_settings_cards_collection_tags_filter`
 *                                              — 卡片內 hasMany select 的多值表
 *
 * 冪等：用 PRAGMA table_info / sqlite_master 判斷；建表前 skip-if-exists。
 *      Pattern 對齊 src/migrations/20260429_120000_add_ads_catalog.ts。
 *
 * Globals 不需動 payload_locked_documents_rels（只 collection 才會被 lock 追蹤）。
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
  // ─── collections_page_settings (global root) ───
  if (!(await tableExists(db, 'collections_page_settings'))) {
    await db.run(sql`CREATE TABLE \`collections_page_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`hero_overline\` text DEFAULT 'Collection',
      \`hero_title\` text DEFAULT '主題精選',
      \`hero_description\` text DEFAULT '依風格、場合、主題瀏覽我們為您精心策劃的系列',
      \`updated_at\` text,
      \`created_at\` text
    );`)
  }

  // ─── collections_page_settings_cards (array child) ───
  if (!(await tableExists(db, 'collections_page_settings_cards'))) {
    await db.run(sql`CREATE TABLE \`collections_page_settings_cards\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`image_id\` integer NOT NULL,
      \`title\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`description\` text,
      \`span\` text DEFAULT 'normal',
      \`sort_order\` numeric DEFAULT 0,
      \`is_active\` integer DEFAULT true,
      \`seo_meta_title\` text,
      \`seo_meta_description\` text,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`collections_page_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'collections_page_settings_cards_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`collections_page_settings_cards_order_idx\` ON \`collections_page_settings_cards\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'collections_page_settings_cards_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`collections_page_settings_cards_parent_id_idx\` ON \`collections_page_settings_cards\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'collections_page_settings_cards_image_idx'))) {
    await db.run(
      sql`CREATE INDEX \`collections_page_settings_cards_image_idx\` ON \`collections_page_settings_cards\` (\`image_id\`);`,
    )
  }

  // ─── collections_page_settings_cards_collection_tags_filter (hasMany select) ───
  if (!(await tableExists(db, 'collections_page_settings_cards_collection_tags_filter'))) {
    await db.run(sql`CREATE TABLE \`collections_page_settings_cards_collection_tags_filter\` (
      \`order\` integer NOT NULL,
      \`parent_id\` text NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`collections_page_settings_cards\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (
    !(await indexExists(
      db,
      'collections_page_settings_cards_collection_tags_filter_order_idx',
    ))
  ) {
    await db.run(
      sql`CREATE INDEX \`collections_page_settings_cards_collection_tags_filter_order_idx\` ON \`collections_page_settings_cards_collection_tags_filter\` (\`order\`);`,
    )
  }
  if (
    !(await indexExists(
      db,
      'collections_page_settings_cards_collection_tags_filter_parent_idx',
    ))
  ) {
    await db.run(
      sql`CREATE INDEX \`collections_page_settings_cards_collection_tags_filter_parent_idx\` ON \`collections_page_settings_cards_collection_tags_filter\` (\`parent_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'collections_page_settings_cards_collection_tags_filter')) {
    await db.run(sql`DROP TABLE \`collections_page_settings_cards_collection_tags_filter\`;`)
  }
  if (await tableExists(db, 'collections_page_settings_cards')) {
    await db.run(sql`DROP TABLE \`collections_page_settings_cards\`;`)
  }
  if (await tableExists(db, 'collections_page_settings')) {
    await db.run(sql`DROP TABLE \`collections_page_settings\`;`)
  }
}
