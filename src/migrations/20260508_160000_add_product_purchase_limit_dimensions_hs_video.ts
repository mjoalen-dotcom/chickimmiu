import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Products — 補 4 類欄位
 *   1) purchase_limit
 *   2) dimensions_length / dimensions_width / dimensions_height
 *   3) hs_code
 *   4) intro_video_id（media FK，刪除 media 時自動設 null）
 *
 * 冪等策略：
 * SQLite 不支援 ADD COLUMN IF NOT EXISTS，改用 PRAGMA table_info 判斷。
 */

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

async function tableExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'products', 'purchase_limit'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`purchase_limit\` integer DEFAULT 0;`,
    )
  }

  if (!(await columnExists(db, 'products', 'dimensions_length'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`dimensions_length\` numeric;`,
    )
  }
  if (!(await columnExists(db, 'products', 'dimensions_width'))) {
    await db.run(sql`ALTER TABLE \`products\` ADD COLUMN \`dimensions_width\` numeric;`)
  }
  if (!(await columnExists(db, 'products', 'dimensions_height'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`dimensions_height\` numeric;`,
    )
  }

  if (!(await columnExists(db, 'products', 'hs_code'))) {
    await db.run(sql`ALTER TABLE \`products\` ADD COLUMN \`hs_code\` text;`)
  }

  if (
    !(await columnExists(db, 'products', 'intro_video_id')) &&
    (await tableExists(db, 'media'))
  ) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`intro_video_id\` integer REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // SQLite >= 3.35 支援 DROP COLUMN；目前專案執行環境符合。
  if (await columnExists(db, 'products', 'intro_video_id')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`intro_video_id\`;`)
  }
  if (await columnExists(db, 'products', 'hs_code')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`hs_code\`;`)
  }
  if (await columnExists(db, 'products', 'dimensions_height')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`dimensions_height\`;`)
  }
  if (await columnExists(db, 'products', 'dimensions_width')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`dimensions_width\`;`)
  }
  if (await columnExists(db, 'products', 'dimensions_length')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`dimensions_length\`;`)
  }
  if (await columnExists(db, 'products', 'purchase_limit')) {
    await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`purchase_limit\`;`)
  }
}
