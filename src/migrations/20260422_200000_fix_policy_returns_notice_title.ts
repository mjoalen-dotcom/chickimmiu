import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Hotfix — policy_pages_settings 缺 account_returns_notice_title 欄位
 *
 * 症狀：`/api/globals/policy-pages-settings` 回 500，log 顯示
 *   「no such column: account_returns_notice_title」
 *
 * 成因：`PolicyPagesSettings.accountReturnsNotice.title` field 被加入 global
 *   但當時沒產 migration。`policy_pages_settings` 表少一欄；items 子表
 *   (`policy_pages_settings_account_returns_notice_items`) 早就存在。
 *
 * 本檔只補 scalar 欄位，冪等 — 若已存在直接 skip。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'policy_pages_settings', 'account_returns_notice_title'))) {
    await db.run(
      sql.raw(
        `ALTER TABLE \`policy_pages_settings\` ADD COLUMN \`account_returns_notice_title\` text DEFAULT '退換貨須知';`,
      ),
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // SQLite 3.35+ 支援 DROP COLUMN，但 libSQL 版本不保證；保留欄位無副作用。
  void db
}
