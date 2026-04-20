import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-1 games-social — style_submissions 主表 + images / tags 兩個 array 子表。
 *
 * 對照 src/collections/StyleSubmissions.ts：
 *   主表 style_submissions：id / player_id / game_type / room_id / parent_id /
 *     wish_id / theme / caption / status / rank / vote_count / view_count /
 *     player_tier_snapshot / moderation_reviewed_by_id / moderation_reviewed_at /
 *     moderation_note / metadata / created_at / updated_at
 *   子表 style_submissions_images：_order / _parent_id / id / image_id
 *   子表 style_submissions_tags：_order / _parent_id / id / tag
 *
 * FK 策略：所有 relationship `ON DELETE set null`（沿用 UserRewards pattern）；
 * array 子表 `_parent_id ON DELETE cascade`（Payload 預設）。
 *
 * 跨表 FK（room_id → style_game_rooms, wish_id → style_wishes）：SQLite 存
 * FOREIGN KEY 在 schema 但不 enforce 到 INSERT/UPDATE 時才查，所以 migration
 * 跑完全部 4 支後才會有資料寫入，cross-FK 目標表屆時已建。
 *
 * 冪等：sqlite_master / PRAGMA 判斷；pattern 承襲 20260419_210000_add_user_rewards.ts。
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
  // ── 1. 主表 style_submissions ──
  if (!(await tableExists(db, 'style_submissions'))) {
    await db.run(sql`CREATE TABLE \`style_submissions\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`player_id\` integer NOT NULL,
      \`game_type\` text NOT NULL,
      \`room_id\` integer,
      \`parent_id\` integer,
      \`wish_id\` integer,
      \`theme\` text,
      \`caption\` text,
      \`status\` text DEFAULT 'submitted' NOT NULL,
      \`rank\` numeric,
      \`vote_count\` numeric DEFAULT 0,
      \`view_count\` numeric DEFAULT 0,
      \`player_tier_snapshot\` text,
      \`moderation_reviewed_by_id\` integer,
      \`moderation_reviewed_at\` text,
      \`moderation_note\` text,
      \`metadata\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`player_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`room_id\`) REFERENCES \`style_game_rooms\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`style_submissions\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`wish_id\`) REFERENCES \`style_wishes\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`moderation_reviewed_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    // 主要查詢 index：我的作品列表、各遊戲公開 feed
    await db.run(sql`CREATE INDEX \`style_submissions_player_idx\` ON \`style_submissions\` (\`player_id\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_game_type_idx\` ON \`style_submissions\` (\`game_type\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_room_idx\` ON \`style_submissions\` (\`room_id\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_parent_idx\` ON \`style_submissions\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_wish_idx\` ON \`style_submissions\` (\`wish_id\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_status_idx\` ON \`style_submissions\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_moderation_reviewed_by_idx\` ON \`style_submissions\` (\`moderation_reviewed_by_id\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_updated_at_idx\` ON \`style_submissions\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_created_at_idx\` ON \`style_submissions\` (\`created_at\`);`)
    // 複合 index：各遊戲公開 feed 排序
    await db.run(sql`CREATE INDEX \`style_submissions_game_type_status_created_at_idx\` ON \`style_submissions\` (\`game_type\`, \`status\`, \`created_at\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_player_game_type_created_at_idx\` ON \`style_submissions\` (\`player_id\`, \`game_type\`, \`created_at\`);`)
  }

  // ── 2. 子表 style_submissions_images ──
  if (!(await tableExists(db, 'style_submissions_images'))) {
    await db.run(sql`CREATE TABLE \`style_submissions_images\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`image_id\` integer NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`style_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`style_submissions_images_order_idx\` ON \`style_submissions_images\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_images_parent_id_idx\` ON \`style_submissions_images\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_images_image_idx\` ON \`style_submissions_images\` (\`image_id\`);`)
  }

  // ── 3. 子表 style_submissions_tags ──
  if (!(await tableExists(db, 'style_submissions_tags'))) {
    await db.run(sql`CREATE TABLE \`style_submissions_tags\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`tag\` text NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`style_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`style_submissions_tags_order_idx\` ON \`style_submissions_tags\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`style_submissions_tags_parent_id_idx\` ON \`style_submissions_tags\` (\`_parent_id\`);`)
  }

  // ── 4. payload_locked_documents_rels 加欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'style_submissions_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`style_submissions_id\` integer REFERENCES style_submissions(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_style_submissions_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_style_submissions_id_idx\` ON \`payload_locked_documents_rels\` (\`style_submissions_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'style_submissions_tags')) {
    await db.run(sql`DROP TABLE \`style_submissions_tags\`;`)
  }
  if (await tableExists(db, 'style_submissions_images')) {
    await db.run(sql`DROP TABLE \`style_submissions_images\`;`)
  }
  if (await tableExists(db, 'style_submissions')) {
    await db.run(sql`DROP TABLE \`style_submissions\`;`)
  }
  // 刻意不 DROP style_submissions_id 欄位（SQLite 成本高），dangling FK 無害
}
