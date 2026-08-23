import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 歡迎頁區塊連結（2026-08-24 Alan：每個區塊可在後台設定導向，
 * 留空預設進賣場 /home）— heroLink + sections.link 純加欄。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_settings" ADD COLUMN IF NOT EXISTS "cover_page_hero_link" varchar;
  ALTER TABLE "homepage_settings_cover_page_sections" ADD COLUMN IF NOT EXISTS "link" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_settings" DROP COLUMN IF EXISTS "cover_page_hero_link";
  ALTER TABLE "homepage_settings_cover_page_sections" DROP COLUMN IF EXISTS "link";`)
}
