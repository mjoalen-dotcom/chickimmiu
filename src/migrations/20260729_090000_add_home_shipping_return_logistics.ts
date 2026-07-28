import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 宅配託運（綠界 HOME 黑貓/郵政）+ 逆物流 + 狀態自動流轉 schema：
 *   1. orders.shipping_method_return_logistics_* 2 欄 — 逆物流標記/貨態
 *   2. order_settings.cvs_shipping_return_store_id — 7-11 退貨門市代號
 *   3. order_settings.home_shipping_* 7 欄 — 宅配寄件人 + 溫層/規格/預設重量
 *   4. order_settings.status_flow_auto_status_from_logistics — 自動流轉總開關
 *
 * 訂單狀態新增 'returned'（已退回）：select 在 SQLite 是 text 欄位，
 * 不需 schema 變更。
 *
 * 對應檔案：src/collections/Orders.ts、src/globals/OrderSettings.ts、
 *           src/lib/logistics/{ecpayExpress,logisticsStatusMap}.ts
 * 冪等：PRAGMA table_info pattern（承襲 20260728_150000_add_cvs_shipment_fields.ts）。
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
async function addColumnIfMissing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  column: string,
  type = 'text',
  defaultClause = '',
): Promise<void> {
  if (!(await columnExists(db, table, column))) {
    await db.run(
      sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}${defaultClause};`),
    )
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await addColumnIfMissing(db, 'orders', 'shipping_method_return_logistics_id')
  await addColumnIfMissing(db, 'orders', 'shipping_method_return_logistics_status')

  await addColumnIfMissing(db, 'order_settings', 'cvs_shipping_return_store_id')
  await addColumnIfMissing(db, 'order_settings', 'home_shipping_sender_name')
  await addColumnIfMissing(db, 'order_settings', 'home_shipping_sender_cell_phone')
  await addColumnIfMissing(db, 'order_settings', 'home_shipping_sender_zip_code')
  await addColumnIfMissing(db, 'order_settings', 'home_shipping_sender_address')
  await addColumnIfMissing(db, 'order_settings', 'home_shipping_temperature', 'text', " DEFAULT '0001'")
  await addColumnIfMissing(db, 'order_settings', 'home_shipping_specification', 'text', " DEFAULT '0001'")
  await addColumnIfMissing(db, 'order_settings', 'home_shipping_default_goods_weight', 'numeric', ' DEFAULT 1')
  await addColumnIfMissing(
    db,
    'order_settings',
    'status_flow_auto_status_from_logistics',
    'INTEGER',
    ' DEFAULT true',
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const col of [
    'shipping_method_return_logistics_id',
    'shipping_method_return_logistics_status',
  ]) {
    if (await columnExists(db, 'orders', col)) {
      await db.run(sql.raw(`ALTER TABLE \`orders\` DROP COLUMN \`${col}\`;`))
    }
  }
  for (const col of [
    'cvs_shipping_return_store_id',
    'home_shipping_sender_name',
    'home_shipping_sender_cell_phone',
    'home_shipping_sender_zip_code',
    'home_shipping_sender_address',
    'home_shipping_temperature',
    'home_shipping_specification',
    'home_shipping_default_goods_weight',
    'status_flow_auto_status_from_logistics',
  ]) {
    if (await columnExists(db, 'order_settings', col)) {
      await db.run(sql.raw(`ALTER TABLE \`order_settings\` DROP COLUMN \`${col}\`;`))
    }
  }
}
