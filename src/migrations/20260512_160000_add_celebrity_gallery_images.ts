import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * CKMU ON SHOW Stage 2 — 加 celebrity_features.galleryImages 子表
 *
 * 動機：user 強調「藝人的穿搭照片都很珍貴要全部移過來」— 從原 Shopline
 * /pages/ckmuonshow-XX 子頁把每位藝人 4-35 張照片搬到 pre 站，子頁 UI
 * 加 gallery section masonry 展示。
 *
 * 新表：celebrity_features_gallery_images
 *   - _order / _parent_id (FK to celebrity_features) / id (text PK)
 *   - image_id (FK to media, required)
 *   - caption (text, optional)
 *   - linked_product_id (FK to products, optional — 點圖可跳 PDP)
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
  if (!(await tableExists(db, 'celebrity_features_gallery_images'))) {
    await db.run(sql`CREATE TABLE \`celebrity_features_gallery_images\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`image_id\` integer NOT NULL,
      \`caption\` text,
      \`linked_product_id\` integer,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`linked_product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`celebrity_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  for (const [name, col] of [
    ['celebrity_features_gallery_images_order_idx', '_order'],
    ['celebrity_features_gallery_images_parent_id_idx', '_parent_id'],
    ['celebrity_features_gallery_images_image_idx', 'image_id'],
    ['celebrity_features_gallery_images_linked_product_idx', 'linked_product_id'],
  ]) {
    if (!(await indexExists(db, name))) {
      await db.run(
        sql.raw(
          `CREATE INDEX \`${name}\` ON \`celebrity_features_gallery_images\` (\`${col}\`);`,
        ),
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'celebrity_features_gallery_images')) {
    await db.run(sql`DROP TABLE \`celebrity_features_gallery_images\`;`)
  }
}
