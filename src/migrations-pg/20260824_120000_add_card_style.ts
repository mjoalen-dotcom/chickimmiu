import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 商品卡風格開關（2026-08-24 Alan：LV 極簡卡改為後台可切換的新功能，
 * 預設維持原經典設計）— product-list-settings.cardStyle
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_product_list_settings_card_style" AS ENUM('classic', 'minimal');
  ALTER TABLE "product_list_settings" ADD COLUMN IF NOT EXISTS "card_style" "enum_product_list_settings_card_style" DEFAULT 'classic';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "product_list_settings" DROP COLUMN IF EXISTS "card_style";
  DROP TYPE "public"."enum_product_list_settings_card_style";`)
}
