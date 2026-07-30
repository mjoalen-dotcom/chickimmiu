import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

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
  if (!(await tableExists(db, 'blog_posts_rels'))) {
    await db.run(sql`
      CREATE TABLE \`blog_posts_rels\` (
        \`id\` integer PRIMARY KEY NOT NULL,
        \`order\` integer,
        \`parent_id\` integer NOT NULL,
        \`path\` text NOT NULL,
        \`media_id\` integer,
        FOREIGN KEY (\`parent_id\`) REFERENCES \`blog_posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
      );
    `)
  } else if (!(await columnExists(db, 'blog_posts_rels', 'media_id'))) {
    await db.run(
      sql`ALTER TABLE \`blog_posts_rels\` ADD \`media_id\` integer REFERENCES media(id);`,
    )
  }

  const indexes = [
    ['blog_posts_rels_order_idx', 'order'],
    ['blog_posts_rels_parent_idx', 'parent_id'],
    ['blog_posts_rels_path_idx', 'path'],
    ['blog_posts_rels_media_id_idx', 'media_id'],
  ] as const

  for (const [name, column] of indexes) {
    if (!(await indexExists(db, name))) {
      await db.run(
        sql.raw(
          `CREATE INDEX \`${name}\` ON \`blog_posts_rels\` (\`${column}\`);`,
        ),
      )
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep the relation table to avoid deleting gallery selections on rollback.
}
