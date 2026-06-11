import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * LINE Messaging API 接真 — CRMSettings.notificationChannels 補 2 欄：
 *   line_messaging_enabled — 總開關（預設關；沿用 Shopline channel，開啟 = 本站接管，
 *                            admin UI confirm 提示 Shopline LINE 功能將失效）
 *   line_channel_secret    — webhook x-line-signature 驗章用
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
  if (!(await columnExists(db, 'crm_settings', 'notification_channels_line_messaging_enabled'))) {
    await db.run(
      sql`ALTER TABLE \`crm_settings\` ADD COLUMN \`notification_channels_line_messaging_enabled\` integer DEFAULT false;`,
    )
  }
  if (!(await columnExists(db, 'crm_settings', 'notification_channels_line_channel_secret'))) {
    await db.run(
      sql`ALTER TABLE \`crm_settings\` ADD COLUMN \`notification_channels_line_channel_secret\` text;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'crm_settings', 'notification_channels_line_messaging_enabled')) {
    await db.run(
      sql`ALTER TABLE \`crm_settings\` DROP COLUMN \`notification_channels_line_messaging_enabled\`;`,
    )
  }
  if (await columnExists(db, 'crm_settings', 'notification_channels_line_channel_secret')) {
    await db.run(
      sql`ALTER TABLE \`crm_settings\` DROP COLUMN \`notification_channels_line_channel_secret\`;`,
    )
  }
}
