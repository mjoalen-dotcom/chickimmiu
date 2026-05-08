import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Products — 多分類支援（PR-1 / 其他分類）
 *
 *   - 新增 products_rels 多型 join 表（path = 'additionalCategories'）
 *   - hasMany relationship 一律寫進 <collection>_rels；目前 products 還沒有
 *     任何 hasMany relationship，所以這張表是新建立。
 *
 * 冪等：sqlite 不支援 IF NOT EXISTS for CREATE TABLE → 用 sqlite_master 判斷；
 * pattern 沿襲 20260505_200000_add_ad_audiences.ts。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await tableExists(db, 'products_rels'))) {
    await db.run(sql`CREATE TABLE \`products_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`categories_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`products_rels_order_idx\` ON \`products_rels\` (\`order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`products_rels_parent_idx\` ON \`products_rels\` (\`parent_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`products_rels_path_idx\` ON \`products_rels\` (\`path\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`products_rels_categories_id_idx\` ON \`products_rels\` (\`categories_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'products_rels')) {
    await db.run(sql`DROP TABLE \`products_rels\`;`)
  }
}
