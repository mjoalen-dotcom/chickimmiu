import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 訪客結帳（WO-BP002 C）—— 兩個純增欄，不動既有資料、不動 NOT NULL
 *
 *   orders.guest_email  TEXT     訪客訂單的真實聯絡信箱（會員單留空）
 *   users.is_guest      INTEGER  訪客結帳自動建立的臨時帳號標記
 *
 * 為什麼不是把 orders.customer_id 改成 nullable：那在 SQLite 需要整表重建
 * （orders 是全站最重要的表），而且全站有大量「訂單一定有 customer」的假設
 * （信件、會員中心、金流擁有權檢查、點數 / 推薦 / 發票 hooks）。改用
 * 「每筆訪客單建立一個 is_guest 臨時帳號 + 合成信箱」可以完全沿用既有路徑，
 * 真實聯絡信箱存在 orders.guest_email，寄信端優先讀它。
 */

const ADDITIONS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'orders', column: 'guest_email', ddl: 'text' },
  { table: 'users', column: 'is_guest', ddl: 'integer DEFAULT false' },
]

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
  for (const { table, column, ddl } of ADDITIONS) {
    if (!(await columnExists(db, table, column))) {
      await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl};`))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // SQLite 3.35+ 支援 DROP COLUMN；失敗不擋回滾（欄位留著也不影響舊版程式）
  for (const { table, column } of ADDITIONS) {
    if (await columnExists(db, table, column)) {
      try {
        await db.run(sql.raw(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\`;`))
      } catch {
        /* 舊版 SQLite 不支援 DROP COLUMN — 保留欄位即可 */
      }
    }
  }
}
