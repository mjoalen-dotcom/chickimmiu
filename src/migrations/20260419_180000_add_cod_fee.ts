import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * COD payment — orders.cod_fee column
 *   貨到付款手續費（新台幣），只有 paymentMethod=cash_cod 時計入 total。
 *   預設值 0；前台 checkout 從 GlobalSettings.payment.codDefaultFee 帶入，
 *   admin 可在單張訂單覆蓋。
 *
 * 冪等：用 PRAGMA table_info 判斷欄位是否已存在；同 pattern 承襲
 * 20260417_100000_add_stored_value_balance.ts。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'orders', 'cod_fee'))) {
    await db.run(sql`ALTER TABLE \`orders\` ADD \`cod_fee\` numeric DEFAULT 0;`)
  }
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // SQLite pre-3.35 DROP COLUMN 要 rebuild 整張表，代價過高；保留 cod_fee 欄位無害
}
