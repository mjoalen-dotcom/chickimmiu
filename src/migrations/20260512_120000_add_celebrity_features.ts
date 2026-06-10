import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * CKMU ON SHOW Stage 1.5 — CelebrityFeatures collection + celebrity-grid block
 *
 * 動機：把 Stage 1 的 lookbook-grid items 陣列升級成獨立 collection，後台能
 * 直接新增/編輯/刪除藝人（不用編 Pages.layout）。每位藝人有 tagline / bio /
 * brandQuote 三種文案。
 *
 * 新增 3 張表：
 *   1. celebrity_features                 — 主表
 *   2. pages_blocks_celebrity_grid        — 新 block
 *   3. payload_locked_documents_rels      — 加 FK column celebrity_features_id
 *
 * 不刪 pages_blocks_lookbook_grid* — Stage 1 主頁已用，留著 lookbook-grid 給
 * 其他 page 使用；只是 ckmu-on-show 主頁的 lookbook-grid block 之後會被 seed v2
 * 替換成 celebrity-grid。
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  /* ── 1. celebrity_features ─────────────────────────────────── */
  if (!(await tableExists(db, 'celebrity_features'))) {
    await db.run(sql`CREATE TABLE \`celebrity_features\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`program\` text NOT NULL,
      \`photo_id\` integer NOT NULL,
      \`tagline\` text,
      \`bio\` text,
      \`brand_quote\` text,
      \`link_type\` text DEFAULT 'pdp' NOT NULL,
      \`linked_product_id\` integer,
      \`link_url\` text,
      \`sort_order\` numeric DEFAULT 0,
      \`status\` text DEFAULT 'published' NOT NULL,
      \`admin_note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`linked_product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
  }
  for (const [name, col] of [
    ['celebrity_features_photo_idx', 'photo_id'],
    ['celebrity_features_linked_product_idx', 'linked_product_id'],
    ['celebrity_features_sort_order_idx', 'sort_order'],
    ['celebrity_features_status_idx', 'status'],
    ['celebrity_features_updated_at_idx', 'updated_at'],
    ['celebrity_features_created_at_idx', 'created_at'],
  ]) {
    if (!(await indexExists(db, name))) {
      await db.run(sql.raw(`CREATE INDEX \`${name}\` ON \`celebrity_features\` (\`${col}\`);`))
    }
  }

  /* ── 2. pages_blocks_celebrity_grid ───────────────────────── */
  if (!(await tableExists(db, 'pages_blocks_celebrity_grid'))) {
    await db.run(sql`CREATE TABLE \`pages_blocks_celebrity_grid\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`_path\` text NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`heading\` text,
      \`subheading\` text,
      \`columns\` text DEFAULT '4',
      \`show_bio_on_hover\` integer DEFAULT 1,
      \`max_items\` integer,
      \`block_name\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  for (const [name, col] of [
    ['pages_blocks_celebrity_grid_order_idx', '_order'],
    ['pages_blocks_celebrity_grid_parent_id_idx', '_parent_id'],
    ['pages_blocks_celebrity_grid_path_idx', '_path'],
  ]) {
    if (!(await indexExists(db, name))) {
      await db.run(
        sql.raw(
          `CREATE INDEX \`${name}\` ON \`pages_blocks_celebrity_grid\` (\`${col}\`);`,
        ),
      )
    }
  }

  /* ── 3. payload_locked_documents_rels.celebrity_features_id ─ */
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'celebrity_features_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`celebrity_features_id\` integer REFERENCES celebrity_features(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_celebrity_features_id_idx\` ON \`payload_locked_documents_rels\` (\`celebrity_features_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['pages_blocks_celebrity_grid', 'celebrity_features']) {
    if (await tableExists(db, t)) {
      await db.run(sql.raw(`DROP TABLE \`${t}\`;`))
    }
  }
  // 不 DROP COLUMN payload_locked_documents_rels.celebrity_features_id（SQLite 成本太高）
}
