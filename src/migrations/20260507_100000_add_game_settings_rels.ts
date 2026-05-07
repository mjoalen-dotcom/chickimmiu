import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.8 P4 — GameSettings.fashionChallenge.gameAssets
 *
 * GameSettings global 首次加入 relationship 欄位：
 *   `fashionChallenge.gameAssets` (hasMany, relationTo: 'products')
 *
 * Payload SQLite adapter 為 hasMany relationship 在 global 建立
 *   `{global_slug}_rels` 表，格式對齊 collections_rels pattern
 *   （參考 20260422_100000_add_coupons.ts coupons_rels）：
 *     id, order, parent_id (→ game_settings.id), path, products_id
 *
 * 冪等：tableExists / indexExists guard。
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
  if (!(await tableExists(db, 'game_settings_rels'))) {
    await db.run(sql`CREATE TABLE \`game_settings_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`products_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`game_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'game_settings_rels_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`game_settings_rels_order_idx\` ON \`game_settings_rels\` (\`order\`);`,
    )
  }
  if (!(await indexExists(db, 'game_settings_rels_parent_idx'))) {
    await db.run(
      sql`CREATE INDEX \`game_settings_rels_parent_idx\` ON \`game_settings_rels\` (\`parent_id\`);`,
    )
  }
  if (!(await indexExists(db, 'game_settings_rels_path_idx'))) {
    await db.run(
      sql`CREATE INDEX \`game_settings_rels_path_idx\` ON \`game_settings_rels\` (\`path\`);`,
    )
  }
  if (!(await indexExists(db, 'game_settings_rels_products_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`game_settings_rels_products_id_idx\` ON \`game_settings_rels\` (\`products_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'game_settings_rels')) {
    await db.run(sql`DROP TABLE \`game_settings_rels\`;`)
  }
}
