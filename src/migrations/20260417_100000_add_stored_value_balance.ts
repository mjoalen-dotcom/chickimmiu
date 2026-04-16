import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.5 N2 — Users.storedValueBalance
 *   使用者自行儲值的現金額度（理論上可退現），與既有的 shoppingCredit（購物金，平台贈送、不可退現）
 *   概念區分。當下僅加欄位，退現 API / 對帳流程另案。
 *
 * 冪等：SQLite 不支援 ADD COLUMN IF NOT EXISTS，改用 PRAGMA table_info 判斷。
 * Pattern 承襲 20260416_193835_add_daily_checkin_streak.ts —— 跑在：
 *   (a) 乾淨 DB：正常 ADD COLUMN
 *   (b) dev 已自動 push schema 的 DB：skip
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
  if (!(await columnExists(db, 'users', 'stored_value_balance'))) {
    await db.run(
      sql`ALTER TABLE \`users\` ADD COLUMN \`stored_value_balance\` numeric DEFAULT 0;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'users', 'stored_value_balance')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`stored_value_balance\`;`)
  }
}
