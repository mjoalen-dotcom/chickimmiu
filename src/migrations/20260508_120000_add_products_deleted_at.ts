import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Products — 啟用 Payload v3 軟刪（trash: true）
 *
 *   1. products.deleted_at  — 軟刪時間戳；列表預設過濾 deletedAt IS NULL
 *
 * 行為：
 *   - 列表 / API find 預設不會看到 deleted_at != NULL 的商品
 *   - 後台 sidebar 多「垃圾桶」分頁，可手動「永久刪除」或「還原」
 *   - 7 日自動清理：/api/cron/purge-trashed-products
 *
 * 冪等：sqlite 不支援 IF NOT EXISTS，改用 PRAGMA 判斷；
 * pattern 沿襲 20260508_100000_add_product_listing_schedule_image_category_material_images.ts。
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

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'products', 'deleted_at'))) {
    await db.run(sql`ALTER TABLE \`products\` ADD COLUMN \`deleted_at\` text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // SQLite 不支援 DROP COLUMN（< 3.35）— 留欄位無妨，無資料風險
  // 若需嚴格 rollback 請用 sqlite > 3.35 後執行：
  //   ALTER TABLE products DROP COLUMN deleted_at;
}
