import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Daily Horoscopes — 新增 daily_horoscopes 表 + payload_locked_documents_rels FK 欄位
 *
 * 冪等：sqlite_master / PRAGMA 判斷；pattern 承襲 20260418_220000_add_login_attempts.ts
 *
 * 主鍵查詢路徑：(zodiac_sign, date, gender) 複合 → 加複合索引一次取完。
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, index: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${index}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1. daily_horoscopes 主表 ──
  if (!(await tableExists(db, 'daily_horoscopes'))) {
    await db.run(sql`CREATE TABLE \`daily_horoscopes\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`zodiac_sign\` text NOT NULL,
      \`date\` text NOT NULL,
      \`gender\` text NOT NULL,
      \`work_fortune\` text NOT NULL,
      \`relationship_fortune\` text NOT NULL,
      \`money_fortune\` text NOT NULL,
      \`caution_fortune\` text NOT NULL,
      \`outfit_advice\` text NOT NULL,
      \`lucky_colors\` text,
      \`style_keywords\` text,
      \`generated_by\` text DEFAULT 'seed',
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE INDEX \`daily_horoscopes_zodiac_sign_idx\` ON \`daily_horoscopes\` (\`zodiac_sign\`);`,
    )
    await db.run(sql`CREATE INDEX \`daily_horoscopes_date_idx\` ON \`daily_horoscopes\` (\`date\`);`)
    await db.run(
      sql`CREATE INDEX \`daily_horoscopes_gender_idx\` ON \`daily_horoscopes\` (\`gender\`);`,
    )
    // 複合索引 — API 一次查 (sign, date, gender)
    await db.run(
      sql`CREATE INDEX \`daily_horoscopes_lookup_idx\` ON \`daily_horoscopes\` (\`zodiac_sign\`, \`date\`, \`gender\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`daily_horoscopes_updated_at_idx\` ON \`daily_horoscopes\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`daily_horoscopes_created_at_idx\` ON \`daily_horoscopes\` (\`created_at\`);`,
    )
  }

  // ── 2. payload_locked_documents_rels FK 欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'daily_horoscopes_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`daily_horoscopes_id\` integer REFERENCES daily_horoscopes(id);`,
    )
  }
  if (
    !(await indexExists(db, 'payload_locked_documents_rels_daily_horoscopes_id_idx'))
  ) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_daily_horoscopes_id_idx\` ON \`payload_locked_documents_rels\` (\`daily_horoscopes_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'daily_horoscopes')) {
    await db.run(sql`DROP TABLE \`daily_horoscopes\`;`)
  }
  // 不 DROP locked_documents_rels 新欄位（SQLite ALTER DROP COLUMN 太麻煩）
}
