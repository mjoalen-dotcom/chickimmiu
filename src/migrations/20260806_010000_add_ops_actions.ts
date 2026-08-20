import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 營運 AI 助理 — OpsActions collection
 *   新增 `ops_actions` 表 + 在 `payload_locked_documents_rels` 加 FK 欄位。
 *
 * 這張表是 L2 授權模型（AI 提案 / 人核准）的稽核軌跡：
 *   AI 只能寫 status='pending' 的列；真正的執行由
 *   /api/ops-copilot/actions/[id]/execute 在 admin 認證後觸發並回寫結果。
 *
 * 欄位對應（Payload SQLite 命名慣例：camelCase → snake_case）：
 *   input / previewSnapshot / affected 是 json 欄位 → SQLite 存 text
 *   decidedBy 是 users relationship → decided_by_id integer FK
 *
 * 冪等：用 sqlite_master / PRAGMA 判斷，可安全重跑。
 * Pattern 承襲 20260418_220000_add_login_attempts.ts
 *
 * down：DROP TABLE，但不動 locked_documents_rels 欄位
 *   （SQLite DROP COLUMN 要 rebuild 整張表，代價太高；留著 dangling FK column 無害）
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
  if (!(await tableExists(db, 'ops_actions'))) {
    await db.run(sql`CREATE TABLE \`ops_actions\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`summary\` text NOT NULL,
      \`action_type\` text NOT NULL,
      \`risk\` text DEFAULT 'low',
      \`status\` text DEFAULT 'pending' NOT NULL,
      \`input\` text NOT NULL,
      \`source_signal_id\` text,
      \`preview_snapshot\` text,
      \`result_message\` text,
      \`affected\` text,
      \`error\` text,
      \`decided_by_id\` integer,
      \`decided_at\` text,
      \`admin_note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`decided_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    // status / action_type / source_signal_id 有 index：待辦清單與日報去重每次都用這三個查
    await db.run(
      sql`CREATE INDEX \`ops_actions_status_idx\` ON \`ops_actions\` (\`status\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ops_actions_action_type_idx\` ON \`ops_actions\` (\`action_type\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ops_actions_source_signal_id_idx\` ON \`ops_actions\` (\`source_signal_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ops_actions_decided_by_idx\` ON \`ops_actions\` (\`decided_by_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ops_actions_updated_at_idx\` ON \`ops_actions\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ops_actions_created_at_idx\` ON \`ops_actions\` (\`created_at\`);`,
    )
  }

  if (!(await columnExists(db, 'payload_locked_documents_rels', 'ops_actions_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`ops_actions_id\` integer REFERENCES ops_actions(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_ops_actions_id_idx\` ON \`payload_locked_documents_rels\` (\`ops_actions_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'ops_actions')) {
    await db.run(sql`DROP TABLE \`ops_actions\`;`)
  }
  // 刻意不 DROP COLUMN ops_actions_id（SQLite 成本太高），留著為 dangling FK；無害。
}
