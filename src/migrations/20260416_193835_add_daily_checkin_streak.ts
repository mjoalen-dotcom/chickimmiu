import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.6 — DailyCheckIn streak schema：
 *   1. users.total_check_ins         INTEGER DEFAULT 0 — 累計簽到次數（不重設）
 *   2. users.consecutive_check_ins   INTEGER DEFAULT 0 — 連續簽到天數（中斷一天以上重設為 1）
 *   3. users.last_check_in_date      TEXT (nullable)   — YYYY-MM-DD (Asia/Taipei)
 *
 * 由 lib/games/gameEngine.ts performDailyCheckin 維護。Asia/Taipei 時區計算。
 *
 * 冪等：SQLite 不支援 `ADD COLUMN IF NOT EXISTS`，改用 PRAGMA table_info 判斷。
 * 這樣 migration 跑在：
 *   (a) 乾淨 DB：正常 ADD COLUMN
 *   (b) dev 已自動 push schema（如本專案的 gender / front_name_male）：skip
 *   (c) 未來 prod 第一次跑 migrate：正常 ADD COLUMN
 * 皆不會 duplicate column 報錯。
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
  if (!(await columnExists(db, 'users', 'total_check_ins'))) {
    await db.run(sql`ALTER TABLE \`users\` ADD COLUMN \`total_check_ins\` integer DEFAULT 0;`)
  }
  if (!(await columnExists(db, 'users', 'consecutive_check_ins'))) {
    await db.run(sql`ALTER TABLE \`users\` ADD COLUMN \`consecutive_check_ins\` integer DEFAULT 0;`)
  }
  if (!(await columnExists(db, 'users', 'last_check_in_date'))) {
    await db.run(sql`ALTER TABLE \`users\` ADD COLUMN \`last_check_in_date\` text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'users', 'total_check_ins')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`total_check_ins\`;`)
  }
  if (await columnExists(db, 'users', 'consecutive_check_ins')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`consecutive_check_ins\`;`)
  }
  if (await columnExists(db, 'users', 'last_check_in_date')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`last_check_in_date\`;`)
  }
}
