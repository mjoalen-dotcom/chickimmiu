import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 優惠券疊加 / 互斥 + 訂單多券快照。
 *   - coupons.stackable（可疊加）、coupons.exclusive_group（互斥群組）
 *   - orders.applied_coupons（json 快照 [{coupon, couponCode, discountAmount}]）
 *
 * appliedCoupons 用 json 單欄（非 array 子表）→ 避免手寫子表結構風險；
 * 各券 usageCount 由 CouponRedemptions per-coupon 累加（不靠此欄）。
 *
 * 冪等：PRAGMA table_info 判斷。
 */

async function columnExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  column: string,
): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'coupons', 'stackable'))) {
    await db.run(sql`ALTER TABLE \`coupons\` ADD COLUMN \`stackable\` integer DEFAULT false;`)
  }
  if (!(await columnExists(db, 'coupons', 'exclusive_group'))) {
    await db.run(sql`ALTER TABLE \`coupons\` ADD COLUMN \`exclusive_group\` text;`)
  }
  if (!(await columnExists(db, 'orders', 'applied_coupons'))) {
    await db.run(sql`ALTER TABLE \`orders\` ADD COLUMN \`applied_coupons\` text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'coupons', 'stackable')) {
    await db.run(sql`ALTER TABLE \`coupons\` DROP COLUMN \`stackable\`;`)
  }
  if (await columnExists(db, 'coupons', 'exclusive_group')) {
    await db.run(sql`ALTER TABLE \`coupons\` DROP COLUMN \`exclusive_group\`;`)
  }
  if (await columnExists(db, 'orders', 'applied_coupons')) {
    await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`applied_coupons\`;`)
  }
}
