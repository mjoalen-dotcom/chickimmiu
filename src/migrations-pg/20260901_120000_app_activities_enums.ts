import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * App 專屬三項活動（工單 2026-08-25）— 第 1 支：points-transactions source 新增 5 個值
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ 刻意與建表那支（20260901_120100）分開：PostgreSQL 的 ALTER TYPE ... ADD VALUE
 * 新增的值不能在同一個交易內被使用。本 repo 既有的 p0b_drop_enums / p0b_drop_schema
 * 就是同一個理由拆兩支，順序不可對調。
 *
 * down 無法還原：PostgreSQL 沒有 ALTER TYPE ... DROP VALUE。留著多餘的 enum 值無害
 * （沒有資料引用它們），故 down 為 no-op。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_points_transactions_source" ADD VALUE 'travel_article_read';
  ALTER TYPE "public"."enum_points_transactions_source" ADD VALUE 'step_activity';
  ALTER TYPE "public"."enum_points_transactions_source" ADD VALUE 'step_activity_weekly';
  ALTER TYPE "public"."enum_points_transactions_source" ADD VALUE 'product_review';
  ALTER TYPE "public"."enum_points_transactions_source" ADD VALUE 'product_review_featured';`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // no-op：PostgreSQL 不支援移除 enum 值
}
