import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_social_wall_connections_provider" AS ENUM('instagram');
  CREATE TYPE "public"."enum_social_wall_connections_status" AS ENUM('pending', 'active', 'expired', 'revoked', 'error');
  CREATE TYPE "public"."enum_social_wall_widgets_status" AS ENUM('draft', 'published', 'suspended', 'archived');
  CREATE TYPE "public"."enum_social_wall_widgets_appearance_layout" AS ENUM('grid', 'carousel');
  CREATE TYPE "public"."enum_social_wall_widgets_appearance_theme" AS ENUM('light', 'sand', 'dark');
  CREATE TYPE "public"."enum_social_wall_subscriptions_plan" AS ENUM('free', 'creator', 'pro', 'agency');
  CREATE TYPE "public"."enum_social_wall_subscriptions_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'expired');
  CREATE TYPE "public"."enum_social_wall_subscriptions_billing_cycle" AS ENUM('monthly', 'yearly');
  CREATE TYPE "public"."enum_social_wall_subscriptions_payment_provider" AS ENUM('manual', 'ecpay');
  CREATE TYPE "public"."enum_social_wall_licenses_status" AS ENUM('active', 'suspended', 'revoked', 'expired');
  CREATE TABLE "social_wall_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"provider" "enum_social_wall_connections_provider" DEFAULT 'instagram' NOT NULL,
	"external_account_id" varchar NOT NULL,
	"username" varchar NOT NULL,
	"display_name" varchar,
	"profile_picture_url" varchar,
	"status" "enum_social_wall_connections_status" DEFAULT 'pending' NOT NULL,
	"token_reference" varchar,
	"token_expires_at" timestamp(3) with time zone,
	"last_synced_at" timestamp(3) with time zone,
	"next_sync_at" timestamp(3) with time zone,
	"last_error" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "social_wall_widgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"connection_id" integer NOT NULL,
	"name" varchar NOT NULL,
	"public_id" varchar NOT NULL,
	"status" "enum_social_wall_widgets_status" DEFAULT 'draft' NOT NULL,
	"appearance_layout" "enum_social_wall_widgets_appearance_layout" DEFAULT 'grid' NOT NULL,
	"appearance_columns" numeric DEFAULT 3 NOT NULL,
	"appearance_gap" numeric DEFAULT 12 NOT NULL,
	"appearance_radius" numeric DEFAULT 16 NOT NULL,
	"appearance_theme" "enum_social_wall_widgets_appearance_theme" DEFAULT 'light' NOT NULL,
	"appearance_show_caption" boolean DEFAULT true,
	"appearance_show_stats" boolean DEFAULT true,
	"max_posts" numeric DEFAULT 12 NOT NULL,
	"published_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "social_wall_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"plan" "enum_social_wall_subscriptions_plan" DEFAULT 'free' NOT NULL,
	"status" "enum_social_wall_subscriptions_status" DEFAULT 'active' NOT NULL,
	"billing_cycle" "enum_social_wall_subscriptions_billing_cycle" DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp(3) with time zone,
	"current_period_end" timestamp(3) with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"price_twd" numeric DEFAULT 0 NOT NULL,
	"payment_provider" "enum_social_wall_subscriptions_payment_provider" DEFAULT 'manual' NOT NULL,
	"last_payment_at" timestamp(3) with time zone,
	"provider_subscription_ref" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "social_wall_licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"widget_id" integer NOT NULL,
	"host_pattern" varchar NOT NULL,
	"status" "enum_social_wall_licenses_status" DEFAULT 'active' NOT NULL,
	"license_key_hash" varchar,
	"issued_at" timestamp(3) with time zone NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "social_wall_usage_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"widget_id" integer NOT NULL,
	"date" varchar NOT NULL,
	"successful_loads" numeric DEFAULT 0 NOT NULL,
	"denied_loads" numeric DEFAULT 0 NOT NULL,
	"unique_host_count" numeric DEFAULT 0 NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "social_wall_connections_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "social_wall_widgets_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "social_wall_subscriptions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "social_wall_licenses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "social_wall_usage_daily_id" integer;
  ALTER TABLE "social_wall_connections" ADD CONSTRAINT "social_wall_connections_owner_id_customers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_wall_widgets" ADD CONSTRAINT "social_wall_widgets_owner_id_customers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_wall_widgets" ADD CONSTRAINT "social_wall_widgets_connection_id_social_wall_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."social_wall_connections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_wall_subscriptions" ADD CONSTRAINT "social_wall_subscriptions_owner_id_customers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_wall_licenses" ADD CONSTRAINT "social_wall_licenses_owner_id_customers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_wall_licenses" ADD CONSTRAINT "social_wall_licenses_widget_id_social_wall_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."social_wall_widgets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_wall_usage_daily" ADD CONSTRAINT "social_wall_usage_daily_owner_id_customers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_wall_usage_daily" ADD CONSTRAINT "social_wall_usage_daily_widget_id_social_wall_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."social_wall_widgets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "social_wall_connections_owner_idx" ON "social_wall_connections" USING btree ("owner_id");
  CREATE INDEX "social_wall_connections_external_account_id_idx" ON "social_wall_connections" USING btree ("external_account_id");
  CREATE INDEX "social_wall_connections_status_idx" ON "social_wall_connections" USING btree ("status");
  CREATE INDEX "social_wall_connections_updated_at_idx" ON "social_wall_connections" USING btree ("updated_at");
  CREATE INDEX "social_wall_connections_created_at_idx" ON "social_wall_connections" USING btree ("created_at");
  CREATE INDEX "social_wall_widgets_owner_idx" ON "social_wall_widgets" USING btree ("owner_id");
  CREATE INDEX "social_wall_widgets_connection_idx" ON "social_wall_widgets" USING btree ("connection_id");
  CREATE UNIQUE INDEX "social_wall_widgets_public_id_idx" ON "social_wall_widgets" USING btree ("public_id");
  CREATE INDEX "social_wall_widgets_status_idx" ON "social_wall_widgets" USING btree ("status");
  CREATE INDEX "social_wall_widgets_updated_at_idx" ON "social_wall_widgets" USING btree ("updated_at");
  CREATE INDEX "social_wall_widgets_created_at_idx" ON "social_wall_widgets" USING btree ("created_at");
  CREATE UNIQUE INDEX "social_wall_subscriptions_owner_idx" ON "social_wall_subscriptions" USING btree ("owner_id");
  CREATE INDEX "social_wall_subscriptions_status_idx" ON "social_wall_subscriptions" USING btree ("status");
  CREATE INDEX "social_wall_subscriptions_current_period_end_idx" ON "social_wall_subscriptions" USING btree ("current_period_end");
  CREATE INDEX "social_wall_subscriptions_updated_at_idx" ON "social_wall_subscriptions" USING btree ("updated_at");
  CREATE INDEX "social_wall_subscriptions_created_at_idx" ON "social_wall_subscriptions" USING btree ("created_at");
  CREATE INDEX "social_wall_licenses_owner_idx" ON "social_wall_licenses" USING btree ("owner_id");
  CREATE INDEX "social_wall_licenses_widget_idx" ON "social_wall_licenses" USING btree ("widget_id");
  CREATE INDEX "social_wall_licenses_host_pattern_idx" ON "social_wall_licenses" USING btree ("host_pattern");
  CREATE INDEX "social_wall_licenses_status_idx" ON "social_wall_licenses" USING btree ("status");
  CREATE INDEX "social_wall_licenses_expires_at_idx" ON "social_wall_licenses" USING btree ("expires_at");
  CREATE INDEX "social_wall_licenses_updated_at_idx" ON "social_wall_licenses" USING btree ("updated_at");
  CREATE INDEX "social_wall_licenses_created_at_idx" ON "social_wall_licenses" USING btree ("created_at");
  CREATE INDEX "social_wall_usage_daily_owner_idx" ON "social_wall_usage_daily" USING btree ("owner_id");
  CREATE INDEX "social_wall_usage_daily_widget_idx" ON "social_wall_usage_daily" USING btree ("widget_id");
  CREATE INDEX "social_wall_usage_daily_date_idx" ON "social_wall_usage_daily" USING btree ("date");
  CREATE INDEX "social_wall_usage_daily_updated_at_idx" ON "social_wall_usage_daily" USING btree ("updated_at");
  CREATE INDEX "social_wall_usage_daily_created_at_idx" ON "social_wall_usage_daily" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_social_wall_connections_fk" FOREIGN KEY ("social_wall_connections_id") REFERENCES "public"."social_wall_connections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_social_wall_widgets_fk" FOREIGN KEY ("social_wall_widgets_id") REFERENCES "public"."social_wall_widgets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_social_wall_subscriptions_fk" FOREIGN KEY ("social_wall_subscriptions_id") REFERENCES "public"."social_wall_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_social_wall_licenses_fk" FOREIGN KEY ("social_wall_licenses_id") REFERENCES "public"."social_wall_licenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_social_wall_usage_daily_fk" FOREIGN KEY ("social_wall_usage_daily_id") REFERENCES "public"."social_wall_usage_daily"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_social_wall_connections_id_idx" ON "payload_locked_documents_rels" USING btree ("social_wall_connections_id");
  CREATE INDEX "payload_locked_documents_rels_social_wall_widgets_id_idx" ON "payload_locked_documents_rels" USING btree ("social_wall_widgets_id");
  CREATE INDEX "payload_locked_documents_rels_social_wall_subscriptions__idx" ON "payload_locked_documents_rels" USING btree ("social_wall_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_social_wall_licenses_id_idx" ON "payload_locked_documents_rels" USING btree ("social_wall_licenses_id");
  CREATE INDEX "payload_locked_documents_rels_social_wall_usage_daily_id_idx" ON "payload_locked_documents_rels" USING btree ("social_wall_usage_daily_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "social_wall_connections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "social_wall_widgets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "social_wall_subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "social_wall_licenses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "social_wall_usage_daily" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_social_wall_connections_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_social_wall_widgets_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_social_wall_subscriptions_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_social_wall_licenses_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_social_wall_usage_daily_fk";

  DROP INDEX "payload_locked_documents_rels_social_wall_connections_id_idx";
  DROP INDEX "payload_locked_documents_rels_social_wall_widgets_id_idx";
  DROP INDEX "payload_locked_documents_rels_social_wall_subscriptions__idx";
  DROP INDEX "payload_locked_documents_rels_social_wall_licenses_id_idx";
  DROP INDEX "payload_locked_documents_rels_social_wall_usage_daily_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "social_wall_connections_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "social_wall_widgets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "social_wall_subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "social_wall_licenses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "social_wall_usage_daily_id";
  DROP TABLE "social_wall_usage_daily" CASCADE;
  DROP TABLE "social_wall_licenses" CASCADE;
  DROP TABLE "social_wall_subscriptions" CASCADE;
  DROP TABLE "social_wall_widgets" CASCADE;
  DROP TABLE "social_wall_connections" CASCADE;
  DROP TYPE "public"."enum_social_wall_connections_provider";
  DROP TYPE "public"."enum_social_wall_connections_status";
  DROP TYPE "public"."enum_social_wall_widgets_status";
  DROP TYPE "public"."enum_social_wall_widgets_appearance_layout";
  DROP TYPE "public"."enum_social_wall_widgets_appearance_theme";
  DROP TYPE "public"."enum_social_wall_subscriptions_plan";
  DROP TYPE "public"."enum_social_wall_subscriptions_status";
  DROP TYPE "public"."enum_social_wall_subscriptions_billing_cycle";
  DROP TYPE "public"."enum_social_wall_subscriptions_payment_provider";
  DROP TYPE "public"."enum_social_wall_licenses_status";`)
}
