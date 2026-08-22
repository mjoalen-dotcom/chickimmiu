import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 會員訊息信箱 v1 — Notifications collection（PostgreSQL 版）
 * ─────────────────────────────────────────────────────────
 * DB 已切 PostgreSQL（Alan 2026-08-22 確認），SQLite 鏈凍結不另寫 —
 * 本地 SQLite dev 由 scripts/dev-sync-sqlite-schema.ts 補表。
 *
 * Schema 與 postgresAdapter 對 Notifications collection 的期望一致：
 *   - category select → enum_notifications_category
 *   - recipient relationship → recipient_id integer FK → customers.id
 *     （ON DELETE cascade：會員刪除連通知一起清）
 *   - meta json → jsonb
 *   - recipient / category / read_at 有 index（信箱列表 + 未讀數常用）
 *
 * Pattern 承襲 20260821_010000_add_ops_actions.ts（down 先拆 rels 再砍表）。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_notifications_category" AS ENUM('order', 'points', 'promo', 'blog', 'system');
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"recipient_id" integer NOT NULL,
  	"category" "enum_notifications_category" DEFAULT 'system' NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"link" varchar,
  	"read_at" timestamp(3) with time zone,
  	"push_sent_at" timestamp(3) with time zone,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notifications_id" integer;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_customers_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");
  CREATE INDEX "notifications_category_idx" ON "notifications" USING btree ("category");
  CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // down 順序：先拆 rels 端 FK/欄位，再砍表與 enum（ops_actions 已在
  // PG16 scratch 實證過此順序；反過來 CASCADE 會讓第二句報 constraint 不存在）
  await db.execute(sql`
   ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_notifications_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_notifications_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "notifications_id";
  DROP TABLE "notifications" CASCADE;
  DROP TYPE "public"."enum_notifications_category";`)
}
