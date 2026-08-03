import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 手機 App 原生社群登入（POST /api/v1/auth/social）—— GlobalSettings.socialLogin 補 3 欄：
 *   Google iOS / Android client id、Apple App Bundle ID
 *
 * 原生 SDK 拿到的 id_token，其 aud 是 App 平台各自的 client id，跟網頁那組不同；
 * 沒登記的話 App 登入會被 audience 檢查擋下。全部 TEXT nullable，留空 fallback .env
 * （AUTH_GOOGLE_IOS_ID / AUTH_GOOGLE_ANDROID_ID / AUTH_APPLE_APP_BUNDLE_ID）。
 *
 * 冪等：SQLite 不支援 ADD COLUMN IF NOT EXISTS，用 PRAGMA table_info 判斷。
 */

const COLUMNS = [
  'social_login_google_ios_client_id',
  'social_login_google_android_client_id',
  'social_login_apple_app_bundle_id',
]

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
  for (const col of COLUMNS) {
    if (!(await columnExists(db, 'global_settings', col))) {
      await db.run(sql.raw(`ALTER TABLE \`global_settings\` ADD COLUMN \`${col}\` text;`))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const col of COLUMNS) {
    if (await columnExists(db, 'global_settings', col)) {
      await db.run(sql.raw(`ALTER TABLE \`global_settings\` DROP COLUMN \`${col}\`;`))
    }
  }
}
