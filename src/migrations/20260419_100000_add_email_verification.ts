import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 2 email 驗證 — Users 新增 `_verified` + `_verificationtoken`
 *   Payload `auth.verify` 開啟後自動要求這兩個欄位：
 *     - `_verified` (integer/checkbox) 標記使用者是否完成驗證
 *     - `_verificationtoken` (text) 供驗證連結用的一次性 token
 *   注意：欄位名 `_verificationtoken` 全小寫、中間沒有底線。Drizzle 對
 *   leading-underscore 欄位不做 snake_case（與一般 camel→snake 規則不同，
 *   實測自 Payload 查詢 log 取得 canonical 名字，勿改）。
 *   已存在的使用者（admin + 封測客戶）一律標 `_verified = 1`，避免被鎖出。
 *
 * 冪等：SQLite 不支援 ADD COLUMN IF NOT EXISTS，改用 PRAGMA table_info 判斷。
 * Pattern 承襲 20260417_100000_add_stored_value_balance.ts —— 跑在：
 *   (a) 乾淨 DB：正常 ADD COLUMN + UPDATE（空表不影響）
 *   (b) dev 已自動 push schema 的 DB：skip ADD，仍執行 UPDATE（無害）
 *   (c) 未來 prod 第一次跑 migrate：正常 ADD COLUMN + UPDATE
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
  if (!(await columnExists(db, 'users', '_verified'))) {
    await db.run(
      sql`ALTER TABLE \`users\` ADD COLUMN \`_verified\` integer DEFAULT 0;`,
    )
  }
  if (!(await columnExists(db, 'users', '_verificationtoken'))) {
    await db.run(
      sql`ALTER TABLE \`users\` ADD COLUMN \`_verificationtoken\` text;`,
    )
  }
  // 既有使用者一律視為已驗證（封測前已存在的帳號不該被新驗證機制鎖出）。
  // 新註冊會被 customerRegister 依 GlobalSettings.emailAuth.requireEmailVerification
  // 覆寫 _verified 值，所以這條 UPDATE 不影響新流程。
  await db.run(sql`UPDATE \`users\` SET \`_verified\` = 1 WHERE \`_verified\` IS NULL OR \`_verified\` = 0;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'users', '_verificationtoken')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`_verificationtoken\`;`)
  }
  if (await columnExists(db, 'users', '_verified')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`_verified\`;`)
  }
}
