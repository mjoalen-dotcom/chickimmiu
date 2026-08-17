import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_promotion_rules_effect_reward_type" AS ENUM('free_shipping_coupon', 'movie_ticket_physical', 'movie_ticket_digital', 'coupon', 'gift_physical', 'badge', 'voucher');
  ALTER TABLE "promotion_rules" ADD COLUMN "effect_reward_type" "enum_promotion_rules_effect_reward_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "promotion_rules" DROP COLUMN "effect_reward_type";
  DROP TYPE "public"."enum_promotion_rules_effect_reward_type";`)
}
