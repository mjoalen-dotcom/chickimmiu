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
async function columnExists(
  db: any,
  table: string,
  column: string,
): Promise<boolean> {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addColumns(
  db: any,
  table: string,
  columns: ReadonlyArray<readonly [name: string, definition: string]>,
) {
  if (!(await tableExists(db, table))) return
  for (const [name, definition] of columns) {
    if (!(await columnExists(db, table, name))) {
      await db.run(
        sql.raw(
          `ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition};`,
        ),
      )
    }
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await addColumns(db, 'media', [
    ['usage_rights_source_label', 'text'],
    ['usage_rights_source_url', 'text'],
    ['usage_rights_creator', 'text'],
    [
      'usage_rights_license_kind',
      "text DEFAULT 'unknown'",
    ],
    ['usage_rights_license_url', 'text'],
    ['usage_rights_evidence_url', 'text'],
    ['usage_rights_promotional_use_allowed', 'integer DEFAULT false'],
    ['usage_rights_verified_at', 'text'],
    ['usage_rights_verification_note', 'text'],
    ['sizes_blog800_url', 'text'],
    ['sizes_blog800_width', 'numeric'],
    ['sizes_blog800_height', 'numeric'],
    ['sizes_blog800_mime_type', 'text'],
    ['sizes_blog800_filesize', 'numeric'],
    ['sizes_blog800_filename', 'text'],
    ['sizes_blog1000_url', 'text'],
    ['sizes_blog1000_width', 'numeric'],
    ['sizes_blog1000_height', 'numeric'],
    ['sizes_blog1000_mime_type', 'text'],
    ['sizes_blog1000_filesize', 'numeric'],
    ['sizes_blog1000_filename', 'text'],
  ])

  await addColumns(db, 'blog_posts', [
    ['article_studio_generated_by_studio', 'integer DEFAULT false'],
    ['article_studio_template_key', 'text'],
    ['article_studio_research_checked_at', 'text'],
    ['article_studio_takedown_email', 'text'],
    ['article_studio_rights_notice', 'text'],
  ])

  if (
    (await tableExists(db, 'blog_posts')) &&
    !(await tableExists(db, 'blog_posts_article_studio_research_sources'))
  ) {
    await db.run(sql`
      CREATE TABLE \`blog_posts_article_studio_research_sources\` (
        \`_order\` integer NOT NULL,
        \`_parent_id\` integer NOT NULL,
        \`id\` text PRIMARY KEY NOT NULL,
        \`label\` text NOT NULL,
        \`url\` text NOT NULL,
        \`provider\` text DEFAULT 'manual',
        FOREIGN KEY (\`_parent_id\`) REFERENCES \`blog_posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
      );
    `)
  }

  for (const [name, table, column] of [
    [
      'media_sizes_blog800_sizes_blog800_filename_idx',
      'media',
      'sizes_blog800_filename',
    ],
    [
      'media_sizes_blog1000_sizes_blog1000_filename_idx',
      'media',
      'sizes_blog1000_filename',
    ],
    [
      'blog_posts_article_studio_generated_by_studio_idx',
      'blog_posts',
      'article_studio_generated_by_studio',
    ],
    [
      'blog_posts_article_studio_research_sources_order_idx',
      'blog_posts_article_studio_research_sources',
      '_order',
    ],
    [
      'blog_posts_article_studio_research_sources_parent_id_idx',
      'blog_posts_article_studio_research_sources',
      '_parent_id',
    ],
  ] as const) {
    if (
      (await tableExists(db, table)) &&
      !(await indexExists(db, name))
    ) {
      await db.run(
        sql.raw(`CREATE INDEX \`${name}\` ON \`${table}\` (\`${column}\`);`),
      )
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite DROP COLUMN/table would rewrite or discard records. Keep dormant,
  // backwards-compatible fields on rollback, matching this project's migrations.
}
