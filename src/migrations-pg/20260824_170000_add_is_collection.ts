import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 精選企劃策展層（2026-08-24 P2）— categories.is_collection 純加欄。
 * 企劃分類不進主導覽，商品經 additionalCategories 掛入（PLP 篩選本就支援）。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "is_collection" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" DROP COLUMN IF EXISTS "is_collection";`)
}
