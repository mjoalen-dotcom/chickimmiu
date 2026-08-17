import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN "promotion_items_cost_snapshot" numeric;
  ALTER TABLE "orders" ADD COLUMN "promotion_cost_data_complete" boolean;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN "promotion_items_cost_snapshot";
  ALTER TABLE "orders" DROP COLUMN "promotion_cost_data_complete";`)
}
