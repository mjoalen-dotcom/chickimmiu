import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 消費者分析 — BehaviorEvents collection
 *   新增 `behavior_events` 表 + 在 `payload_locked_documents_rels` 加 FK 欄位。
 *
 * 冪等：用 sqlite_master / PRAGMA 判斷是否已存在，跑在：
 *   (a) 乾淨 DB：正常建表
 *   (b) dev 已 push schema 的 DB：skip
 *   (c) prod 第一次 migrate：正常建表
 * Pattern 承襲 20260418_220000_add_login_attempts.ts
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
  if (!(await tableExists(db, 'behavior_events'))) {
    await db.run(sql`CREATE TABLE \`behavior_events\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`event_type\` text NOT NULL,
      \`session_id\` text NOT NULL,
      \`user_id\` integer REFERENCES users(id) ON DELETE SET NULL,
      \`page_path\` text NOT NULL,
      \`product_id\` integer REFERENCES products(id) ON DELETE SET NULL,
      \`element_key\` text,
      \`value\` numeric,
      \`quantity\` numeric,
      \`duration_ms\` numeric,
      \`scroll_pct_max\` numeric,
      \`search_query\` text,
      \`utm_source\` text,
      \`utm_medium\` text,
      \`utm_campaign\` text,
      \`referrer\` text,
      \`landing_path\` text,
      \`device_type\` text,
      \`country_code\` text,
      \`meta\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE INDEX \`behavior_events_event_type_idx\` ON \`behavior_events\` (\`event_type\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_session_id_idx\` ON \`behavior_events\` (\`session_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_user_id_idx\` ON \`behavior_events\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_page_path_idx\` ON \`behavior_events\` (\`page_path\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_product_id_idx\` ON \`behavior_events\` (\`product_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_utm_source_idx\` ON \`behavior_events\` (\`utm_source\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_utm_campaign_idx\` ON \`behavior_events\` (\`utm_campaign\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_device_type_idx\` ON \`behavior_events\` (\`device_type\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_created_at_idx\` ON \`behavior_events\` (\`created_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`behavior_events_event_type_created_at_idx\` ON \`behavior_events\` (\`event_type\`, \`created_at\`);`,
    )
  }

  if (!(await columnExists(db, 'payload_locked_documents_rels', 'behavior_events_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`behavior_events_id\` integer REFERENCES behavior_events(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_behavior_events_id_idx\` ON \`payload_locked_documents_rels\` (\`behavior_events_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'behavior_events')) {
    await db.run(sql`DROP TABLE \`behavior_events\`;`)
  }
  // 刻意不 DROP COLUMN behavior_events_id（SQLite 成本太高），留著為 dangling FK；無害。
}
