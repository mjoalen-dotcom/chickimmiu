import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * CKMU ON SHOW Stage 1.6 — 加 celebrity_features.slug + social_links 子表
 *
 * 動機：每位藝人要有專屬子頁 /celebrity/{slug}（user 要求像 Shopline 原
 *      /pages/ckmuonshow-01 那樣個別專頁）+ 顯示她們社群連結互惠導流。
 *
 * 變動：
 *   1. ALTER TABLE celebrity_features ADD COLUMN slug TEXT
 *   2. CREATE INDEX celebrity_features_slug_idx (unique)
 *   3. CREATE TABLE celebrity_features_social_links (array sub-table)
 *
 * 注意：slug 在 schema 是 required:true，但 ALTER 加 column 不能設 NOT NULL
 * （已有 18 筆資料）。seed v2.1 會 backfill 所有 row 的 slug，之後 admin 新建
 * 時 Payload 驗證會強制要求 slug。
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
  /* ── 1. celebrity_features.slug ─────────────────────────── */
  if (!(await columnExists(db, 'celebrity_features', 'slug'))) {
    await db.run(sql`ALTER TABLE \`celebrity_features\` ADD \`slug\` text;`)
  }
  if (!(await indexExists(db, 'celebrity_features_slug_idx'))) {
    // Note: unique index will be added AFTER seed v2.1 backfills slugs.
    // For now non-unique to avoid blocking existing rows. Plain index for lookup speed.
    await db.run(
      sql`CREATE INDEX \`celebrity_features_slug_idx\` ON \`celebrity_features\` (\`slug\`);`,
    )
  }

  /* ── 2. celebrity_features_social_links (array sub-table) ─ */
  if (!(await tableExists(db, 'celebrity_features_social_links'))) {
    await db.run(sql`CREATE TABLE \`celebrity_features_social_links\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`platform\` text NOT NULL,
      \`url\` text NOT NULL,
      \`handle\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`celebrity_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'celebrity_features_social_links_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`celebrity_features_social_links_order_idx\` ON \`celebrity_features_social_links\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'celebrity_features_social_links_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`celebrity_features_social_links_parent_id_idx\` ON \`celebrity_features_social_links\` (\`_parent_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'celebrity_features_social_links')) {
    await db.run(sql`DROP TABLE \`celebrity_features_social_links\`;`)
  }
  // 不 DROP COLUMN slug — SQLite 成本高，留無害
}
