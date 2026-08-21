/**
 * 16-6 演練用：把 cutover SQL 原文輸出到 stdout，scp 到伺服器後對 scratch DB
 * `psql -v ON_ERROR_STOP=1 -f` 實跑 —— 與正式 migration 逐字相同。
 *
 *   pnpm payload run scripts/print-cutover-sql.ts > cutover-up.sql
 *   pnpm payload run scripts/print-cutover-sql.ts -- --down > cutover-down.sql
 */
import {
  CUTOVER_UP_SQL,
  CUTOVER_DOWN_SQL,
} from '../src/migrations-pg/sql/usersCustomersCutoverSql'

const wantDown = process.argv.includes('--down')
process.stdout.write(wantDown ? CUTOVER_DOWN_SQL : CUTOVER_UP_SQL)
