import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 3 寶物箱兌換系統 PR-A — user_rewards table
 *
 * 欄位對照 src/collections/UserRewards.ts：
 *   id / user_id (FK users) / source_record_id (FK mini_game_records) /
 *   reward_type / display_name / amount / coupon_code (UNIQUE partial) /
 *   redemption_instructions / state / attached_to_order_id (FK orders) /
 *   shipped_at / consumed_at / expires_at / requires_physical_shipping /
 *   created_at / updated_at
 *
 * 冪等：用 sqlite_master / PRAGMA 判斷是否已存在；跑在
 *   (a) 乾淨 DB：正常建表
 *   (b) dev 已 push schema 的 DB：skip
 *   (c) prod 第一次 migrate：正常建表
 * Pattern 承襲 20260418_220000_add_login_attempts.ts。
 *
 * coupon_code 要允許 NULL 但 non-null 時必須 unique →
 * 用 SQLite partial index `WHERE coupon_code IS NOT NULL`。
 *
 * down：DROP TABLE；不動 locked_documents_rels 欄位（成本高，dangling FK 無害）。
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

async function indexExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  index: string,
): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${index}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await tableExists(db, 'user_rewards'))) {
    await db.run(sql`CREATE TABLE \`user_rewards\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`user_id\` integer NOT NULL,
      \`source_record_id\` integer,
      \`reward_type\` text NOT NULL,
      \`display_name\` text NOT NULL,
      \`amount\` numeric,
      \`coupon_code\` text,
      \`redemption_instructions\` text,
      \`state\` text DEFAULT 'unused' NOT NULL,
      \`attached_to_order_id\` integer,
      \`shipped_at\` text,
      \`consumed_at\` text,
      \`expires_at\` text NOT NULL,
      \`requires_physical_shipping\` integer DEFAULT true,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`source_record_id\`) REFERENCES \`mini_game_records\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`attached_to_order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    await db.run(
      sql`CREATE INDEX \`user_rewards_user_idx\` ON \`user_rewards\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_rewards_source_record_idx\` ON \`user_rewards\` (\`source_record_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_rewards_attached_to_order_idx\` ON \`user_rewards\` (\`attached_to_order_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_rewards_state_idx\` ON \`user_rewards\` (\`state\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_rewards_expires_at_idx\` ON \`user_rewards\` (\`expires_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_rewards_updated_at_idx\` ON \`user_rewards\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_rewards_created_at_idx\` ON \`user_rewards\` (\`created_at\`);`,
    )
    // coupon_code UNIQUE partial — 允許 NULL 重複，non-null 時唯一
    await db.run(
      sql`CREATE UNIQUE INDEX \`user_rewards_coupon_code_uniq\` ON \`user_rewards\` (\`coupon_code\`) WHERE \`coupon_code\` IS NOT NULL;`,
    )
  }

  if (!(await columnExists(db, 'payload_locked_documents_rels', 'user_rewards_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`user_rewards_id\` integer REFERENCES user_rewards(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_user_rewards_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_user_rewards_id_idx\` ON \`payload_locked_documents_rels\` (\`user_rewards_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'user_rewards')) {
    await db.run(sql`DROP TABLE \`user_rewards\`;`)
  }
  // 刻意不 DROP COLUMN user_rewards_id（SQLite 成本太高），留著為 dangling FK；無害。
}
