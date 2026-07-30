import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const result = await db.run(
    sql.raw(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`,
    ),
  )
  const rows = (result?.rows ?? result ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

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
  if (!(await tableExists(db, 'newsletter_subscribers'))) return

  if (
    !(await columnExists(
      db,
      'newsletter_subscribers',
      'kim_blog_subscribed',
    ))
  ) {
    await db.run(
      sql`ALTER TABLE \`newsletter_subscribers\` ADD \`kim_blog_subscribed\` numeric DEFAULT 0;`,
    )
  }

  if (
    !(await columnExists(
      db,
      'newsletter_subscribers',
      'kim_blog_subscribed_at',
    ))
  ) {
    await db.run(
      sql`ALTER TABLE \`newsletter_subscribers\` ADD \`kim_blog_subscribed_at\` text;`,
    )
  }

  if (
    !(await indexExists(
      db,
      'newsletter_subscribers_kim_blog_subscribed_idx',
    ))
  ) {
    await db.run(
      sql`CREATE INDEX \`newsletter_subscribers_kim_blog_subscribed_idx\` ON \`newsletter_subscribers\` (\`kim_blog_subscribed\`);`,
    )
  }

  await db.run(sql`
    UPDATE \`newsletter_subscribers\`
    SET
      \`kim_blog_subscribed\` = 1,
      \`kim_blog_subscribed_at\` = COALESCE(
        \`kim_blog_subscribed_at\`,
        \`confirmed_at\`,
        \`created_at\`
      )
    WHERE \`source\` = 'kim-blog';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve subscription preferences on rollback.
}
