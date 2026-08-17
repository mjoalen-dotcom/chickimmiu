import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_customers_gender" AS ENUM('female', 'male', 'other');
  CREATE TYPE "public"."enum_customers_signup_source" AS ENUM('shopline', 'organic', 'line', 'facebook', 'google', 'referral', 'admin', 'app');
  CREATE TYPE "public"."enum_customers_credit_status" AS ENUM('excellent', 'normal', 'watchlist', 'warning', 'blacklist', 'suspended');
  CREATE TYPE "public"."enum_customers_service_level" AS ENUM('standard', 'priority', 'vip');
  CREATE TYPE "public"."enum_customers_body_profile_body_shape" AS ENUM('petite', 'standard', 'curvy', 'pear', 'apple', 'hourglass', 'athletic');
  CREATE TYPE "public"."enum_customers_mbti_profile_mbti_type" AS ENUM('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP');
  CREATE TYPE "public"."enum_customers_mbti_profile_primary_occasion" AS ENUM('urban', 'vacation', 'party', 'cozy');
  CREATE TYPE "public"."enum_customers_ai_dm_preferences_dm_channel" AS ENUM('email', 'line', 'sms', 'all');
  CREATE TYPE "public"."enum_promotion_rules_conditions_segments_in" AS ENUM('VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1');
  CREATE TABLE "customers_invoice_profiles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"profile_name" varchar NOT NULL,
  	"invoice_title" varchar NOT NULL,
  	"tax_id" varchar,
  	"invoice_contact_name" varchar,
  	"invoice_phone" varchar,
  	"invoice_address" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "customers_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "customers_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"recipient_name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"zip_code" varchar,
  	"city" varchar NOT NULL,
  	"district" varchar,
  	"address" varchar NOT NULL,
  	"is_default" boolean DEFAULT false
  );
  
  CREATE TABLE "customers_game_activity_recent_games" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"game_name" varchar,
  	"result" varchar,
  	"reward" varchar,
  	"played_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers_ai_dm_preferences_dm_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel" varchar,
  	"subject" varchar,
  	"status" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"opened_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"is_guest" boolean DEFAULT false,
  	"birthday" timestamp(3) with time zone,
  	"birth_time" varchar,
  	"gender" "enum_customers_gender",
  	"avatar_id" integer,
  	"invoice_info_invoice_title" varchar,
  	"invoice_info_tax_id" varchar,
  	"invoice_info_invoice_address" varchar,
  	"invoice_info_invoice_contact_name" varchar,
  	"invoice_info_invoice_phone" varchar,
  	"shopline_customer_id" varchar,
  	"signup_source" "enum_customers_signup_source",
  	"member_tier_id" integer,
  	"points" numeric DEFAULT 0,
  	"shopping_credit" numeric DEFAULT 0,
  	"total_spent" numeric DEFAULT 0,
  	"stored_value_balance" numeric DEFAULT 0,
  	"total_check_ins" numeric DEFAULT 0,
  	"consecutive_check_ins" numeric DEFAULT 0,
  	"last_check_in_date" varchar,
  	"subscription_status_email_subscribed" boolean DEFAULT true,
  	"subscription_status_sms_subscribed" boolean DEFAULT false,
  	"subscription_status_line_subscribed" boolean DEFAULT false,
  	"subscription_status_unsubscribed_at" timestamp(3) with time zone,
  	"membership_active_plan_id" integer,
  	"membership_active_subscription_id" integer,
  	"membership_valid_until" timestamp(3) with time zone,
  	"membership_streak_months" numeric DEFAULT 0,
  	"referral_code" varchar,
  	"referred_by_id" integer,
  	"registration_referral_rewarded" boolean DEFAULT false,
  	"credit_score" numeric DEFAULT 100,
  	"credit_status" "enum_customers_credit_status" DEFAULT 'excellent',
  	"service_level" "enum_customers_service_level" DEFAULT 'standard',
  	"is_blacklisted" boolean DEFAULT false,
  	"is_suspended" boolean DEFAULT false,
  	"blacklist_reason" varchar,
  	"vip_owner_id" integer,
  	"crm_note" varchar,
  	"preferred_category" varchar,
  	"preferred_size" varchar,
  	"preferred_color" varchar,
  	"body_profile_height" numeric,
  	"body_profile_weight" numeric,
  	"body_profile_body_shape" "enum_customers_body_profile_body_shape",
  	"body_profile_preferred_sizes" varchar,
  	"body_profile_foot_length" numeric,
  	"body_profile_bust" numeric,
  	"body_profile_waist" numeric,
  	"body_profile_hips" numeric,
  	"social_logins_google_id" varchar,
  	"social_logins_facebook_id" varchar,
  	"social_logins_line_id" varchar,
  	"social_logins_apple_id" varchar,
  	"line_uid" varchar,
  	"annual_spend" numeric DEFAULT 0,
  	"lifetime_spend" numeric DEFAULT 0,
  	"order_count" numeric DEFAULT 0,
  	"last_order_date" timestamp(3) with time zone,
  	"last_login_date" timestamp(3) with time zone,
  	"order_history_note" varchar,
  	"first_touch_attribution_utm_source" varchar,
  	"first_touch_attribution_utm_medium" varchar,
  	"first_touch_attribution_utm_campaign" varchar,
  	"first_touch_attribution_utm_term" varchar,
  	"first_touch_attribution_utm_content" varchar,
  	"first_touch_attribution_referrer" varchar,
  	"first_touch_attribution_landing_path" varchar,
  	"first_touch_attribution_captured_at" timestamp(3) with time zone,
  	"mbti_profile_mbti_type" "enum_customers_mbti_profile_mbti_type",
  	"mbti_profile_mbti_taken_at" timestamp(3) with time zone,
  	"mbti_profile_mbti_scores" jsonb,
  	"mbti_profile_primary_occasion" "enum_customers_mbti_profile_primary_occasion",
  	"mbti_profile_occasion_scores" jsonb,
  	"game_activity_total_games_played" numeric DEFAULT 0,
  	"game_activity_total_points_won" numeric DEFAULT 0,
  	"game_activity_favorite_game" varchar,
  	"game_terms_acceptance_accepted_at" timestamp(3) with time zone,
  	"game_terms_acceptance_accepted_version" varchar,
  	"game_terms_acceptance_adult_confirmed" boolean DEFAULT false,
  	"game_terms_acceptance_acceptance_ip" varchar,
  	"ai_dm_preferences_last_dm_sent_at" timestamp(3) with time zone,
  	"ai_dm_preferences_dm_channel" "enum_customers_ai_dm_preferences_dm_channel" DEFAULT 'email',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"_verified" boolean,
  	"_verificationtoken" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "promotion_rules_conditions_segments_in" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_promotion_rules_conditions_segments_in",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "promotion_rules_conditions_referral_codes_in" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar
  );
  
  ALTER TABLE "promotion_rules" ADD COLUMN "conditions_repeat_purchase_only" boolean DEFAULT false;
  ALTER TABLE "promotion_rules" ADD COLUMN "conditions_birthday_month_only" boolean DEFAULT false;
  ALTER TABLE "promotion_rules" ADD COLUMN "conditions_referral_required" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "customers_invoice_profiles" ADD CONSTRAINT "customers_invoice_profiles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_tags" ADD CONSTRAINT "customers_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_addresses" ADD CONSTRAINT "customers_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_game_activity_recent_games" ADD CONSTRAINT "customers_game_activity_recent_games_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_ai_dm_preferences_dm_history" ADD CONSTRAINT "customers_ai_dm_preferences_dm_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_sessions" ADD CONSTRAINT "customers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_member_tier_id_membership_tiers_id_fk" FOREIGN KEY ("member_tier_id") REFERENCES "public"."membership_tiers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_membership_active_plan_id_subscription_plans_id_fk" FOREIGN KEY ("membership_active_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_membership_active_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("membership_active_subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_id_customers_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_vip_owner_id_users_id_fk" FOREIGN KEY ("vip_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_rels" ADD CONSTRAINT "customers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_rels" ADD CONSTRAINT "customers_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_conditions_segments_in" ADD CONSTRAINT "promotion_rules_conditions_segments_in_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_conditions_referral_codes_in" ADD CONSTRAINT "promotion_rules_conditions_referral_codes_in_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "customers_invoice_profiles_order_idx" ON "customers_invoice_profiles" USING btree ("_order");
  CREATE INDEX "customers_invoice_profiles_parent_id_idx" ON "customers_invoice_profiles" USING btree ("_parent_id");
  CREATE INDEX "customers_tags_order_idx" ON "customers_tags" USING btree ("_order");
  CREATE INDEX "customers_tags_parent_id_idx" ON "customers_tags" USING btree ("_parent_id");
  CREATE INDEX "customers_addresses_order_idx" ON "customers_addresses" USING btree ("_order");
  CREATE INDEX "customers_addresses_parent_id_idx" ON "customers_addresses" USING btree ("_parent_id");
  CREATE INDEX "customers_game_activity_recent_games_order_idx" ON "customers_game_activity_recent_games" USING btree ("_order");
  CREATE INDEX "customers_game_activity_recent_games_parent_id_idx" ON "customers_game_activity_recent_games" USING btree ("_parent_id");
  CREATE INDEX "customers_ai_dm_preferences_dm_history_order_idx" ON "customers_ai_dm_preferences_dm_history" USING btree ("_order");
  CREATE INDEX "customers_ai_dm_preferences_dm_history_parent_id_idx" ON "customers_ai_dm_preferences_dm_history" USING btree ("_parent_id");
  CREATE INDEX "customers_sessions_order_idx" ON "customers_sessions" USING btree ("_order");
  CREATE INDEX "customers_sessions_parent_id_idx" ON "customers_sessions" USING btree ("_parent_id");
  CREATE INDEX "customers_avatar_idx" ON "customers" USING btree ("avatar_id");
  CREATE INDEX "customers_shopline_customer_id_idx" ON "customers" USING btree ("shopline_customer_id");
  CREATE INDEX "customers_member_tier_idx" ON "customers" USING btree ("member_tier_id");
  CREATE INDEX "customers_membership_membership_active_plan_idx" ON "customers" USING btree ("membership_active_plan_id");
  CREATE INDEX "customers_membership_membership_active_subscription_idx" ON "customers" USING btree ("membership_active_subscription_id");
  CREATE UNIQUE INDEX "customers_referral_code_idx" ON "customers" USING btree ("referral_code");
  CREATE INDEX "customers_referred_by_idx" ON "customers" USING btree ("referred_by_id");
  CREATE INDEX "customers_vip_owner_idx" ON "customers" USING btree ("vip_owner_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "customers_deleted_at_idx" ON "customers" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "customers_rels_order_idx" ON "customers_rels" USING btree ("order");
  CREATE INDEX "customers_rels_parent_idx" ON "customers_rels" USING btree ("parent_id");
  CREATE INDEX "customers_rels_path_idx" ON "customers_rels" USING btree ("path");
  CREATE INDEX "customers_rels_products_id_idx" ON "customers_rels" USING btree ("products_id");
  CREATE INDEX "promotion_rules_conditions_segments_in_order_idx" ON "promotion_rules_conditions_segments_in" USING btree ("order");
  CREATE INDEX "promotion_rules_conditions_segments_in_parent_idx" ON "promotion_rules_conditions_segments_in" USING btree ("parent_id");
  CREATE INDEX "promotion_rules_conditions_referral_codes_in_order_idx" ON "promotion_rules_conditions_referral_codes_in" USING btree ("_order");
  CREATE INDEX "promotion_rules_conditions_referral_codes_in_parent_id_idx" ON "promotion_rules_conditions_referral_codes_in" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customers_invoice_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_addresses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_game_activity_recent_games" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_ai_dm_preferences_dm_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promotion_rules_conditions_segments_in" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promotion_rules_conditions_referral_codes_in" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customers_invoice_profiles" CASCADE;
  DROP TABLE "customers_tags" CASCADE;
  DROP TABLE "customers_addresses" CASCADE;
  DROP TABLE "customers_game_activity_recent_games" CASCADE;
  DROP TABLE "customers_ai_dm_preferences_dm_history" CASCADE;
  DROP TABLE "customers_sessions" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "customers_rels" CASCADE;
  DROP TABLE "promotion_rules_conditions_segments_in" CASCADE;
  DROP TABLE "promotion_rules_conditions_referral_codes_in" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customers_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_customers_fk";
  
  DROP INDEX "payload_locked_documents_rels_customers_id_idx";
  DROP INDEX "payload_preferences_rels_customers_id_idx";
  ALTER TABLE "promotion_rules" DROP COLUMN "conditions_repeat_purchase_only";
  ALTER TABLE "promotion_rules" DROP COLUMN "conditions_birthday_month_only";
  ALTER TABLE "promotion_rules" DROP COLUMN "conditions_referral_required";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customers_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "customers_id";
  DROP TYPE "public"."enum_customers_gender";
  DROP TYPE "public"."enum_customers_signup_source";
  DROP TYPE "public"."enum_customers_credit_status";
  DROP TYPE "public"."enum_customers_service_level";
  DROP TYPE "public"."enum_customers_body_profile_body_shape";
  DROP TYPE "public"."enum_customers_mbti_profile_mbti_type";
  DROP TYPE "public"."enum_customers_mbti_profile_primary_occasion";
  DROP TYPE "public"."enum_customers_ai_dm_preferences_dm_channel";
  DROP TYPE "public"."enum_promotion_rules_conditions_segments_in";`)
}
