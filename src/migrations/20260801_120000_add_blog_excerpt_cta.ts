import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rows(db: any, query: string) {
  const result = await db.run(sql.raw(query))
  return (result?.rows ?? result ?? []) as Array<Record<string, unknown>>
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = await rows(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name='blog_posts';",
  )
  if (tables.length === 0) return

  const columns = await rows(db, "PRAGMA table_info('blog_posts');")
  const names = new Set(columns.map((column) => String(column.name)))

  if (!names.has('excerpt_cta_enabled')) {
    await db.run(
      sql.raw(
        'ALTER TABLE `blog_posts` ADD COLUMN `excerpt_cta_enabled` numeric DEFAULT 0;',
      ),
    )
  }
  if (!names.has('excerpt_cta_label')) {
    await db.run(
      sql.raw(
        "ALTER TABLE `blog_posts` ADD COLUMN `excerpt_cta_label` text DEFAULT '立即購買';",
      ),
    )
  }
  if (!names.has('excerpt_cta_url')) {
    await db.run(
      sql.raw('ALTER TABLE `blog_posts` ADD COLUMN `excerpt_cta_url` text;'),
    )
  }

  await db.run(
    sql.raw(
      `UPDATE \`blog_posts\`
       SET \`excerpt_cta_enabled\` = 1,
           \`excerpt_cta_label\` = '立即選購 ME30',
           \`excerpt_cta_url\` = 'https://bit.ly/3RkiqPX'
       WHERE \`excerpt\` LIKE '%https://bit.ly/3RkiqPX%'
         AND (\`excerpt_cta_url\` IS NULL OR \`excerpt_cta_url\` = '');`,
    ),
  )
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep the optional columns so rolling back code never discards campaign data.
}
