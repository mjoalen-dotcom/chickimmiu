import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * AutomationLogs.resumeAt — 自動化旅程「持久化等待」恢復時間。
 *   delayMinutes>0 的步驟執行前暫停，寫 resumeAt；/api/cron/automations 到期後續跑。
 *
 * 冪等：SQLite 不支援 ADD COLUMN IF NOT EXISTS，用 PRAGMA table_info 判斷。
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
  if (!(await columnExists(db, 'automation_logs', 'resume_at'))) {
    await db.run(sql`ALTER TABLE \`automation_logs\` ADD COLUMN \`resume_at\` text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'automation_logs', 'resume_at')) {
    await db.run(sql`ALTER TABLE \`automation_logs\` DROP COLUMN \`resume_at\`;`)
  }
}
