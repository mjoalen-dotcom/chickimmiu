/**
 * 雙方言相容的原子 UPDATE 工具（SQLite / PostgreSQL 皆可）
 * ─────────────────────────────────────────────────────────
 * 背景：Campaign Engine V1（2026-08-13）寫的原子預算／券額度 UPDATE 是純
 * SQLite 方言——反引號識別字（`table`）＋ 兩參數純量 `MAX(0, x)` ＋ 讀
 * `res.rowsAffected`。2026-08-16 正式環境切到 PostgreSQL 16 之後這些語句
 * 在 PG 上一律語法錯誤：
 *   - PG 的反引號不是識別字引號（要用雙引號，或全小寫時直接不引）
 *   - PG 的 MAX() 只有聚合版，純量版是 GREATEST()
 *   - node-postgres 回傳 rowCount，不是 rowsAffected
 *
 * 影響（切換後一直存在、無人發現，因為兩條路徑的錯誤都被上層 catch 吞掉）：
 *   1. 券額度回沖：redemption 紀錄已刪、usageCount 卻沒遞減 → 券的可用
 *      次數永久少掉且無憑據可對帳（這正是 Campaign Engine V1 當初修好的
 *      「券額度取消不回沖」漏洞被 PG 切換無聲還原）。
 *   2. 活動預算預留／回沖：目前無 active 規則所以休眠，但一旦啟用活動，
 *      第一筆帶 campaign 折扣的結帳就會 500。
 *
 * 寫法約定（維持原子性，不退回 read-modify-write）：
 *   - 識別字一律不加引號。本專案 schema 全是小寫 snake_case，PG 會把未
 *     加引號的識別字摺成小寫，兩邊behaviour一致。
 *   - 不用 MAX()/GREATEST()，改用 WHERE 條件擋掉會變負數的情形，語意相同
 *     且兩個方言都吃。
 *   - 一律用 affectedRows() 讀受影響列數，不直接讀 rowsAffected。
 */

/** drizzle 在 SQLite 回 rowsAffected、在 PG 回 rowCount，兩者都讀。 */
export function affectedRows(res: unknown): number {
  if (!res || typeof res !== 'object') return 0
  const r = res as { rowsAffected?: unknown; rowCount?: unknown }
  if (typeof r.rowsAffected === 'number') return r.rowsAffected
  if (typeof r.rowCount === 'number') return r.rowCount
  return 0
}

/**
 * 執行一句原子 SQL，兩種 adapter 都能跑。
 *
 * 🔥 這裡不是抽象潔癖，是踩過的坑：drizzle 的兩種 database 類別**方法名不同**。
 *   - SQLite（BetterSQLite3Database）：有 run()，沒有 execute()
 *   - PG（NodePgDatabase）：有 execute()，**沒有 run()**
 * 舊版這裡導出 getDrizzle() 並在呼叫端寫 `.run(...)`，切到 PG 之後三個呼叫點
 * 一律 `TypeError: run is not a function`——SQL 字串本身是對的（用 psql 驗過），
 * 但那句 SQL 從來沒被執行過。教訓：驗證 SQL 方言相容 ≠ 驗證 driver 方法存在，
 * 兩件事要分開驗。（pre 實測：typeof run=undefined、typeof execute=function）
 *
 * 故意不再導出 raw drizzle，避免呼叫端又寫回 .run()。
 */
export async function runSql(payload: unknown, query: unknown): Promise<unknown> {
  const d = (payload as { db?: { drizzle?: Record<string, unknown> } })?.db?.drizzle
  if (!d) throw new Error('[dialectSafeSql] 取不到 payload.db.drizzle')
  if (typeof d.run === 'function') {
    return (d.run as (q: unknown) => Promise<unknown>)(query)
  }
  if (typeof d.execute === 'function') {
    return (d.execute as (q: unknown) => Promise<unknown>)(query)
  }
  throw new Error('[dialectSafeSql] drizzle 既無 run() 也無 execute()，無法執行原子 SQL')
}
