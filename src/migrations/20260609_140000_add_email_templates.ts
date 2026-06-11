import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * EmailTemplates collection — 交易信模板（歡迎 / 訂單 6 狀態 / auth 驗證 / 忘記密碼）。
 *
 * 對應檔案：src/collections/EmailTemplates.ts（slug email-templates）
 * 新增 table：email_templates（單表；code/json 欄位皆存 text，無 array / 無 upload）
 * 新增 column：payload_locked_documents_rels.email_templates_id
 *
 * **不在此 seed**：9 種事件預設模板由 src/lib/email/renderFromTemplate.ts 的
 * ensureDefaultEmailTemplates() 於首次進「預覽 / 測試寄送」後台頁時冪等補齊
 * （避免在 migration 內塞大段 HTML，且讓預設內容維護在 TS 一處）。
 *
 * 冪等：sqlite_master / PRAGMA pattern（承襲 20260608_170000_add_blog_categories.ts）。
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

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await tableExists(db, 'email_templates'))) {
    await db.run(sql`CREATE TABLE \`email_templates\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`event_key\` text NOT NULL,
      \`enabled\` integer DEFAULT true,
      \`subject\` text NOT NULL,
      \`preheader\` text,
      \`headline\` text NOT NULL,
      \`body_html\` text NOT NULL,
      \`preview_sample\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE UNIQUE INDEX \`email_templates_event_key_idx\` ON \`email_templates\` (\`event_key\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`email_templates_updated_at_idx\` ON \`email_templates\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`email_templates_created_at_idx\` ON \`email_templates\` (\`created_at\`);`,
    )
  }

  // payload_locked_documents_rels.email_templates_id FK（後台編輯鎖定用）
  if (await tableExists(db, 'payload_locked_documents_rels')) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', 'email_templates_id'))) {
      await db.run(
        sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`email_templates_id\` integer REFERENCES email_templates(id);`,
      )
      await db.run(
        sql`CREATE INDEX \`payload_locked_documents_rels_email_templates_id_idx\` ON \`payload_locked_documents_rels\` (\`email_templates_id\`);`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`email_templates\`;`)
  // SQLite DROP COLUMN 成本高，留 payload_locked_documents_rels.email_templates_id 不刪
}
