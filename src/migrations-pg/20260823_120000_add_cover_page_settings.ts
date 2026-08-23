import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 歡迎頁後台設定 — homepage-settings.coverPage group（PostgreSQL 版）
 * ────────────────────────────────────────────────────────────────
 * 2026-08-23 需求：/ 封面的主視覺（大圖或大影片）與雙欄照片/影片
 * 素材改為後台可設定。單列 global 表，純加欄不動既有資料：
 *   - cover_page_hero_mode → enum（video|image，預設 video）
 *   - 5 個 upload relation → *_id integer FK → media.id（ON DELETE set null，
 *     媒體刪除時自動退回程式內建 fallback）
 * 單列表不加 index。SQLite 本地 dev 由 dev-sync-sqlite-schema.ts 補欄。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_homepage_settings_cover_page_hero_mode" AS ENUM('video', 'image');
  ALTER TABLE "homepage_settings" ADD COLUMN IF NOT EXISTS "cover_page_hero_mode" "enum_homepage_settings_cover_page_hero_mode" DEFAULT 'video';
  ALTER TABLE "homepage_settings" ADD COLUMN IF NOT EXISTS "cover_page_hero_video_id" integer;
  ALTER TABLE "homepage_settings" ADD COLUMN IF NOT EXISTS "cover_page_hero_video_mobile_id" integer;
  ALTER TABLE "homepage_settings" ADD COLUMN IF NOT EXISTS "cover_page_hero_image_id" integer;
  ALTER TABLE "homepage_settings" ADD COLUMN IF NOT EXISTS "cover_page_side_image_id" integer;
  ALTER TABLE "homepage_settings" ADD COLUMN IF NOT EXISTS "cover_page_side_video_id" integer;
  ALTER TABLE "homepage_settings" ADD CONSTRAINT "homepage_settings_cover_page_hero_video_id_media_id_fk" FOREIGN KEY ("cover_page_hero_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings" ADD CONSTRAINT "homepage_settings_cover_page_hero_video_mobile_id_media_id_fk" FOREIGN KEY ("cover_page_hero_video_mobile_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings" ADD CONSTRAINT "homepage_settings_cover_page_hero_image_id_media_id_fk" FOREIGN KEY ("cover_page_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings" ADD CONSTRAINT "homepage_settings_cover_page_side_image_id_media_id_fk" FOREIGN KEY ("cover_page_side_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings" ADD CONSTRAINT "homepage_settings_cover_page_side_video_id_media_id_fk" FOREIGN KEY ("cover_page_side_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_settings" DROP CONSTRAINT IF EXISTS "homepage_settings_cover_page_hero_video_id_media_id_fk";
  ALTER TABLE "homepage_settings" DROP CONSTRAINT IF EXISTS "homepage_settings_cover_page_hero_video_mobile_id_media_id_fk";
  ALTER TABLE "homepage_settings" DROP CONSTRAINT IF EXISTS "homepage_settings_cover_page_hero_image_id_media_id_fk";
  ALTER TABLE "homepage_settings" DROP CONSTRAINT IF EXISTS "homepage_settings_cover_page_side_image_id_media_id_fk";
  ALTER TABLE "homepage_settings" DROP CONSTRAINT IF EXISTS "homepage_settings_cover_page_side_video_id_media_id_fk";
  ALTER TABLE "homepage_settings" DROP COLUMN IF EXISTS "cover_page_hero_mode";
  ALTER TABLE "homepage_settings" DROP COLUMN IF EXISTS "cover_page_hero_video_id";
  ALTER TABLE "homepage_settings" DROP COLUMN IF EXISTS "cover_page_hero_video_mobile_id";
  ALTER TABLE "homepage_settings" DROP COLUMN IF EXISTS "cover_page_hero_image_id";
  ALTER TABLE "homepage_settings" DROP COLUMN IF EXISTS "cover_page_side_image_id";
  ALTER TABLE "homepage_settings" DROP COLUMN IF EXISTS "cover_page_side_video_id";
  DROP TYPE "public"."enum_homepage_settings_cover_page_hero_mode";`)
}
