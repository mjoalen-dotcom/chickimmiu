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
  if (!columns.some((column) => column.name === 'view_count')) {
    await db.run(
      sql.raw(
        'ALTER TABLE `blog_posts` ADD COLUMN `view_count` numeric DEFAULT 0;',
      ),
    )
  }

  const indexes = await rows(
    db,
    "SELECT name FROM sqlite_master WHERE type='index' AND name='blog_posts_view_count_idx';",
  )
  if (indexes.length === 0) {
    await db.run(
      sql.raw(
        'CREATE INDEX `blog_posts_view_count_idx` ON `blog_posts` (`view_count`);',
      ),
    )
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep the backwards-compatible column; removing it would rewrite SQLite data.
}
