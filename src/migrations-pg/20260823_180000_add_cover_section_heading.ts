import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 歡迎頁媒體牆列補 heading 欄（chuu 式區塊大標，2026-08-23 三修）
 * 純加欄，不動既有資料。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_settings_cover_page_sections" ADD COLUMN IF NOT EXISTS "heading" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_settings_cover_page_sections" DROP COLUMN IF EXISTS "heading";`)
}
