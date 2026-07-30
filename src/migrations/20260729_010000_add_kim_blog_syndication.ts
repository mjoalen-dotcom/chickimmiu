import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const result = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (result?.rows ?? result ?? []) as Array<Record<string, unknown>>
  return rows.some((row) => row?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, name: string): Promise<boolean> {
  const result = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${name}';`),
  )
  const rows = (result?.rows ?? result ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'blog_posts', 'publish_to_kim_lafayette'))) {
    await db.run(
      sql`ALTER TABLE \`blog_posts\` ADD \`publish_to_kim_lafayette\` integer DEFAULT 0;`,
    )
  }
  if (!(await columnExists(db, 'blog_posts', 'source_url'))) {
    await db.run(sql`ALTER TABLE \`blog_posts\` ADD \`source_url\` text;`)
  }
  if (!(await indexExists(db, 'blog_posts_publish_to_kim_idx'))) {
    await db.run(
      sql`CREATE INDEX \`blog_posts_publish_to_kim_idx\` ON \`blog_posts\` (\`publish_to_kim_lafayette\`);`,
    )
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite column removal rewrites the table. Keeping dormant columns is safer.
}
