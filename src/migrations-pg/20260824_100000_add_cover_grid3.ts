import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 媒體牆三欄版型（chuu 下方 lookbook 式微間距三格，2026-08-24）
 *   - sections.layout enum 加 'grid3'
 *   - media_third_id 第 3 格素材 FK
 * down：欄位可拆；enum value PG 無法安全移除，留著無害（沒有列使用即可）。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_homepage_settings_cover_page_sections_layout" ADD VALUE IF NOT EXISTS 'grid3';`)
  await db.execute(sql`
   ALTER TABLE "homepage_settings_cover_page_sections" ADD COLUMN IF NOT EXISTS "media_third_id" integer;
  ALTER TABLE "homepage_settings_cover_page_sections" ADD CONSTRAINT "homepage_settings_cover_page_sections_media_third_id_media_id_fk" FOREIGN KEY ("media_third_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "homepage_settings_cover_page_sections_media_third_idx" ON "homepage_settings_cover_page_sections" USING btree ("media_third_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_settings_cover_page_sections" DROP CONSTRAINT IF EXISTS "homepage_settings_cover_page_sections_media_third_id_media_id_fk";
  DROP INDEX IF EXISTS "homepage_settings_cover_page_sections_media_third_idx";
  ALTER TABLE "homepage_settings_cover_page_sections" DROP COLUMN IF EXISTS "media_third_id";`)
}
