import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 社群登入憑證後台化（Shopline 式）— GlobalSettings.socialLogin 補 10 欄：
 *   Google  client id/secret、Facebook app id/secret、LINE channel id/secret、
 *   Apple services id/team id/key id/private key(.p8 全文)
 * 全部 TEXT nullable；留空 fallback .env（現行 LINE env 設定不受影響）。
 *
 * 冪等：SQLite 不支援 ADD COLUMN IF NOT EXISTS，用 PRAGMA table_info 判斷。
 */

const COLUMNS = [
  'social_login_google_client_id',
  'social_login_google_client_secret',
  'social_login_facebook_app_id',
  'social_login_facebook_app_secret',
  'social_login_line_channel_id',
  'social_login_line_channel_secret',
  'social_login_apple_services_id',
  'social_login_apple_team_id',
  'social_login_apple_key_id',
  'social_login_apple_private_key',
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
