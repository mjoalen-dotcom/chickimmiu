import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Media — `folder` 欄位
 *   用於後台分組 / 相簿管理；對應商品貨號、活動名稱或 banner/lookbook/ugc 等分類。
 *   index:true 讓列表搜尋（listSearchableFields）+ filter 更快。
 *
 * 冪等：PRAGMA table_info 判斷，同步 dev auto-push 與 prod 首次 migrate。
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, name: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${name}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'media', 'folder'))) {
    await db.run(sql`ALTER TABLE \`media\` ADD COLUMN \`folder\` text;`)
  }
  if (!(await indexExists(db, 'media_folder_idx'))) {
    await db.run(sql`CREATE INDEX \`media_folder_idx\` ON \`media\` (\`folder\`);`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await indexExists(db, 'media_folder_idx')) {
    await db.run(sql`DROP INDEX \`media_folder_idx\`;`)
  }
  if (await columnExists(db, 'media', 'folder')) {
    await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`folder\`;`)
  }
}
