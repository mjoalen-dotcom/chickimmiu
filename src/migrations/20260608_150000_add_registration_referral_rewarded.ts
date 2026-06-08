import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Users.registrationReferralRewarded — 推薦「註冊」獎勵冪等旗標。
 *   防止重複發放推薦註冊獎勵（grantRegistrationReferralReward 由 customerRegister +
 *   afterLogin 兩處呼叫，靠此旗標確保一次）。
 *
 * 冪等：SQLite 不支援 ADD COLUMN IF NOT EXISTS，用 PRAGMA table_info 判斷。
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
  if (!(await columnExists(db, 'users', 'registration_referral_rewarded'))) {
    await db.run(
      sql`ALTER TABLE \`users\` ADD COLUMN \`registration_referral_rewarded\` integer DEFAULT false;`,
    )
    // 既有會員一律 grandfather 成「已處理」，避免上線後既有被推薦會員登入即回溯發獎
    // （非預期的購物金負債）。新註冊會員拿欄位 default false → 正常 eligible。
    await db.run(sql`UPDATE \`users\` SET \`registration_referral_rewarded\` = 1;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'users', 'registration_referral_rewarded')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`registration_referral_rewarded\`;`)
  }
}
