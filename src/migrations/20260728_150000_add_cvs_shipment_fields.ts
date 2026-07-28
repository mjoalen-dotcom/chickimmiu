import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * ECPay C2C 託運單發號（/Express/Create）schema：
 *   1. orders.shipping_method_* 4 欄 — AllPayLogisticsID / 寄貨編號 /
 *      驗證碼（7-11）/ 物流狀態通知最新一筆
 *   2. order_settings.cvs_shipping_* 2 欄 — 寄件人名稱 / 手機
 *
 * 對應檔案：src/collections/Orders.ts shippingMethod group、
 *           src/globals/OrderSettings.ts cvsShipping group、
 *           src/lib/logistics/ecpayExpress.ts
 * 冪等：PRAGMA table_info pattern（承襲 20260728_010000_add_user_subscriptions_membership.ts）。
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addColumnIfMissing(db: any, table: string, column: string): Promise<void> {
  if (!(await columnExists(db, table, column))) {
    await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` text;`))
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await addColumnIfMissing(db, 'orders', 'shipping_method_ecpay_logistics_id')
  await addColumnIfMissing(db, 'orders', 'shipping_method_cvs_payment_no')
  await addColumnIfMissing(db, 'orders', 'shipping_method_cvs_validation_no')
  await addColumnIfMissing(db, 'orders', 'shipping_method_logistics_status')
  await addColumnIfMissing(db, 'order_settings', 'cvs_shipping_sender_name')
  await addColumnIfMissing(db, 'order_settings', 'cvs_shipping_sender_cell_phone')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const col of [
    'shipping_method_ecpay_logistics_id',
    'shipping_method_cvs_payment_no',
    'shipping_method_cvs_validation_no',
    'shipping_method_logistics_status',
  ]) {
    if (await columnExists(db, 'orders', col)) {
      await db.run(sql.raw(`ALTER TABLE \`orders\` DROP COLUMN \`${col}\`;`))
    }
  }
  for (const col of ['cvs_shipping_sender_name', 'cvs_shipping_sender_cell_phone']) {
    if (await columnExists(db, 'order_settings', col)) {
      await db.run(sql.raw(`ALTER TABLE \`order_settings\` DROP COLUMN \`${col}\`;`))
    }
  }
}
