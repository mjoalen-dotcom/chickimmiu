import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 2 B 組 — 電子報訂閱 + 收藏清單 DB 持久化
 *   新增 `newsletter_subscribers` 表（首頁訂閱表單寫入）
 *   新增 `wishlist_items` 表（會員收藏跨裝置持久化，row-per-item）
 *   並在 `payload_locked_documents_rels` 補兩個 FK 欄位。
 *
 * 冪等：用 sqlite_master / PRAGMA 判斷是否已存在，跑在：
 *   (a) 乾淨 DB：正常建表
 *   (b) dev 已 push schema 的 DB：skip
 *   (c) prod 第一次 migrate：正常建表
 * Pattern 承襲 20260510_120000_add_behavior_events.ts
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
  // ── 電子報訂閱名單 ──
  if (!(await tableExists(db, 'newsletter_subscribers'))) {
    await db.run(sql`CREATE TABLE \`newsletter_subscribers\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`email\` text NOT NULL,
      \`status\` text DEFAULT 'subscribed' NOT NULL,
      \`name\` text,
      \`source\` text DEFAULT 'homepage',
      \`user_id\` integer REFERENCES users(id) ON DELETE SET NULL,
      \`locale\` text,
      \`unsubscribe_token\` text,
      \`confirmed_at\` text,
      \`unsubscribed_at\` text,
      \`ip_address\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE UNIQUE INDEX \`newsletter_subscribers_email_idx\` ON \`newsletter_subscribers\` (\`email\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`newsletter_subscribers_status_idx\` ON \`newsletter_subscribers\` (\`status\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`newsletter_subscribers_source_idx\` ON \`newsletter_subscribers\` (\`source\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`newsletter_subscribers_user_id_idx\` ON \`newsletter_subscribers\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`newsletter_subscribers_unsubscribe_token_idx\` ON \`newsletter_subscribers\` (\`unsubscribe_token\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`newsletter_subscribers_created_at_idx\` ON \`newsletter_subscribers\` (\`created_at\`);`,
    )
  }

  // ── 收藏清單（row-per-item） ──
  if (!(await tableExists(db, 'wishlist_items'))) {
    await db.run(sql`CREATE TABLE \`wishlist_items\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`user_id\` integer REFERENCES users(id) ON DELETE SET NULL,
      \`product_id\` integer REFERENCES products(id) ON DELETE SET NULL,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE INDEX \`wishlist_items_user_id_idx\` ON \`wishlist_items\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wishlist_items_product_id_idx\` ON \`wishlist_items\` (\`product_id\`);`,
    )
    await db.run(
      sql`CREATE UNIQUE INDEX \`wishlist_items_user_id_product_id_idx\` ON \`wishlist_items\` (\`user_id\`, \`product_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wishlist_items_created_at_idx\` ON \`wishlist_items\` (\`created_at\`);`,
    )
  }

  // ── payload_locked_documents_rels FK 欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'newsletter_subscribers_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`newsletter_subscribers_id\` integer REFERENCES newsletter_subscribers(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_newsletter_subscribers_id_idx\` ON \`payload_locked_documents_rels\` (\`newsletter_subscribers_id\`);`,
    )
  }
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'wishlist_items_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`wishlist_items_id\` integer REFERENCES wishlist_items(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_wishlist_items_id_idx\` ON \`payload_locked_documents_rels\` (\`wishlist_items_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'wishlist_items')) {
    await db.run(sql`DROP TABLE \`wishlist_items\`;`)
  }
  if (await tableExists(db, 'newsletter_subscribers')) {
    await db.run(sql`DROP TABLE \`newsletter_subscribers\`;`)
  }
  // 刻意不 DROP COLUMN（SQLite 成本太高），留著 dangling FK column；無害。
}
