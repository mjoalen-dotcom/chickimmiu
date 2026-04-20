import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 2026-04-19 — MembershipTiers 擴充：
 *   1. membership_tiers.tagline              TEXT (nullable)
 *   2. membership_tiers.benefits_description TEXT (nullable)
 *
 * 用於 /membership-benefits 卡片與 /account 當前等級介紹區，
 * admin 可為每級撰寫故事性文案。
 *
 * 冪等：SQLite 無 `ADD COLUMN IF NOT EXISTS`，以 PRAGMA table_info 檢查。
 * 參考 20260416_140000_add_gender_and_male_tier_name 同 pattern。
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
  if (!(await columnExists(db, 'membership_tiers', 'tagline'))) {
    await db.run(sql`ALTER TABLE \`membership_tiers\` ADD COLUMN \`tagline\` text;`)
  }
  if (!(await columnExists(db, 'membership_tiers', 'benefits_description'))) {
    await db.run(sql`ALTER TABLE \`membership_tiers\` ADD COLUMN \`benefits_description\` text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'membership_tiers', 'tagline')) {
    await db.run(sql`ALTER TABLE \`membership_tiers\` DROP COLUMN \`tagline\`;`)
  }
  if (await columnExists(db, 'membership_tiers', 'benefits_description')) {
    await db.run(sql`ALTER TABLE \`membership_tiers\` DROP COLUMN \`benefits_description\`;`)
  }
}
