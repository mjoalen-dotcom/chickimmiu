import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 修正 `competitor_price_records` 三個欄位的 snake_case 名稱
 * ──────────────────────────────────────────────────────────
 * `20260514_090000_add_whitehat_marketing_automation` 手寫 CREATE TABLE 時
 * 把 `priceTWD` / `priceKRW` / `estimatedCostTWD` 的 DB 欄位建為
 * `price_twd` / `price_krw` / `estimated_cost_twd`（把 TWD/KRW 當整體小寫）。
 *
 * 但 Payload v3 Drizzle adapter 的 toSnakeCase 會把每個大寫字母拆開，
 * runtime schema 把欄位識別為 `price_t_w_d` / `price_k_r_w` /
 * `estimated_cost_t_w_d`，導致 dashboard / list view SELECT 炸：
 *   SQLITE_ERROR: no such column: competitor_price_records.price_t_w_d
 * 結果 `/api/whitehat-marketing/dashboard` 與後台列表 500。
 *
 * 修法：把 DB 欄位 rename 對齊 runtime schema。
 * 冪等：先檢查舊欄名存在且新欄名不存在才 rename（fresh DB 走修正後的
 * CREATE TABLE 會直接是新欄名，此處 no-op）。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

async function renameIfNeeded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  oldName: string,
  newName: string,
): Promise<void> {
  if (!(await tableExists(db, table))) return
  const hasOld = await columnExists(db, table, oldName)
  const hasNew = await columnExists(db, table, newName)
  if (hasOld && !hasNew) {
    await db.run(
      sql.raw(`ALTER TABLE \`${table}\` RENAME COLUMN \`${oldName}\` TO \`${newName}\`;`),
    )
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await renameIfNeeded(db, 'competitor_price_records', 'price_twd', 'price_t_w_d')
  await renameIfNeeded(db, 'competitor_price_records', 'price_krw', 'price_k_r_w')
  await renameIfNeeded(db, 'competitor_price_records', 'estimated_cost_twd', 'estimated_cost_t_w_d')
}

export async function down({ db }: MigrateUpArgs | MigrateDownArgs): Promise<void> {
  await renameIfNeeded(db, 'competitor_price_records', 'price_t_w_d', 'price_twd')
  await renameIfNeeded(db, 'competitor_price_records', 'price_k_r_w', 'price_krw')
  await renameIfNeeded(db, 'competitor_price_records', 'estimated_cost_t_w_d', 'estimated_cost_twd')
}
