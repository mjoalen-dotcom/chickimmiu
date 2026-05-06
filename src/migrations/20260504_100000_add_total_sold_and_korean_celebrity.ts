import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 2026-05-04 — Quick Win D2 韓國女裝市場研究後的 PDP 強化
 *
 *   1. products.total_sold (numeric, default 0)
 *      累計售出件數，用於 PDP「累計售出 X+ 件」徽章。學 W.Korea 神褲
 *      (16 萬件累積銷售) 的 social proof 玩法。
 *
 *   2. collectionTags 不需 schema migration —— Payload select hasMany
 *      欄位的選項變更僅是 admin UI 層配置，DB 仍是同樣的 text 欄位
 *      (products_collection_tags table 各 row 的 value 字串)。所以
 *      Products.ts 加上 'korean-celebrity' 選項後，直接 deploy 即可。
 *
 * 冪等：沿襲 PRAGMA pattern。
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
  if (!(await columnExists(db, 'products', 'total_sold'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`total_sold\` numeric DEFAULT 0;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'products', 'total_sold')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`total_sold\`;`)
  }
}
