import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 品牌主題曲後台開關 — GlobalSettings.site 補 1 欄：
 *   site_enable_brand_anthem — 前台左下 BGM 浮動按鈕顯示開關（預設開，
 *                              與既有行為一致；關閉 = 全站不渲染按鈕）
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
  if (!(await columnExists(db, 'global_settings', 'site_enable_brand_anthem'))) {
    await db.run(
      sql`ALTER TABLE \`global_settings\` ADD COLUMN \`site_enable_brand_anthem\` integer DEFAULT true;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'global_settings', 'site_enable_brand_anthem')) {
    await db.run(
      sql`ALTER TABLE \`global_settings\` DROP COLUMN \`site_enable_brand_anthem\`;`,
    )
  }
}
