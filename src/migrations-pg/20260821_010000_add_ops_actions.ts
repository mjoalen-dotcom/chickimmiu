import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 營運 AI 助理 — OpsActions collection（PostgreSQL 版）
 * ─────────────────────────────────────────────────────
 * SQLite 版是 src/migrations/20260806_010000_add_ops_actions.ts（本地 dev /
 * verify DB 用）。該版寫於 2026-08-06，PG 切換（08-16）之前，方言不相容
 * （PRAGMA / sqlite_master / db.run），不能直接搬——這支是對應的 PG 版，
 * schema 與 Payload postgresAdapter 對 OpsActions collection 的期望一致：
 *   - select 欄位 → enum type（enum_ops_actions_*）
 *   - json 欄位（input / previewSnapshot / affected）→ jsonb
 *   - decidedBy relationship → decided_by_id integer FK → users.id
 *   - status / action_type / source_signal_id 有 index（待辦清單與日報去重常用）
 *
 * Pattern 承襲 20260817_051044_p0c_campaign_governance.ts。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ops_actions_action_type" AS ENUM('create_purchase_order', 'adjust_product_price', 'create_coupon', 'send_member_dm', 'flag_credit_review');
  CREATE TYPE "public"."enum_ops_actions_risk" AS ENUM('low', 'high');
  CREATE TYPE "public"."enum_ops_actions_status" AS ENUM('pending', 'executed', 'failed', 'rejected', 'expired');
  CREATE TABLE "ops_actions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar NOT NULL,
  	"action_type" "enum_ops_actions_action_type" NOT NULL,
  	"risk" "enum_ops_actions_risk" DEFAULT 'low',
  	"status" "enum_ops_actions_status" DEFAULT 'pending' NOT NULL,
  	"input" jsonb NOT NULL,
  	"source_signal_id" varchar,
  	"preview_snapshot" jsonb,
  	"result_message" varchar,
  	"affected" jsonb,
  	"error" varchar,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ops_actions_id" integer;
  ALTER TABLE "ops_actions" ADD CONSTRAINT "ops_actions_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ops_actions_action_type_idx" ON "ops_actions" USING btree ("action_type");
  CREATE INDEX "ops_actions_status_idx" ON "ops_actions" USING btree ("status");
  CREATE INDEX "ops_actions_source_signal_id_idx" ON "ops_actions" USING btree ("source_signal_id");
  CREATE INDEX "ops_actions_decided_by_idx" ON "ops_actions" USING btree ("decided_by_id");
  CREATE INDEX "ops_actions_updated_at_idx" ON "ops_actions" USING btree ("updated_at");
  CREATE INDEX "ops_actions_created_at_idx" ON "ops_actions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ops_actions_fk" FOREIGN KEY ("ops_actions_id") REFERENCES "public"."ops_actions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ops_actions_id_idx" ON "payload_locked_documents_rels" USING btree ("ops_actions_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // ⚠️ 順序與 p0c 範本不同（那份先 DROP TABLE CASCADE 再 DROP CONSTRAINT，
  // 但 CASCADE 已把 rels 上的 FK 一起帶走，第二句會報 constraint 不存在）。
  // 這裡先拆 rels 端再砍表——2026-08-21 已在 Hetzner PG16 scratch DB 實跑過 up+down。
  await db.execute(sql`
   ALTER TABLE "ops_actions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ops_actions_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_ops_actions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "ops_actions_id";
  DROP TABLE "ops_actions" CASCADE;
  DROP TYPE "public"."enum_ops_actions_action_type";
  DROP TYPE "public"."enum_ops_actions_risk";
  DROP TYPE "public"."enum_ops_actions_status";`)
}
