import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * CKMU ON SHOW Stage 1 — 為 lookbook-grid items 加 link_url 欄
 *
 * 動機：lookbook-grid.items 原只有 `linkedProduct`（relationship to products），
 * 在 CKMU ON SHOW 藝人牆要支援 6 種情境下卡片連到 `/category/...`、`/pages/...`、
 * 或子頁等非商品 URL — 需要任意 URL 連結欄。
 *
 * 對應 schema 變更：`src/collections/Pages.ts` LookbookGrid block items 加
 *   { name: 'linkUrl', type: 'text' }
 *
 * Renderer 變更：`src/components/page-blocks/PageBlocks.tsx` LookbookGrid 改成
 *   item.linkUrl > linkedProduct.slug 優先序
 *
 * 冪等：用 PRAGMA table_info 預檢，承襲 20260417_100000 pattern。
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
  if (!(await columnExists(db, 'pages_blocks_lookbook_grid_items', 'link_url'))) {
    await db.run(
      sql`ALTER TABLE \`pages_blocks_lookbook_grid_items\` ADD \`link_url\` text;`,
    )
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite DROP COLUMN pre-3.35 要 rebuild 整張表，代價太高，留著 dangling column
  // 與 20260418_220000_add_login_attempts.ts down 同策略
}
