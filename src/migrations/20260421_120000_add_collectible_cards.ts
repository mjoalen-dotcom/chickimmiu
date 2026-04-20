import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 造型卡牌系統 — 3 collections。
 *
 * 對應 src/collections/CollectibleCardTemplates.ts + CollectibleCards.ts +
 *     CollectibleCardEvents.ts
 *
 * FK 策略：
 *   - product / owner / template / source_order 皆 ON DELETE set null（不串刪）
 *   - card_events.card_id ON DELETE cascade（卡刪了 audit 也沒意義）
 *     但實務上 cards 幾乎不會被 hard delete（status 轉 burned/revoked 取代）
 *
 * 原子性：mint 時的 nextSerialNo / *PoolRemaining 扣減靠 SQLite 單進程序列化
 *   寫入保證（跟 Orders.beforeChange 扣庫存同策略）；轉 Postgres 要改 FOR UPDATE。
 *
 * 冪等：sqlite_master / PRAGMA 判斷，承襲 20260420_100000_add_style_submissions.ts。
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
  // ── 1. collectible_card_templates ──
  if (!(await tableExists(db, 'collectible_card_templates'))) {
    await db.run(sql`CREATE TABLE \`collectible_card_templates\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`product_id\` integer NOT NULL,
      \`admin_title\` text NOT NULL,
      \`is_active\` integer DEFAULT 1 NOT NULL,
      \`total_supply\` numeric NOT NULL,
      \`sale_pool\` numeric NOT NULL,
      \`points_shop_pool\` numeric NOT NULL,
      \`crafting_pool\` numeric NOT NULL,
      \`sale_pool_remaining\` numeric NOT NULL,
      \`points_shop_pool_remaining\` numeric NOT NULL,
      \`crafting_pool_remaining\` numeric NOT NULL,
      \`next_serial_no\` numeric DEFAULT 1 NOT NULL,
      \`points_shop_price\` numeric NOT NULL,
      \`burn_points_reward\` numeric NOT NULL,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    await db.run(sql`CREATE UNIQUE INDEX \`collectible_card_templates_product_idx\` ON \`collectible_card_templates\` (\`product_id\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_templates_active_idx\` ON \`collectible_card_templates\` (\`is_active\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_templates_updated_at_idx\` ON \`collectible_card_templates\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_templates_created_at_idx\` ON \`collectible_card_templates\` (\`created_at\`);`)
  }

  // ── 2. collectible_cards ──
  if (!(await tableExists(db, 'collectible_cards'))) {
    await db.run(sql`CREATE TABLE \`collectible_cards\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`display_title\` text,
      \`card_type\` text NOT NULL,
      \`product_id\` integer NOT NULL,
      \`template_id\` integer,
      \`serial_no\` numeric,
      \`owner_id\` integer,
      \`original_owner_id\` integer,
      \`status\` text DEFAULT 'active' NOT NULL,
      \`minted_via\` text NOT NULL,
      \`source_order_id\` integer,
      \`minted_at\` text NOT NULL,
      \`design_seed\` text NOT NULL,
      \`share_slug\` text NOT NULL,
      \`owner_nickname_snapshot\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`template_id\`) REFERENCES \`collectible_card_templates\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`owner_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`original_owner_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`source_order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    await db.run(sql`CREATE UNIQUE INDEX \`collectible_cards_share_slug_idx\` ON \`collectible_cards\` (\`share_slug\`);`)
    // SQLite treats multiple NULLs as distinct in UNIQUE → common 卡 (template_id NULL, serial_no NULL)
    // 多張共存不衝突，limited 卡 (template_id, serial_no) 組合唯一。
    await db.run(sql`CREATE UNIQUE INDEX \`collectible_cards_template_serial_idx\` ON \`collectible_cards\` (\`template_id\`, \`serial_no\`);`)
    await db.run(sql`CREATE INDEX \`collectible_cards_product_idx\` ON \`collectible_cards\` (\`product_id\`);`)
    await db.run(sql`CREATE INDEX \`collectible_cards_owner_idx\` ON \`collectible_cards\` (\`owner_id\`);`)
    await db.run(sql`CREATE INDEX \`collectible_cards_status_idx\` ON \`collectible_cards\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`collectible_cards_source_order_idx\` ON \`collectible_cards\` (\`source_order_id\`);`)
    // 會員我的收藏頁：owner + status 同時過濾
    await db.run(sql`CREATE INDEX \`collectible_cards_owner_status_idx\` ON \`collectible_cards\` (\`owner_id\`, \`status\`);`)
    await db.run(sql`CREATE INDEX \`collectible_cards_updated_at_idx\` ON \`collectible_cards\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`collectible_cards_created_at_idx\` ON \`collectible_cards\` (\`created_at\`);`)
  }

  // ── 3. collectible_card_events ──
  if (!(await tableExists(db, 'collectible_card_events'))) {
    await db.run(sql`CREATE TABLE \`collectible_card_events\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`card_id\` integer NOT NULL,
      \`action\` text NOT NULL,
      \`from_user_id\` integer,
      \`to_user_id\` integer,
      \`points_delta\` numeric,
      \`source_order_id\` integer,
      \`notes\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`card_id\`) REFERENCES \`collectible_cards\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`from_user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`to_user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`source_order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    await db.run(sql`CREATE INDEX \`collectible_card_events_card_idx\` ON \`collectible_card_events\` (\`card_id\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_events_action_idx\` ON \`collectible_card_events\` (\`action\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_events_from_user_idx\` ON \`collectible_card_events\` (\`from_user_id\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_events_to_user_idx\` ON \`collectible_card_events\` (\`to_user_id\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_events_source_order_idx\` ON \`collectible_card_events\` (\`source_order_id\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_events_updated_at_idx\` ON \`collectible_card_events\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`collectible_card_events_created_at_idx\` ON \`collectible_card_events\` (\`created_at\`);`)
  }

  // ── 4. payload_locked_documents_rels 三個 FK 欄位 ──
  for (const col of [
    'collectible_card_templates_id',
    'collectible_cards_id',
    'collectible_card_events_id',
  ]) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', col))) {
      const target = col.replace(/_id$/, '')
      await db.run(
        sql.raw(
          `ALTER TABLE \`payload_locked_documents_rels\` ADD \`${col}\` integer REFERENCES ${target}(id);`,
        ),
      )
    }
    const idx = `payload_locked_documents_rels_${col.replace(/_id$/, '')}_id_idx`
    if (!(await indexExists(db, idx))) {
      await db.run(
        sql.raw(`CREATE INDEX \`${idx}\` ON \`payload_locked_documents_rels\` (\`${col}\`);`),
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'collectible_card_events')) {
    await db.run(sql`DROP TABLE \`collectible_card_events\`;`)
  }
  if (await tableExists(db, 'collectible_cards')) {
    await db.run(sql`DROP TABLE \`collectible_cards\`;`)
  }
  if (await tableExists(db, 'collectible_card_templates')) {
    await db.run(sql`DROP TABLE \`collectible_card_templates\`;`)
  }
  // 刻意不 DROP payload_locked_documents_rels 的欄位（SQLite 成本高）
}
