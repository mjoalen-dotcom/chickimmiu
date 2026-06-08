import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * BlogCategories collection — 部落格分類獨立管理（顯示名稱 / 排序 / SEO）。
 *
 * 對應檔案：src/collections/BlogCategories.ts
 * 新增 table：blog_categories（單表，無 array / 無 upload，故無子表 / _rels）
 * 新增 column：payload_locked_documents_rels.blog_categories_id
 * seed：5 筆對應 BlogPosts.category 的 select 值。
 *
 * 冪等：sqlite_master / PRAGMA pattern（承襲 20260504_163000_add_podcasts.ts）。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

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
  if (!(await tableExists(db, 'blog_categories'))) {
    await db.run(sql`CREATE TABLE \`blog_categories\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`value\` text NOT NULL,
      \`slug\` text,
      \`description\` text,
      \`display_order\` numeric DEFAULT 0,
      \`seo_meta_title\` text,
      \`seo_meta_description\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`blog_categories_value_idx\` ON \`blog_categories\` (\`value\`);`)
    await db.run(sql`CREATE UNIQUE INDEX \`blog_categories_slug_idx\` ON \`blog_categories\` (\`slug\`);`)
    await db.run(sql`CREATE INDEX \`blog_categories_display_order_idx\` ON \`blog_categories\` (\`display_order\`);`)
    await db.run(sql`CREATE INDEX \`blog_categories_updated_at_idx\` ON \`blog_categories\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`blog_categories_created_at_idx\` ON \`blog_categories\` (\`created_at\`);`)

    // seed：對應 BlogPosts.category 的 5 個 select 值
    await db.run(sql`INSERT INTO \`blog_categories\` (\`name\`, \`value\`, \`slug\`, \`display_order\`) VALUES
      ('穿搭教學', 'styling', 'styling', 1),
      ('時尚趨勢', 'trends', 'trends', 2),
      ('新品介紹', 'new-arrivals', 'new-arrivals', 3),
      ('品牌故事', 'brand-story', 'brand-story', 4),
      ('優惠活動', 'promotions', 'promotions', 5);`)
  }

  // payload_locked_documents_rels.blog_categories_id FK
  if (await tableExists(db, 'payload_locked_documents_rels')) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', 'blog_categories_id'))) {
      await db.run(
        sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`blog_categories_id\` integer REFERENCES blog_categories(id);`,
      )
      await db.run(
        sql`CREATE INDEX \`payload_locked_documents_rels_blog_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`blog_categories_id\`);`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`blog_categories\`;`)
  // SQLite DROP COLUMN 成本高，留 payload_locked_documents_rels.blog_categories_id 不刪
}
