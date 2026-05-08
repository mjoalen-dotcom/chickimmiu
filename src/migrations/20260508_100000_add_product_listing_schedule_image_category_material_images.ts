import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Products — 後台商品管理擴充（PR-A）
 *
 *   1. products.publish_at / unpublish_at        — 排程上下架時間（cron 配套，PR-B）
 *   2. products.material_description             — 材質詳細說明（textarea）
 *   3. products_images.category                  — 商品圖庫的分類（封面/正面/背面/側面/細節/模特兒/搭配/尺寸表/其他）
 *   4. products_material_images (new table)      — 材質說明圖片（array of upload）
 *
 * 冪等：sqlite 不支援 IF NOT EXISTS，改用 PRAGMA 判斷；
 * pattern 沿襲 20260417_100000_add_stored_value_balance.ts。
 */

async function columnExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  column: string,
): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

async function tableExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
): Promise<boolean> {
  const res = await db.run(
    sql.raw(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`,
    ),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  /* ── 1. products: publishAt / unpublishAt / materialDescription ── */
  if (!(await columnExists(db, 'products', 'publish_at'))) {
    await db.run(sql`ALTER TABLE \`products\` ADD COLUMN \`publish_at\` text;`)
  }
  if (!(await columnExists(db, 'products', 'unpublish_at'))) {
    await db.run(sql`ALTER TABLE \`products\` ADD COLUMN \`unpublish_at\` text;`)
  }
  if (!(await columnExists(db, 'products', 'material_description'))) {
    await db.run(sql`ALTER TABLE \`products\` ADD COLUMN \`material_description\` text;`)
  }

  /* ── 2. products_images.category ── */
  if (!(await columnExists(db, 'products_images', 'category'))) {
    await db.run(
      sql`ALTER TABLE \`products_images\` ADD COLUMN \`category\` text DEFAULT 'detail';`,
    )
  }

  /* ── 3. products_material_images (new table) ── */
  if (!(await tableExists(db, 'products_material_images'))) {
    await db.run(sql`CREATE TABLE \`products_material_images\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`image_id\` integer NOT NULL,
      \`caption\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`products_material_images_order_idx\` ON \`products_material_images\` (\`_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`products_material_images_parent_id_idx\` ON \`products_material_images\` (\`_parent_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`products_material_images_image_idx\` ON \`products_material_images\` (\`image_id\`);`,
    )
  }

  /* ── 4. 索引：publishAt / unpublishAt 用於 cron 掃描 ── */
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS products_publish_at_idx ON products (publish_at);`,
    ),
  )
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS products_unpublish_at_idx ON products (unpublish_at);`,
    ),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql.raw(`DROP INDEX IF EXISTS products_publish_at_idx;`))
  await db.run(sql.raw(`DROP INDEX IF EXISTS products_unpublish_at_idx;`))

  if (await tableExists(db, 'products_material_images')) {
    await db.run(sql`DROP TABLE \`products_material_images\`;`)
  }

  // SQLite < 3.35 不支援 DROP COLUMN；新版（>= 3.35, ~2021）支援。
  // Payload CLI 環境的 sqlite 版本足夠新，直接 DROP。
  if (await columnExists(db, 'products_images', 'category')) {
    await db.run(sql`ALTER TABLE \`products_images\` DROP COLUMN \`category\`;`)
  }
  if (await columnExists(db, 'products', 'material_description')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`material_description\`;`)
  }
  if (await columnExists(db, 'products', 'unpublish_at')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`unpublish_at\`;`)
  }
  if (await columnExists(db, 'products', 'publish_at')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`publish_at\`;`)
  }
}
