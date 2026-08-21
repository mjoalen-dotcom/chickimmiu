import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { CUTOVER_UP_SQL, CUTOVER_DOWN_SQL } from './sql/usersCustomersCutoverSql'

/**
 * APP-API-001 步驟16-7：users → customers 正式切換
 * ─────────────────────────────────────────────
 * SQL 本體在 ./sql/usersCustomersCutoverSql.ts —— 與 16-6 演練腳本
 * （scripts/print-cutover-sql.ts → psql -f）共用同一份字串，逐字相同。
 * 設計說明、MOVE/STAY 清單依據、已知外觀量癥見該檔案 doc comment。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(CUTOVER_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(CUTOVER_DOWN_SQL))
}
