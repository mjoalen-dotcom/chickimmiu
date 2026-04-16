import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.5 — schema 擴充：
 *   1. users.gender            TEXT (nullable) — select: female / male / other
 *   2. membership_tiers.front_name_male  TEXT (nullable) — 男性會員前台稱號
 *
 * 不動 points_redemptions.type：該欄位為 plain TEXT（無 check constraint），
 * 新增 'styling' / 'charity' / 'mystery' select option 不需 DB migration。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD COLUMN \`gender\` text;`)
  await db.run(sql`ALTER TABLE \`membership_tiers\` ADD COLUMN \`front_name_male\` text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`gender\`;`)
  await db.run(sql`ALTER TABLE \`membership_tiers\` DROP COLUMN \`front_name_male\`;`)
}
