import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR 1 — 多幣別前置 schema
 *
 * 新增 1 張主表（無 hasMany / 無 relationship → 不需要 _rels 表）：
 *   - currencies（code / label / symbol / rate_against_twd / decimal_places /
 *     is_active / display_order / description + timestamps）
 *
 * 另加 payload_locked_documents_rels.currencies_id FK + index（Payload v3
 *   admin lock 機制要求所有 collection 都掛上 FK）。
 *
 * 冪等：sqlite_master / PRAGMA 判斷已存在直接 skip；pattern 承襲
 *   20260422_100000_add_coupons.ts。
 *
 * 不含 seed — 種子資料寫在 src/seed/run.ts（idempotent upsert by code）。
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
  // ── 1. currencies 主表 ──
  if (!(await tableExists(db, 'currencies'))) {
    await db.run(sql`CREATE TABLE \`currencies\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`code\` text NOT NULL,
      \`label\` text NOT NULL,
      \`symbol\` text NOT NULL,
      \`rate_against_twd\` numeric DEFAULT 1 NOT NULL,
      \`decimal_places\` numeric DEFAULT 0,
      \`is_active\` integer DEFAULT true,
      \`display_order\` numeric DEFAULT 100,
      \`description\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`currencies_code_idx\` ON \`currencies\` (\`code\`);`)
    await db.run(
      sql`CREATE INDEX \`currencies_is_active_idx\` ON \`currencies\` (\`is_active\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`currencies_display_order_idx\` ON \`currencies\` (\`display_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`currencies_updated_at_idx\` ON \`currencies\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`currencies_created_at_idx\` ON \`currencies\` (\`created_at\`);`,
    )
  }

  // ── 2. payload_locked_documents_rels FK 欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'currencies_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`currencies_id\` integer REFERENCES currencies(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_currencies_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_currencies_id_idx\` ON \`payload_locked_documents_rels\` (\`currencies_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // SQLite 3.35+ 支援 DROP COLUMN，但 libSQL 版本不保證；保留結構無副作用。
  void db
}
