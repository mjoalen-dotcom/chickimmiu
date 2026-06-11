import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 加 BlogPosts 影音 hero + 釘選欄位（品牌主題曲 blog post 用）
 *
 * 新欄位（blog_posts 主表）：
 *   - featured            (integer DEFAULT 0)         — 釘選頂部
 *   - hero_video_id       (integer FK media)          — MP4 hero
 *   - hero_audio_id       (integer FK media)          — MP3 audio player
 *   - lyrics              (text)                       — 用戶在 admin 自行填
 *   - media_credit        (text)                       — 影音 credit line
 *
 * Indexes：
 *   - blog_posts_featured_idx        — 列表頁查 featured=1 時用
 *   - blog_posts_hero_video_id_idx   — FK 標準 index
 *   - blog_posts_hero_audio_id_idx   — FK 標準 index
 *
 * 冪等：用 PRAGMA table_info / sqlite_master 預檢，沿用既有 migration pattern。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, name: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${name}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'blog_posts', 'featured'))) {
    await db.run(sql`ALTER TABLE \`blog_posts\` ADD \`featured\` integer DEFAULT 0;`)
  }
  if (!(await columnExists(db, 'blog_posts', 'hero_video_id'))) {
    await db.run(
      sql`ALTER TABLE \`blog_posts\` ADD \`hero_video_id\` integer REFERENCES media(id);`,
    )
  }
  if (!(await columnExists(db, 'blog_posts', 'hero_audio_id'))) {
    await db.run(
      sql`ALTER TABLE \`blog_posts\` ADD \`hero_audio_id\` integer REFERENCES media(id);`,
    )
  }
  if (!(await columnExists(db, 'blog_posts', 'lyrics'))) {
    await db.run(sql`ALTER TABLE \`blog_posts\` ADD \`lyrics\` text;`)
  }
  if (!(await columnExists(db, 'blog_posts', 'media_credit'))) {
    await db.run(sql`ALTER TABLE \`blog_posts\` ADD \`media_credit\` text;`)
  }

  for (const [name, col] of [
    ['blog_posts_featured_idx', 'featured'],
    ['blog_posts_hero_video_id_idx', 'hero_video_id'],
    ['blog_posts_hero_audio_id_idx', 'hero_audio_id'],
  ]) {
    if (!(await indexExists(db, name))) {
      await db.run(sql.raw(`CREATE INDEX \`${name}\` ON \`blog_posts\` (\`${col}\`);`))
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite DROP COLUMN 成本高，留無害
}
