import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Meta Catalog 即時推送熔斷 / 停用開關（2026-08-24）— 兩個純加欄。
 *
 *   meta_catalog_push_enabled  即時推送總開關（NULL = 沿用既有行為 = 開）
 *   meta_last_push_status      最近一次推送結果／熔斷原因，給後台看的唯讀欄位
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ads_catalog_settings" ADD COLUMN IF NOT EXISTS "meta_catalog_push_enabled" boolean DEFAULT true;`)
  await db.execute(sql`
   ALTER TABLE "ads_catalog_settings" ADD COLUMN IF NOT EXISTS "meta_last_push_status" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ads_catalog_settings" DROP COLUMN IF EXISTS "meta_catalog_push_enabled";`)
  await db.execute(sql`
   ALTER TABLE "ads_catalog_settings" DROP COLUMN IF EXISTS "meta_last_push_status";`)
}
