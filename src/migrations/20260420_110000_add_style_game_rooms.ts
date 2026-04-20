import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-1 games-social — style_game_rooms 主表 + participants 子表。
 *
 * 對照 src/collections/StyleGameRooms.ts：
 *   主表：id / room_code / game_type / host_id / capacity / visibility /
 *     invite_code / theme / settings / status / started_at / settled_at /
 *     expires_at / result_winner_id / result_total_submissions /
 *     result_total_votes / result_summary / metadata / created_at / updated_at
 *   子表 style_game_rooms_participants：_order / _parent_id / id /
 *     user_id / role / joined_at / status
 *
 * 唯一約束：
 *   UNIQUE room_code（NOT NULL + 全域 UNIQUE）
 *   UNIQUE invite_code partial WHERE invite_code IS NOT NULL（避免 NULL 衝突）
 *
 * 冪等：sqlite_master / PRAGMA 判斷；pattern 承襲 20260420_100000_add_style_submissions.ts。
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
  // ── 1. 主表 style_game_rooms ──
  if (!(await tableExists(db, 'style_game_rooms'))) {
    await db.run(sql`CREATE TABLE \`style_game_rooms\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`room_code\` text NOT NULL,
      \`game_type\` text NOT NULL,
      \`host_id\` integer NOT NULL,
      \`capacity\` numeric DEFAULT 2 NOT NULL,
      \`visibility\` text DEFAULT 'private' NOT NULL,
      \`invite_code\` text,
      \`theme\` text,
      \`settings\` text,
      \`status\` text DEFAULT 'waiting' NOT NULL,
      \`started_at\` text,
      \`settled_at\` text,
      \`expires_at\` text NOT NULL,
      \`result_winner_id\` integer,
      \`result_total_submissions\` numeric,
      \`result_total_votes\` numeric,
      \`result_summary\` text,
      \`metadata\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`host_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`result_winner_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    await db.run(sql`CREATE INDEX \`style_game_rooms_host_idx\` ON \`style_game_rooms\` (\`host_id\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_game_type_idx\` ON \`style_game_rooms\` (\`game_type\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_status_idx\` ON \`style_game_rooms\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_expires_at_idx\` ON \`style_game_rooms\` (\`expires_at\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_result_winner_idx\` ON \`style_game_rooms\` (\`result_winner_id\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_updated_at_idx\` ON \`style_game_rooms\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_created_at_idx\` ON \`style_game_rooms\` (\`created_at\`);`)
    // 複合 index：host 自己開的房列表、依 gameType/status 掃過期
    await db.run(sql`CREATE INDEX \`style_game_rooms_host_status_created_at_idx\` ON \`style_game_rooms\` (\`host_id\`, \`status\`, \`created_at\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_game_type_status_idx\` ON \`style_game_rooms\` (\`game_type\`, \`status\`);`)
    // UNIQUE room_code
    await db.run(sql`CREATE UNIQUE INDEX \`style_game_rooms_room_code_uniq\` ON \`style_game_rooms\` (\`room_code\`);`)
    // UNIQUE invite_code partial — 允許 NULL 重複，non-null 時唯一
    await db.run(sql`CREATE UNIQUE INDEX \`style_game_rooms_invite_code_uniq\` ON \`style_game_rooms\` (\`invite_code\`) WHERE \`invite_code\` IS NOT NULL;`)
  }

  // ── 2. 子表 style_game_rooms_participants ──
  if (!(await tableExists(db, 'style_game_rooms_participants'))) {
    await db.run(sql`CREATE TABLE \`style_game_rooms_participants\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`user_id\` integer NOT NULL,
      \`role\` text DEFAULT 'member' NOT NULL,
      \`joined_at\` text,
      \`status\` text DEFAULT 'active' NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`style_game_rooms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_participants_order_idx\` ON \`style_game_rooms_participants\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_participants_parent_id_idx\` ON \`style_game_rooms_participants\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`style_game_rooms_participants_user_idx\` ON \`style_game_rooms_participants\` (\`user_id\`);`)
  }

  // ── 3. payload_locked_documents_rels 加欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'style_game_rooms_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`style_game_rooms_id\` integer REFERENCES style_game_rooms(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_style_game_rooms_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_style_game_rooms_id_idx\` ON \`payload_locked_documents_rels\` (\`style_game_rooms_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'style_game_rooms_participants')) {
    await db.run(sql`DROP TABLE \`style_game_rooms_participants\`;`)
  }
  if (await tableExists(db, 'style_game_rooms')) {
    await db.run(sql`DROP TABLE \`style_game_rooms\`;`)
  }
}
