import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const result = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (result?.rows ?? result ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

async function columnExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (result?.rows ?? result ?? []) as Array<Record<string, unknown>>
  return rows.some((row) => row.name === column)
}

/**
 * 將原本共用的 blog_categories 改為 site + value 複合關聯。
 *
 * - 原 5 筆分類全數保留並標為 store。
 * - BlogPosts.category 字串與所有文章列完全不改。
 * - 為 Kim 站補齊 14 個既有 select 值，兩站可各自維護名稱 / slug / SEO。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await tableExists(db, 'blog_categories'))) return

  if (!(await columnExists(db, 'blog_categories', 'site'))) {
    await db.run(
      sql`ALTER TABLE \`blog_categories\` ADD COLUMN \`site\` text DEFAULT 'store' NOT NULL;`,
    )
  }
  await db.run(
    sql`UPDATE \`blog_categories\` SET \`site\` = 'store' WHERE \`site\` IS NULL OR \`site\` = '';`,
  )

  // 舊版禁止不同網站使用相同 value / slug；改為網站內唯一。
  await db.run(sql`DROP INDEX IF EXISTS \`blog_categories_value_idx\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`blog_categories_slug_idx\`;`)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`blog_categories_site_idx\` ON \`blog_categories\` (\`site\`);`,
  )
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`blog_categories_site_value_idx\` ON \`blog_categories\` (\`site\`, \`value\`);`,
  )
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`blog_categories_site_slug_idx\` ON \`blog_categories\` (\`site\`, \`slug\`);`,
  )

  await db.run(sql`INSERT OR IGNORE INTO \`blog_categories\`
    (\`site\`, \`name\`, \`value\`, \`slug\`, \`display_order\`) VALUES
    ('kim', '穿搭教學', 'styling', 'styling', 1),
    ('kim', '新品介紹', 'new-arrivals', 'new-arrivals', 2),
    ('kim', '品牌故事', 'brand-story', 'brand-story', 3),
    ('kim', '優惠活動', 'promotions', 'promotions', 4),
    ('kim', '時尚趨勢', 'trends', 'trends', 5),
    ('kim', '時尚流行', 'fashion', 'fashion', 6),
    ('kim', '美容彩妝', 'beauty', 'beauty', 7),
    ('kim', '購物情報', 'shopping', 'shopping', 8),
    ('kim', '美食料理', 'food', 'food', 9),
    ('kim', '生活綜合', 'lifestyle', 'lifestyle', 10),
    ('kim', '親子育兒', 'parenting', 'parenting', 11),
    ('kim', '旅遊紀錄', 'travel', 'travel', 12),
    ('kim', 'KPOP 男團介紹', 'kpop-boy-groups', 'kpop-boy-groups', 13),
    ('kim', 'KPOP 女團介紹', 'kpop-girl-groups', 'kpop-girl-groups', 14);`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // 刻意不回刪 site 或 Kim 分類，避免 rollback 意外破壞已編輯的分類資料。
}
