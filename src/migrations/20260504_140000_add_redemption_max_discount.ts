import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 兌換獎品實際功能 PR-X — 補 schema 缺口
 *
 * 新增 column:
 *   - points_redemptions.coupon_config_max_discount_amount (numeric)
 *
 * 此欄位讓 admin 可以對「百分比折扣」類型 coupon 設定折抵上限
 * （例如 8 折最多折 500 元）；之前 PointsRedemptions.couponConfig 沒這欄，
 * 但 Coupons collection 自身有，所以兌換生成的 coupons row 寫得進，
 * 但 admin 在 PointsRedemptions 看不到、設不了。本 migration 補齊。
 *
 * 其他改動：
 *   - PointsRedemptions.couponConfig admin condition 擴到 5 種 type
 *     （coupon/discount_code/free_shipping/addon_deal/store_credit）
 *     → 純 admin UI 條件，不影響 schema
 *   - PointsRedemptions.couponConfig.discountType options 加 free_shipping
 *     → text column 值放寬，不影響 schema
 *   - PointsRedemptions.lotteryConfig admin condition 擴到 lottery / mystery
 *     → 純 admin UI 條件
 *   - PointsRedemptions.lotteryConfig.prizes.stock 移除 defaultValue:0
 *     → numeric column behavior 不變
 *   - UserRewards.rewardType 加 'voucher' enum
 *     → text column 值放寬，不影響 schema
 *
 * 冪等：PRAGMA / sqlite_master 判斷；pattern 承襲既有 migration。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (
    !(await columnExists(db, 'points_redemptions', 'coupon_config_max_discount_amount'))
  ) {
    await db.run(
      sql`ALTER TABLE \`points_redemptions\` ADD COLUMN \`coupon_config_max_discount_amount\` numeric;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (
    await columnExists(db, 'points_redemptions', 'coupon_config_max_discount_amount')
  ) {
    await db.run(
      sql`ALTER TABLE \`points_redemptions\` DROP COLUMN \`coupon_config_max_discount_amount\`;`,
    )
  }
}
