import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.8 — Products.cost + products_variants.costOverride
 *   用於營運獲利統計（毛利 = (售價 − 成本) / 售價）。
 *   Product 層級 cost = 預設成本；variant 層級 costOverride = per-SKU 例外。
 *   兩者都選填（NULL = 未設定）。Pattern 跟 price / priceOverride 一致。
 *
 * 冪等：SQLite 不支援 ADD COLUMN IF NOT EXISTS，改用 PRAGMA table_info 判斷。
 * 對齊 20260417_100000_add_stored_value_balance.ts 的 columnExists pattern。
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
  if (!(await columnExists(db, 'products', 'cost'))) {
    await db.run(sql`ALTER TABLE \`products\` ADD COLUMN \`cost\` numeric;`)
  }
  if (!(await columnExists(db, 'products_variants', 'cost_override'))) {
    await db.run(
      sql`ALTER TABLE \`products_variants\` ADD COLUMN \`cost_override\` numeric;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'products', 'cost')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`cost\`;`)
  }
  if (await columnExists(db, 'products_variants', 'cost_override')) {
    await db.run(
      sql`ALTER TABLE \`products_variants\` DROP COLUMN \`cost_override\`;`,
    )
  }
}
