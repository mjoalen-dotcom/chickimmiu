import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Users.birthTime — 加 users.birth_time text 欄（選填，HH:mm 24 小時）
 *
 * 用途：
 *   - 星座運勢更精準（上升星座/月座推算）
 *   - 未來知醫聯盟整合可推導 12 時辰（子丑寅卯辰巳午未申酉戌亥）
 *
 * 冪等：PRAGMA 判斷
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

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'users', 'birth_time'))) {
    await db.run(sql`ALTER TABLE \`users\` ADD \`birth_time\` text;`)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite ALTER DROP COLUMN 太麻煩，刻意不 down — 欄位本身選填，留著無害
  void _args
}
