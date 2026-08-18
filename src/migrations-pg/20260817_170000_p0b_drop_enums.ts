import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P0-B 收尾（A/2）：只做 ALTER TYPE ADD VALUE，什麼都不使用。
 *
 * 🔥 為什麼必須單獨成一支、而且刻意什麼都不做：
 * @payloadcms/drizzle 的 migrate 把 up() 整個包在一個 transaction 裡。PG 16
 * 允許在 transaction 內 ALTER TYPE ADD VALUE，但**新加的值在該 transaction
 * commit 之前不可以被使用**（這個限制到 PG 17 才放寬）。違反會噴
 * `unsafe use of new value of enum type`，而 migrate 對錯誤的處理是
 * process.exit(1) —— 部署當場硬死。
 *
 * 所以這支裡面絕對不可以出現任何用到這三個新值的 INSERT / UPDATE /
 * CREATE TABLE ... DEFAULT。新表與新欄位一律放在下一支（_p0b_drop_schema）。
 *
 * 這也是本專案 migrations-pg 第一次做 ADD VALUE（既有的 enum migration 全是
 * CREATE TYPE 新建），所以內容刻意保持極簡。
 *
 * down()：PG 沒有 DROP VALUE，enum 值加了就拿不掉。回滾只能靠還原 dump。
 * 不要假設 down 能跑。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_promotion_rules_effect_effect_type" ADD VALUE IF NOT EXISTS 'coupon_drop';
  ALTER TYPE "public"."enum_promotion_rules_effect_effect_type" ADD VALUE IF NOT EXISTS 'mystery_gift';
  ALTER TYPE "public"."enum_prize_pools_eligible_games" ADD VALUE IF NOT EXISTS 'order_mystery_gift';`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // no-op：PostgreSQL 不支援從 enum 移除值（沒有 DROP VALUE）。
  // 要真的回滾必須重建整個型別並改寫所有引用它的欄位，風險遠高於留著多餘的
  // enum 值。回滾請改用部署前的 pg_dump 還原（見 docs/db/PG-MIGRATION-RUNBOOK.md）。
  payload.logger.warn(
    '[migration] p0b_drop_enums.down 是 no-op：PG 無法移除 enum 值，回滾請還原 dump',
  )
}
