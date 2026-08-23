import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 歡迎頁展示媒體牆 — coverPage.sections array（PostgreSQL 版）
 * ──────────────────────────────────────────────────────────
 * 2026-08-23 二修：封面中段改 LV collection 式後台逐列策展
 * （整幅 / 左右雙欄，每格圖片或影片）。
 * 表結構 1:1 對齊既有 array 表 homepage_settings_hero_banners
 * （_order/_parent_id/varchar id + media FK SET NULL + parent CASCADE）。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_homepage_settings_cover_page_sections_layout" AS ENUM('full', 'split');
  CREATE TABLE "homepage_settings_cover_page_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layout" "enum_homepage_settings_cover_page_sections_layout" DEFAULT 'full',
  	"media_id" integer NOT NULL,
  	"media_right_id" integer,
  	"caption" varchar
  );

  ALTER TABLE "homepage_settings_cover_page_sections" ADD CONSTRAINT "homepage_settings_cover_page_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_settings_cover_page_sections" ADD CONSTRAINT "homepage_settings_cover_page_sections_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings_cover_page_sections" ADD CONSTRAINT "homepage_settings_cover_page_sections_media_right_id_media_id_fk" FOREIGN KEY ("media_right_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "homepage_settings_cover_page_sections_order_idx" ON "homepage_settings_cover_page_sections" USING btree ("_order");
  CREATE INDEX "homepage_settings_cover_page_sections_parent_id_idx" ON "homepage_settings_cover_page_sections" USING btree ("_parent_id");
  CREATE INDEX "homepage_settings_cover_page_sections_media_idx" ON "homepage_settings_cover_page_sections" USING btree ("media_id");
  CREATE INDEX "homepage_settings_cover_page_sections_media_right_idx" ON "homepage_settings_cover_page_sections" USING btree ("media_right_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "homepage_settings_cover_page_sections" CASCADE;
  DROP TYPE "public"."enum_homepage_settings_cover_page_sections_layout";`)
}
