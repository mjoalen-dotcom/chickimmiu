import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR #136 feat(pages) — 5 magazine-style blocks for Pages.layout
 *
 * 為了讓 PR #134 的 5 個快速樣板（時尚雜誌 / Vogue / Luxury / KOL / Cosmopolitan）
 * 視覺差異化，新增 5 個雜誌風 block 類型。對應 src/collections/Pages.ts 第 200-410 行。
 *
 * 新增 10 張表（5 主表 + 5 array 子表 + 1 雙層巢狀 array）：
 *   1. pages_blocks_magazine_cover                  — 雜誌封面式（issue_label / heading / image / layout / theme）
 *   2. pages_blocks_magazine_cover_corner_labels    — 邊角小字 array
 *   3. pages_blocks_pull_quote                      — 大引言（quote / source / font / alignment）
 *   4. pages_blocks_editorial_spread                — 圖文交錯
 *   5. pages_blocks_editorial_spread_rows           — rows array（含 richText body）
 *   6. pages_blocks_lookbook_grid                   — Lookbook 網格
 *   7. pages_blocks_lookbook_grid_items             — items array（含 image required + linkedProduct relationship）
 *   8. pages_blocks_lookbook_grid_items_tags        — items.tags 雙層巢狀 array
 *   9. pages_blocks_kol_persona                     — KOL 個人介紹（avatar / bio / signatureQuote）
 *  10. pages_blocks_kol_persona_social_links        — 社群連結 array
 *
 * 慣例（對照既有 pages_blocks_* 表）：
 *   - 主表：_order int NOT NULL / _parent_id int → pages(id) cascade / _path text NOT NULL / id text PK / block_name text
 *   - array 子表：_order int NOT NULL / _parent_id **text** → parent block(id) cascade / id text PK
 *   - 雙層巢狀 array：parent_id text 指向上層 array 子表的 id
 *   - upload 欄位 → <field>_id integer + FK media + 索引 <field>_idx
 *   - relationship 欄位（lookbook_grid.items.linkedProduct）走 polymorphic pages_rels（products_id 已存在），無需 schema 變更
 *
 * 冪等：所有 CREATE TABLE / CREATE INDEX 用 sqlite_master 預檢；承襲
 *   20260420_200000_add_about_vision_and_gallery.ts pattern。
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
  /* ── 1. magazine-cover ───────────────────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_magazine_cover'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_magazine_cover\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`_path\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`issue_label\` text,
      \`heading\` text NOT NULL,
      \`subheading\` text,
      \`image_id\` integer,
      \`layout\` text DEFAULT 'center',
      \`theme\` text DEFAULT 'light',
      \`block_name\` text,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_magazine_cover_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_magazine_cover_order_idx\` ON \`pages_blocks_magazine_cover\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_magazine_cover_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_magazine_cover_parent_id_idx\` ON \`pages_blocks_magazine_cover\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_magazine_cover_path_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_magazine_cover_path_idx\` ON \`pages_blocks_magazine_cover\` (\`_path\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_magazine_cover_image_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_magazine_cover_image_idx\` ON \`pages_blocks_magazine_cover\` (\`image_id\`);`,
    )
  }

  /* ── 2. magazine-cover.cornerLabels[] ────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_magazine_cover_corner_labels'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_magazine_cover_corner_labels\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`text\` text NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_magazine_cover\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_magazine_cover_corner_labels_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_magazine_cover_corner_labels_order_idx\` ON \`pages_blocks_magazine_cover_corner_labels\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_magazine_cover_corner_labels_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_magazine_cover_corner_labels_parent_id_idx\` ON \`pages_blocks_magazine_cover_corner_labels\` (\`_parent_id\`);`,
    )
  }

  /* ── 3. pull-quote ───────────────────────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_pull_quote'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_pull_quote\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`_path\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`quote\` text NOT NULL,
      \`source\` text,
      \`font\` text DEFAULT 'serif',
      \`alignment\` text DEFAULT 'center',
      \`block_name\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_pull_quote_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_pull_quote_order_idx\` ON \`pages_blocks_pull_quote\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_pull_quote_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_pull_quote_parent_id_idx\` ON \`pages_blocks_pull_quote\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_pull_quote_path_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_pull_quote_path_idx\` ON \`pages_blocks_pull_quote\` (\`_path\`);`,
    )
  }

  /* ── 4. editorial-spread ─────────────────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_editorial_spread'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_editorial_spread\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`_path\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`heading\` text,
      \`block_name\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_editorial_spread_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_editorial_spread_order_idx\` ON \`pages_blocks_editorial_spread\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_editorial_spread_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_editorial_spread_parent_id_idx\` ON \`pages_blocks_editorial_spread\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_editorial_spread_path_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_editorial_spread_path_idx\` ON \`pages_blocks_editorial_spread\` (\`_path\`);`,
    )
  }

  /* ── 5. editorial-spread.rows[] ──────────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_editorial_spread_rows'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_editorial_spread_rows\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`image_id\` integer,
      \`heading\` text,
      \`body\` text,
      \`image_position\` text DEFAULT 'left',
      \`background\` text DEFAULT 'cream',
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_editorial_spread\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_editorial_spread_rows_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_editorial_spread_rows_order_idx\` ON \`pages_blocks_editorial_spread_rows\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_editorial_spread_rows_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_editorial_spread_rows_parent_id_idx\` ON \`pages_blocks_editorial_spread_rows\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_editorial_spread_rows_image_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_editorial_spread_rows_image_idx\` ON \`pages_blocks_editorial_spread_rows\` (\`image_id\`);`,
    )
  }

  /* ── 6. lookbook-grid ────────────────────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_lookbook_grid'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_lookbook_grid\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`_path\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`heading\` text,
      \`columns\` text DEFAULT '3',
      \`block_name\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_order_idx\` ON \`pages_blocks_lookbook_grid\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_parent_id_idx\` ON \`pages_blocks_lookbook_grid\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_path_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_path_idx\` ON \`pages_blocks_lookbook_grid\` (\`_path\`);`,
    )
  }

  /* ── 7. lookbook-grid.items[] ──────────────────────────────────────
     注意：linkedProduct 是 single-relationship（非 hasMany），drizzle 把它
     當 column 直接存在 parent 表上（同 upload 行為），不走 pages_rels
     polymorphic table。  */
  if (!(await tableExists(db, 'pages_blocks_lookbook_grid_items'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_lookbook_grid_items\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`image_id\` integer NOT NULL,
      \`name\` text,
      \`linked_product_id\` integer,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`linked_product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_lookbook_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_items_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_items_order_idx\` ON \`pages_blocks_lookbook_grid_items\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_items_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_items_parent_id_idx\` ON \`pages_blocks_lookbook_grid_items\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_items_image_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_items_image_idx\` ON \`pages_blocks_lookbook_grid_items\` (\`image_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_items_linked_product_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_items_linked_product_idx\` ON \`pages_blocks_lookbook_grid_items\` (\`linked_product_id\`);`,
    )
  }

  /* ── 8. lookbook-grid.items[].tags[] (雙層巢狀) ──────────────────── */
  if (!(await tableExists(db, 'pages_blocks_lookbook_grid_items_tags'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_lookbook_grid_items_tags\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`text\` text NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_lookbook_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_items_tags_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_items_tags_order_idx\` ON \`pages_blocks_lookbook_grid_items_tags\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_lookbook_grid_items_tags_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_lookbook_grid_items_tags_parent_id_idx\` ON \`pages_blocks_lookbook_grid_items_tags\` (\`_parent_id\`);`,
    )
  }

  /* ── 9. kol-persona ──────────────────────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_kol_persona'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_kol_persona\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`_path\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`avatar_id\` integer,
      \`name\` text NOT NULL,
      \`title\` text,
      \`bio\` text,
      \`signature_quote\` text,
      \`block_name\` text,
      FOREIGN KEY (\`avatar_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_kol_persona_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_kol_persona_order_idx\` ON \`pages_blocks_kol_persona\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_kol_persona_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_kol_persona_parent_id_idx\` ON \`pages_blocks_kol_persona\` (\`_parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_kol_persona_path_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_kol_persona_path_idx\` ON \`pages_blocks_kol_persona\` (\`_path\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_kol_persona_avatar_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_kol_persona_avatar_idx\` ON \`pages_blocks_kol_persona\` (\`avatar_id\`);`,
    )
  }

  /* ── 10. kol-persona.socialLinks[] ───────────────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_kol_persona_social_links'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_kol_persona_social_links\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`platform\` text NOT NULL,
      \`url\` text NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_kol_persona\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'pages_blocks_kol_persona_social_links_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_kol_persona_social_links_order_idx\` ON \`pages_blocks_kol_persona_social_links\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'pages_blocks_kol_persona_social_links_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`pages_blocks_kol_persona_social_links_parent_id_idx\` ON \`pages_blocks_kol_persona_social_links\` (\`_parent_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 子表先 drop（FK 依賴），主表後 drop
  for (const t of [
    'pages_blocks_kol_persona_social_links',
    'pages_blocks_kol_persona',
    'pages_blocks_lookbook_grid_items_tags',
    'pages_blocks_lookbook_grid_items',
    'pages_blocks_lookbook_grid',
    'pages_blocks_editorial_spread_rows',
    'pages_blocks_editorial_spread',
    'pages_blocks_pull_quote',
    'pages_blocks_magazine_cover_corner_labels',
    'pages_blocks_magazine_cover',
  ]) {
    if (await tableExists(db, t)) {
      await db.run(sql.raw(`DROP TABLE \`${t}\`;`))
    }
  }
}
