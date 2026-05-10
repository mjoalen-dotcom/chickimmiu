import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Products — imageMigration group（PR2/3 of automation P0）
 *
 * 為 Shopline → R2 圖片遷移加狀態追蹤欄位，讓批次匯入 idempotent：
 *   重跑時看 imageMigration.status 已 'done' 就直接 skip，不重新下載 / 上傳。
 *
 * 新增 5 欄到 products：
 *   image_migration_status              text DEFAULT 'pending'
 *     pending / in_progress / done / failed / skipped
 *   image_migration_last_attempt_at     text     最後嘗試的 ISO 時間
 *   image_migration_last_error          text     失敗訊息（成功時清空）
 *   image_migration_processed_count     numeric  已處理圖數
 *   image_migration_total_count         numeric  總目標圖數
 *
 * 加索引 image_migration_status_idx 給後台「找出所有 pending / failed」查詢用。
 *
 * 冪等：PRAGMA 判斷現有欄位再加；pattern 沿襲
 *   20260418_220000_add_login_attempts.ts。
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
  if (!(await columnExists(db, 'products', 'image_migration_status'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`image_migration_status\` text DEFAULT 'pending';`,
    )
  }
  if (!(await columnExists(db, 'products', 'image_migration_last_attempt_at'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`image_migration_last_attempt_at\` text;`,
    )
  }
  if (!(await columnExists(db, 'products', 'image_migration_last_error'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`image_migration_last_error\` text;`,
    )
  }
  if (!(await columnExists(db, 'products', 'image_migration_processed_count'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`image_migration_processed_count\` numeric DEFAULT 0;`,
    )
  }
  if (!(await columnExists(db, 'products', 'image_migration_total_count'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`image_migration_total_count\` numeric DEFAULT 0;`,
    )
  }

  // 索引：找出所有 pending / failed / in_progress 商品（admin 排程用）
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS products_image_migration_status_idx ON products (image_migration_status);`,
    ),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql.raw(`DROP INDEX IF EXISTS products_image_migration_status_idx;`))

  if (await columnExists(db, 'products', 'image_migration_total_count')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`image_migration_total_count\`;`)
  }
  if (await columnExists(db, 'products', 'image_migration_processed_count')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`image_migration_processed_count\`;`)
  }
  if (await columnExists(db, 'products', 'image_migration_last_error')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`image_migration_last_error\`;`)
  }
  if (await columnExists(db, 'products', 'image_migration_last_attempt_at')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`image_migration_last_attempt_at\`;`)
  }
  if (await columnExists(db, 'products', 'image_migration_status')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`image_migration_status\`;`)
  }
}
