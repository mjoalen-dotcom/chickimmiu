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

  if (!names.has('visibility')) {
    await db.run(
      sql.raw(
        "ALTER TABLE `blog_posts` ADD COLUMN `visibility` text DEFAULT 'public' NOT NULL;",
      ),
    )
  }
  if (!names.has('access_password_hash')) {
    await db.run(
      sql.raw('ALTER TABLE `blog_posts` ADD COLUMN `access_password_hash` text;'),
    )
  }

  await db.run(
    sql.raw(
      "UPDATE `blog_posts` SET `visibility` = 'public' WHERE `visibility` IS NULL OR `visibility` = '';",
    ),
  )

  const indexes = await rows(
    db,
    "SELECT name FROM sqlite_master WHERE type='index' AND name='blog_posts_visibility_idx';",
  )
  if (indexes.length === 0) {
    await db.run(
      sql.raw('CREATE INDEX `blog_posts_visibility_idx` ON `blog_posts` (`visibility`);'),
    )
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve access settings and hashes so a code rollback never destroys them.
}
