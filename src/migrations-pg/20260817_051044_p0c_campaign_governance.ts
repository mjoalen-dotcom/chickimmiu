import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_campaign_activities_type" AS ENUM('status_change', 'budget_change', 'kill_switch', 'approval', 'settings_change');
  CREATE TABLE "campaign_activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"campaign_id" integer NOT NULL,
  	"type" "enum_campaign_activities_type" NOT NULL,
  	"actor_id" integer,
  	"from_status" varchar,
  	"to_status" varchar,
  	"is_override" boolean,
  	"summary" varchar,
  	"reason" varchar,
  	"changes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "marketing_campaigns" ADD COLUMN "status_override" boolean DEFAULT false;
  ALTER TABLE "marketing_campaigns" ADD COLUMN "status_override_reason" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaign_activities_id" integer;
  ALTER TABLE "promotion_settings" ADD COLUMN "require_separate_approver" boolean DEFAULT false;
  ALTER TABLE "campaign_activities" ADD CONSTRAINT "campaign_activities_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_activities" ADD CONSTRAINT "campaign_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "campaign_activities_campaign_idx" ON "campaign_activities" USING btree ("campaign_id");
  CREATE INDEX "campaign_activities_actor_idx" ON "campaign_activities" USING btree ("actor_id");
  CREATE INDEX "campaign_activities_updated_at_idx" ON "campaign_activities" USING btree ("updated_at");
  CREATE INDEX "campaign_activities_created_at_idx" ON "campaign_activities" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_activities_fk" FOREIGN KEY ("campaign_activities_id") REFERENCES "public"."campaign_activities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_campaign_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("campaign_activities_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_activities" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "campaign_activities" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaign_activities_fk";
  
  DROP INDEX "payload_locked_documents_rels_campaign_activities_id_idx";
  ALTER TABLE "marketing_campaigns" DROP COLUMN "status_override";
  ALTER TABLE "marketing_campaigns" DROP COLUMN "status_override_reason";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaign_activities_id";
  ALTER TABLE "promotion_settings" DROP COLUMN "require_separate_approver";
  DROP TYPE "public"."enum_campaign_activities_type";`)
}
