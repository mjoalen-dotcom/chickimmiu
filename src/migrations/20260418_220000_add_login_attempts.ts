import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.7 Security — LoginAttempts collection
 *   新增 `login_attempts` 表 + 在 `payload_locked_documents_rels` 加 FK 欄位。
 *
 * 冪等：用 sqlite_master / PRAGMA 判斷是否已存在，跑在：
 *   (a) 乾淨 DB：正常建表
 *   (b) dev 已 push schema 的 DB：skip
 *   (c) prod 第一次 migrate：正常建表
 * Pattern 承襲 20260417_100000_add_stored_value_balance.ts
 *
 * down：DROP TABLE + 不動 locked_documents_rels 欄位（SQLite DROP COLUMN
 *   pre-3.35 要 rebuild 整張表，代價太高，留著 dangling FK column 無害）
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
  if (!(await tableExists(db, 'login_attempts'))) {
    await db.run(sql`CREATE TABLE \`login_attempts\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`email\` text,
      \`user_id\` text,
      \`ip\` text,
      \`user_agent\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE INDEX \`login_attempts_email_idx\` ON \`login_attempts\` (\`email\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`login_attempts_user_id_idx\` ON \`login_attempts\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`login_attempts_updated_at_idx\` ON \`login_attempts\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`login_attempts_created_at_idx\` ON \`login_attempts\` (\`created_at\`);`,
    )
  }

  if (!(await columnExists(db, 'payload_locked_documents_rels', 'login_attempts_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`login_attempts_id\` integer REFERENCES login_attempts(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_login_attempts_id_idx\` ON \`payload_locked_documents_rels\` (\`login_attempts_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'login_attempts')) {
    await db.run(sql`DROP TABLE \`login_attempts\`;`)
  }
  // 刻意不 DROP COLUMN login_attempts_id（SQLite 成本太高），留著為 dangling FK；無害。
}
