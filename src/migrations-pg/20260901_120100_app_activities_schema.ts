import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * App 專屬三項活動（工單 2026-08-25）— 第 2 支：建表
 * ═══════════════════════════════════════════════════
 * 愛旅遊閱讀獎勵 / 團購好物分享（含留言、訂單去重、檢舉）/ 散步趣（每日、每週）
 * 以及後台設定 global app-activity-settings。
 *
 * SQL 由 Payload migrate:create 對「正式庫結構複本」產生後，濾出本工單的物件
 * （產生器用 .json 快照比對，而快照停在 2026-08-17，故原始輸出含其他已上線的表，
 * 已逐句排除）。複合唯一索引即工單要求的冪等保證：
 *   travel_read_rewards(user, article_id)／step_daily_records(user, date)
 *   step_weekly_records(user, week_id)／group_buy_order_claims(article, order_number)
 *   content_reports(target_type, target_id, reporter)
 *
 * 必須排在 20260901_120000_app_activities_enums 之後（見該檔說明）。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_group_buy_shares_status" AS ENUM('pending', 'approved', 'rejected', 'deleted');
  CREATE TYPE "public"."enum_group_buy_share_comments_status" AS ENUM('published', 'hidden');
  CREATE TYPE "public"."enum_content_reports_target_type" AS ENUM('review', 'comment');
  CREATE TYPE "public"."enum_content_reports_reason" AS ENUM('spam', 'false_info', 'harassment', 'explicit', 'other');
  CREATE TYPE "public"."enum_content_reports_status" AS ENUM('pending', 'handled');
  CREATE TABLE "group_buy_shares_photos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  CREATE TABLE "group_buy_shares" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"article_id" integer NOT NULL,
  	"article_title" varchar,
  	"purchase_date" timestamp(3) with time zone,
  	"order_number" varchar,
  	"content" varchar NOT NULL,
  	"comment_count" numeric DEFAULT 0,
  	"is_featured" boolean DEFAULT false,
  	"featured_at" timestamp(3) with time zone,
  	"status" "enum_group_buy_shares_status" DEFAULT 'pending' NOT NULL,
  	"editable_until" timestamp(3) with time zone,
  	"rewarded" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "group_buy_share_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"review_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"content" varchar NOT NULL,
  	"parent_comment_id_id" integer,
  	"status" "enum_group_buy_share_comments_status" DEFAULT 'published' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "content_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"target_type" "enum_content_reports_target_type" NOT NULL,
  	"target_id" numeric NOT NULL,
  	"review_id" integer,
  	"reporter_id" integer NOT NULL,
  	"target_user_id" integer,
  	"reason" "enum_content_reports_reason" NOT NULL,
  	"reason_detail" varchar DEFAULT '',
  	"status" "enum_content_reports_status" DEFAULT 'pending' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "group_buy_order_claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"article_id" integer NOT NULL,
  	"order_number" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "travel_read_rewards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"article_id" varchar NOT NULL,
  	"article_title" varchar,
  	"points_awarded" numeric DEFAULT 0,
  	"claimed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "step_daily_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" varchar NOT NULL,
  	"steps" numeric DEFAULT 0,
  	"claimed_milestones" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "step_weekly_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"week_id" varchar NOT NULL,
  	"claimed" boolean DEFAULT false,
  	"claimed_at" timestamp(3) with time zone,
  	"steps_at_claim" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "app_activity_settings_group_buy_share_banned_words" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"word" varchar NOT NULL
  );
  CREATE TABLE "app_activity_settings_step_challenge_daily_milestones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"steps" numeric NOT NULL,
  	"points" numeric NOT NULL
  );
  CREATE TABLE "app_activity_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"travel_read_is_active" boolean DEFAULT true,
  	"travel_read_points_per_article" numeric DEFAULT 1,
  	"group_buy_share_is_active" boolean DEFAULT true,
  	"group_buy_share_share_points" numeric DEFAULT 10,
  	"group_buy_share_featured_points" numeric DEFAULT 20,
  	"group_buy_share_min_content_length" numeric DEFAULT 20,
  	"group_buy_share_max_images" numeric DEFAULT 5,
  	"group_buy_share_editable_hours" numeric DEFAULT 24,
  	"step_challenge_is_active" boolean DEFAULT true,
  	"step_challenge_weekly_milestone_steps" numeric DEFAULT 50000,
  	"step_challenge_weekly_milestone_points" numeric DEFAULT 30,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "group_buy_shares_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "group_buy_share_comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "group_buy_order_claims_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "travel_read_rewards_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "step_daily_records_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "step_weekly_records_id" integer;
  ALTER TABLE "group_buy_shares_photos" ADD CONSTRAINT "group_buy_shares_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_buy_shares_photos" ADD CONSTRAINT "group_buy_shares_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."group_buy_shares"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "group_buy_shares" ADD CONSTRAINT "group_buy_shares_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_buy_shares" ADD CONSTRAINT "group_buy_shares_article_id_blog_posts_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_buy_share_comments" ADD CONSTRAINT "group_buy_share_comments_review_id_group_buy_shares_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."group_buy_shares"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_buy_share_comments" ADD CONSTRAINT "group_buy_share_comments_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_buy_share_comments" ADD CONSTRAINT "group_buy_share_comments_parent_comment_id_id_group_buy_share_comments_id_fk" FOREIGN KEY ("parent_comment_id_id") REFERENCES "public"."group_buy_share_comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_review_id_group_buy_shares_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."group_buy_shares"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_customers_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_target_user_id_customers_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_buy_order_claims" ADD CONSTRAINT "group_buy_order_claims_article_id_blog_posts_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_buy_order_claims" ADD CONSTRAINT "group_buy_order_claims_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "travel_read_rewards" ADD CONSTRAINT "travel_read_rewards_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "step_daily_records" ADD CONSTRAINT "step_daily_records_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "step_weekly_records" ADD CONSTRAINT "step_weekly_records_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "app_activity_settings_group_buy_share_banned_words" ADD CONSTRAINT "app_activity_settings_group_buy_share_banned_words_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."app_activity_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "app_activity_settings_step_challenge_daily_milestones" ADD CONSTRAINT "app_activity_settings_step_challenge_daily_milestones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."app_activity_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "group_buy_shares_photos_order_idx" ON "group_buy_shares_photos" USING btree ("_order");
  CREATE INDEX "group_buy_shares_photos_parent_id_idx" ON "group_buy_shares_photos" USING btree ("_parent_id");
  CREATE INDEX "group_buy_shares_photos_image_idx" ON "group_buy_shares_photos" USING btree ("image_id");
  CREATE INDEX "group_buy_shares_user_idx" ON "group_buy_shares" USING btree ("user_id");
  CREATE INDEX "group_buy_shares_article_idx" ON "group_buy_shares" USING btree ("article_id");
  CREATE INDEX "group_buy_shares_order_number_idx" ON "group_buy_shares" USING btree ("order_number");
  CREATE INDEX "group_buy_shares_status_idx" ON "group_buy_shares" USING btree ("status");
  CREATE INDEX "group_buy_shares_updated_at_idx" ON "group_buy_shares" USING btree ("updated_at");
  CREATE INDEX "group_buy_shares_created_at_idx" ON "group_buy_shares" USING btree ("created_at");
  CREATE INDEX "group_buy_share_comments_review_idx" ON "group_buy_share_comments" USING btree ("review_id");
  CREATE INDEX "group_buy_share_comments_user_idx" ON "group_buy_share_comments" USING btree ("user_id");
  CREATE INDEX "group_buy_share_comments_parent_comment_id_idx" ON "group_buy_share_comments" USING btree ("parent_comment_id_id");
  CREATE INDEX "group_buy_share_comments_status_idx" ON "group_buy_share_comments" USING btree ("status");
  CREATE INDEX "group_buy_share_comments_updated_at_idx" ON "group_buy_share_comments" USING btree ("updated_at");
  CREATE INDEX "group_buy_share_comments_created_at_idx" ON "group_buy_share_comments" USING btree ("created_at");
  CREATE INDEX "content_reports_target_type_idx" ON "content_reports" USING btree ("target_type");
  CREATE INDEX "content_reports_target_id_idx" ON "content_reports" USING btree ("target_id");
  CREATE INDEX "content_reports_review_idx" ON "content_reports" USING btree ("review_id");
  CREATE INDEX "content_reports_reporter_idx" ON "content_reports" USING btree ("reporter_id");
  CREATE INDEX "content_reports_target_user_idx" ON "content_reports" USING btree ("target_user_id");
  CREATE INDEX "content_reports_status_idx" ON "content_reports" USING btree ("status");
  CREATE INDEX "content_reports_updated_at_idx" ON "content_reports" USING btree ("updated_at");
  CREATE INDEX "content_reports_created_at_idx" ON "content_reports" USING btree ("created_at");
  CREATE UNIQUE INDEX "targetType_targetId_reporter_idx" ON "content_reports" USING btree ("target_type","target_id","reporter_id");
  CREATE INDEX "group_buy_order_claims_article_idx" ON "group_buy_order_claims" USING btree ("article_id");
  CREATE INDEX "group_buy_order_claims_order_number_idx" ON "group_buy_order_claims" USING btree ("order_number");
  CREATE INDEX "group_buy_order_claims_user_idx" ON "group_buy_order_claims" USING btree ("user_id");
  CREATE INDEX "group_buy_order_claims_updated_at_idx" ON "group_buy_order_claims" USING btree ("updated_at");
  CREATE INDEX "group_buy_order_claims_created_at_idx" ON "group_buy_order_claims" USING btree ("created_at");
  CREATE UNIQUE INDEX "article_orderNumber_idx" ON "group_buy_order_claims" USING btree ("article_id","order_number");
  CREATE INDEX "travel_read_rewards_user_idx" ON "travel_read_rewards" USING btree ("user_id");
  CREATE INDEX "travel_read_rewards_article_id_idx" ON "travel_read_rewards" USING btree ("article_id");
  CREATE INDEX "travel_read_rewards_updated_at_idx" ON "travel_read_rewards" USING btree ("updated_at");
  CREATE INDEX "travel_read_rewards_created_at_idx" ON "travel_read_rewards" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_articleId_idx" ON "travel_read_rewards" USING btree ("user_id","article_id");
  CREATE INDEX "step_daily_records_user_idx" ON "step_daily_records" USING btree ("user_id");
  CREATE INDEX "step_daily_records_date_idx" ON "step_daily_records" USING btree ("date");
  CREATE INDEX "step_daily_records_updated_at_idx" ON "step_daily_records" USING btree ("updated_at");
  CREATE INDEX "step_daily_records_created_at_idx" ON "step_daily_records" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_date_idx" ON "step_daily_records" USING btree ("user_id","date");
  CREATE INDEX "step_weekly_records_user_idx" ON "step_weekly_records" USING btree ("user_id");
  CREATE INDEX "step_weekly_records_week_id_idx" ON "step_weekly_records" USING btree ("week_id");
  CREATE INDEX "step_weekly_records_updated_at_idx" ON "step_weekly_records" USING btree ("updated_at");
  CREATE INDEX "step_weekly_records_created_at_idx" ON "step_weekly_records" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_weekId_idx" ON "step_weekly_records" USING btree ("user_id","week_id");
  CREATE INDEX "app_activity_settings_group_buy_share_banned_words_order_idx" ON "app_activity_settings_group_buy_share_banned_words" USING btree ("_order");
  CREATE INDEX "app_activity_settings_group_buy_share_banned_words_parent_id_idx" ON "app_activity_settings_group_buy_share_banned_words" USING btree ("_parent_id");
  CREATE INDEX "app_activity_settings_step_challenge_daily_milestones_order_idx" ON "app_activity_settings_step_challenge_daily_milestones" USING btree ("_order");
  CREATE INDEX "app_activity_settings_step_challenge_daily_milestones_parent_id_idx" ON "app_activity_settings_step_challenge_daily_milestones" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_group_buy_shares_fk" FOREIGN KEY ("group_buy_shares_id") REFERENCES "public"."group_buy_shares"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_group_buy_share_comments_fk" FOREIGN KEY ("group_buy_share_comments_id") REFERENCES "public"."group_buy_share_comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_reports_fk" FOREIGN KEY ("content_reports_id") REFERENCES "public"."content_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_group_buy_order_claims_fk" FOREIGN KEY ("group_buy_order_claims_id") REFERENCES "public"."group_buy_order_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_travel_read_rewards_fk" FOREIGN KEY ("travel_read_rewards_id") REFERENCES "public"."travel_read_rewards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_step_daily_records_fk" FOREIGN KEY ("step_daily_records_id") REFERENCES "public"."step_daily_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_step_weekly_records_fk" FOREIGN KEY ("step_weekly_records_id") REFERENCES "public"."step_weekly_records"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_group_buy_shares_id_idx" ON "payload_locked_documents_rels" USING btree ("group_buy_shares_id");
  CREATE INDEX "payload_locked_documents_rels_group_buy_share_comments_i_idx" ON "payload_locked_documents_rels" USING btree ("group_buy_share_comments_id");
  CREATE INDEX "payload_locked_documents_rels_content_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("content_reports_id");
  CREATE INDEX "payload_locked_documents_rels_group_buy_order_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("group_buy_order_claims_id");
  CREATE INDEX "payload_locked_documents_rels_travel_read_rewards_id_idx" ON "payload_locked_documents_rels" USING btree ("travel_read_rewards_id");
  CREATE INDEX "payload_locked_documents_rels_step_daily_records_id_idx" ON "payload_locked_documents_rels" USING btree ("step_daily_records_id");
  CREATE INDEX "payload_locked_documents_rels_step_weekly_records_id_idx" ON "payload_locked_documents_rels" USING btree ("step_weekly_records_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 先拆 rels 端的 FK/index/column，再砍表 —— 順序反過來會報 constraint 不存在
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_group_buy_shares_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_group_buy_shares_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "group_buy_shares_id";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_group_buy_share_comments_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_group_buy_share_comments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "group_buy_share_comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_content_reports_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_content_reports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "content_reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_group_buy_order_claims_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_group_buy_order_claims_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "group_buy_order_claims_id";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_travel_read_rewards_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_travel_read_rewards_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "travel_read_rewards_id";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_step_daily_records_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_step_daily_records_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "step_daily_records_id";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_step_weekly_records_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_step_weekly_records_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "step_weekly_records_id";
  DROP TABLE IF EXISTS "group_buy_shares_photos" CASCADE;
  DROP TABLE IF EXISTS "group_buy_shares" CASCADE;
  DROP TABLE IF EXISTS "group_buy_share_comments" CASCADE;
  DROP TABLE IF EXISTS "content_reports" CASCADE;
  DROP TABLE IF EXISTS "group_buy_order_claims" CASCADE;
  DROP TABLE IF EXISTS "travel_read_rewards" CASCADE;
  DROP TABLE IF EXISTS "step_daily_records" CASCADE;
  DROP TABLE IF EXISTS "step_weekly_records" CASCADE;
  DROP TABLE IF EXISTS "app_activity_settings_group_buy_share_banned_words" CASCADE;
  DROP TABLE IF EXISTS "app_activity_settings_step_challenge_daily_milestones" CASCADE;
  DROP TABLE IF EXISTS "app_activity_settings" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_group_buy_shares_status";
  DROP TYPE IF EXISTS "public"."enum_group_buy_share_comments_status";
  DROP TYPE IF EXISTS "public"."enum_content_reports_target_type";
  DROP TYPE IF EXISTS "public"."enum_content_reports_reason";
  DROP TYPE IF EXISTS "public"."enum_content_reports_status";`)
}
