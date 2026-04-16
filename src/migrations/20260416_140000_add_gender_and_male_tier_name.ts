import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.5 — schema 擴充：
 *   1. users.gender                      TEXT (nullable) — select: female / male / other
 *   2. membership_tiers.front_name_male  TEXT (nullable) — 男性會員前台稱號
 *
 * 不動 points_redemptions.type：該欄位為 plain TEXT（無 check constraint），
 * 新增 'styling' / 'charity' / 'mystery' select option 不需 DB migration。
 *
 * 冪等：SQLite 不支援 `ADD COLUMN IF NOT EXISTS`，改用 PRAGMA table_info 判斷。
 * 這樣 migration 跑在：
 *   (a) 乾淨 DB（prod 首次 deploy）：兩個 ADD COLUMN 都執行
 *   (b) dev 已自動 push schema（如本機 DB，欄位已存在）：兩個都 skip
 *   (c) 同檔重跑（測試冪等性）：全 skip
 * 皆不會 duplicate column 報錯。同日 `20260416_193835_add_daily_checkin_streak`
 * 採一模一樣的 helper，可對照參考。
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
  if (!(await columnExists(db, 'users', 'gender'))) {
    await db.run(sql`ALTER TABLE \`users\` ADD COLUMN \`gender\` text;`)
  }
  if (!(await columnExists(db, 'membership_tiers', 'front_name_male'))) {
    await db.run(sql`ALTER TABLE \`membership_tiers\` ADD COLUMN \`front_name_male\` text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'users', 'gender')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`gender\`;`)
  }
  if (await columnExists(db, 'membership_tiers', 'front_name_male')) {
    await db.run(sql`ALTER TABLE \`membership_tiers\` DROP COLUMN \`front_name_male\`;`)
  }
}
