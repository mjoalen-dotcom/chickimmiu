import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P0-B 收尾（B/2）：新表 promotion_drop_claims + 各表新欄位。
 *
 * 與 A 分開的理由見 _p0b_drop_enums 的檔頭：PG16 在同一個 transaction 內
 * 不可使用剛加進 enum 的新值，而 payload 的 migrate 把 up() 包在 transaction 裡。
 * 這支裡面 promotion_rules 的新欄位並不使用那些 enum 值（effect_type 欄位本身
 * 早就存在），所以是安全的 —— 但兩支仍必須依序執行。
 *
 * 設計重點：
 * - `idempotency_key` 的 UNIQUE index 是「每人每檔活動 1 次」的唯一真防線。
 *   evaluator 的 perUserLimit 只是報價期的軟檢查（有 TOCTOU）。
 * - `user_id` 是 NOT NULL：PG 的 unique index **不擋 NULL**，允許 NULL 等於
 *   讓訪客可以無限插同一個 key，約束形同虛設。本功能因此限登入會員。
 * - quota 計數（commerce_drop_total / commerce_drop_claimed）掛在
 *   marketing_campaigns 而不是 promotion_rules：規則 status=active 之後
 *   effect 欄位會被 hook 鎖住，掛規則上的話上線後想加碼就動不了。
 *   代價是一檔活動只能有一條限量規則（已在 beforeValidate 擋住）。
 * - promotion_applications.budget_cost_amount：預算預留讀的是訂單上的快照，
 *   但回沖讀的是這一欄。只改快照不加這欄 = 扣得到、退不回的單向漏預算。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_promotion_drop_claims_status" AS ENUM('reserved', 'granted', 'reversed');
  CREATE TABLE "promotion_drop_claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"campaign_id" integer,
  	"rule_id" integer,
  	"rule_key" varchar NOT NULL,
  	"effect_type" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"order_id" integer,
  	"status" "enum_promotion_drop_claims_status" DEFAULT 'reserved' NOT NULL,
  	"budget_cost_amount" numeric DEFAULT 0,
  	"quota_consumed" boolean DEFAULT false,
  	"prize_pool_id" integer,
  	"granted_reward_id" integer,
  	"coupon_id" integer,
  	"granted_at" timestamp(3) with time zone,
  	"reversed_at" timestamp(3) with time zone,
  	"reversal_reason" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "marketing_campaigns" ADD COLUMN "commerce_drop_total" numeric;
  ALTER TABLE "marketing_campaigns" ADD COLUMN "commerce_drop_claimed" numeric DEFAULT 0;
  ALTER TABLE "promotion_applications" ADD COLUMN "budget_cost_amount" numeric DEFAULT 0;
  ALTER TABLE "promotion_rules" ADD COLUMN "effect_drop_coupon_id" integer;
  ALTER TABLE "promotion_rules" ADD COLUMN "effect_drop_quantity" numeric DEFAULT 1;
  ALTER TABLE "promotion_rules" ADD COLUMN "effect_fallback_prize_slug" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "promotion_drop_claims_id" integer;
  ALTER TABLE "promotion_drop_claims" ADD CONSTRAINT "promotion_drop_claims_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_drop_claims" ADD CONSTRAINT "promotion_drop_claims_rule_id_promotion_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."promotion_rules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_drop_claims" ADD CONSTRAINT "promotion_drop_claims_user_id_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_drop_claims" ADD CONSTRAINT "promotion_drop_claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_drop_claims" ADD CONSTRAINT "promotion_drop_claims_prize_pool_id_prize_pools_id_fk" FOREIGN KEY ("prize_pool_id") REFERENCES "public"."prize_pools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_drop_claims" ADD CONSTRAINT "promotion_drop_claims_granted_reward_id_user_rewards_id_fk" FOREIGN KEY ("granted_reward_id") REFERENCES "public"."user_rewards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_drop_claims" ADD CONSTRAINT "promotion_drop_claims_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "promotion_drop_claims_idempotency_key_idx" ON "promotion_drop_claims" USING btree ("idempotency_key");
  CREATE INDEX "promotion_drop_claims_rule_key_idx" ON "promotion_drop_claims" USING btree ("rule_key");
  CREATE INDEX "promotion_drop_claims_user_idx" ON "promotion_drop_claims" USING btree ("user_id");
  CREATE INDEX "promotion_drop_claims_order_idx" ON "promotion_drop_claims" USING btree ("order_id");
  CREATE INDEX "promotion_drop_claims_campaign_idx" ON "promotion_drop_claims" USING btree ("campaign_id");
  CREATE INDEX "promotion_drop_claims_rule_idx" ON "promotion_drop_claims" USING btree ("rule_id");
  CREATE INDEX "promotion_drop_claims_prize_pool_idx" ON "promotion_drop_claims" USING btree ("prize_pool_id");
  CREATE INDEX "promotion_drop_claims_granted_reward_idx" ON "promotion_drop_claims" USING btree ("granted_reward_id");
  CREATE INDEX "promotion_drop_claims_coupon_idx" ON "promotion_drop_claims" USING btree ("coupon_id");
  CREATE INDEX "promotion_drop_claims_updated_at_idx" ON "promotion_drop_claims" USING btree ("updated_at");
  CREATE INDEX "promotion_drop_claims_created_at_idx" ON "promotion_drop_claims" USING btree ("created_at");
  ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_effect_drop_coupon_id_coupons_id_fk" FOREIGN KEY ("effect_drop_coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "promotion_rules_effect_effect_drop_coupon_idx" ON "promotion_rules" USING btree ("effect_drop_coupon_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotion_drop_claims_fk" FOREIGN KEY ("promotion_drop_claims_id") REFERENCES "public"."promotion_drop_claims"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_promotion_drop_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("promotion_drop_claims_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "promotion_drop_claims" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "promotion_drop_claims" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_promotion_drop_claims_fk";
  ALTER TABLE "promotion_rules" DROP CONSTRAINT IF EXISTS "promotion_rules_effect_drop_coupon_id_coupons_id_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_promotion_drop_claims_id_idx";
  DROP INDEX IF EXISTS "promotion_rules_effect_effect_drop_coupon_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "promotion_drop_claims_id";
  ALTER TABLE "marketing_campaigns" DROP COLUMN IF EXISTS "commerce_drop_total";
  ALTER TABLE "marketing_campaigns" DROP COLUMN IF EXISTS "commerce_drop_claimed";
  ALTER TABLE "promotion_applications" DROP COLUMN IF EXISTS "budget_cost_amount";
  ALTER TABLE "promotion_rules" DROP COLUMN IF EXISTS "effect_drop_coupon_id";
  ALTER TABLE "promotion_rules" DROP COLUMN IF EXISTS "effect_drop_quantity";
  ALTER TABLE "promotion_rules" DROP COLUMN IF EXISTS "effect_fallback_prize_slug";
  DROP TYPE "public"."enum_promotion_drop_claims_status";`)
}
