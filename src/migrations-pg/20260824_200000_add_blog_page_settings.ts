import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 穿搭誌頁設定 global — blog-page-settings（PostgreSQL 版）
 * ─────────────────────────────────────────────────────
 * 2026-08-24 需求：/blog 分類頁籤過多擠成滑桿、版型寫死。新增單列 global 表
 * 讓後台可切換分類排列方式與文章版型。純新增表，不動既有資料。
 * 單列表不加 index。SQLite 本地 dev 由 dev-sync-sqlite-schema.ts 補表。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_blog_page_settings_category_nav_style" AS ENUM('pills-wrap', 'pills-scroll', 'underline', 'dropdown', 'hidden');
  CREATE TYPE "public"."enum_blog_page_settings_category_nav_sort_by" AS ENUM('count', 'manual', 'name');
  CREATE TYPE "public"."enum_blog_page_settings_layout_style" AS ENUM('magazine', 'editorial', 'minimal', 'masonry');
  CREATE TYPE "public"."enum_blog_page_settings_layout_columns" AS ENUM('2', '3', '4');
  CREATE TABLE IF NOT EXISTS "blog_page_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_nav_style" "enum_blog_page_settings_category_nav_style" DEFAULT 'pills-wrap',
  	"category_nav_hide_empty" boolean DEFAULT true,
  	"category_nav_show_count" boolean DEFAULT true,
  	"category_nav_max_visible" numeric DEFAULT 6,
  	"category_nav_sort_by" "enum_blog_page_settings_category_nav_sort_by" DEFAULT 'count',
  	"layout_style" "enum_blog_page_settings_layout_style" DEFAULT 'magazine',
  	"layout_columns" "enum_blog_page_settings_layout_columns" DEFAULT '3',
  	"layout_show_editors_pick" boolean DEFAULT true,
  	"layout_show_excerpt" boolean DEFAULT true,
  	"layout_page_size" numeric DEFAULT 12,
  	"hero_enabled" boolean DEFAULT true,
  	"hero_overline" varchar DEFAULT 'Style Journal · 穿搭誌',
  	"hero_title" varchar DEFAULT '讓每一天',
  	"hero_title_accent" varchar DEFAULT '都成為經典',
  	"hero_description" varchar DEFAULT '韓系穿搭靈感、時尚趨勢解讀、編輯部精選 — 由金老佛爺帶領，讓你從通勤到約會，從日常到重要時刻都有屬於自己的風格答案。',
  	"hero_show_actions" boolean DEFAULT true,
  	"newsletter_enabled" boolean DEFAULT true,
  	"newsletter_overline" varchar DEFAULT 'Stay in Style',
  	"newsletter_title" varchar DEFAULT '每週一封穿搭靈感信',
  	"newsletter_description" varchar DEFAULT '訂閱穿搭誌 newsletter — 第一時間收到新品上市、季節穿搭與會員專屬優惠',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "blog_page_settings" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_blog_page_settings_category_nav_style";
  DROP TYPE IF EXISTS "public"."enum_blog_page_settings_category_nav_sort_by";
  DROP TYPE IF EXISTS "public"."enum_blog_page_settings_layout_style";
  DROP TYPE IF EXISTS "public"."enum_blog_page_settings_layout_columns";`)
}
