import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-B — UTM 商品歸因 schema：
 *   1. New table `product_view_events` — 每次 PDP 瀏覽 + UTM 落庫
 *   2. New table `utm_campaigns` — 集中管理 UTM 活動 slug（Builder 用）
 *   3. Orders.attribution group → 14 個 attribution_* 欄位
 *      (firstTouch + lastTouch 各 7 欄: utm_source/medium/campaign/term/content/referrer/captured_at)
 *   4. Users.firstTouchAttribution group → 8 個 first_touch_attribution_* 欄位
 *      (上面 7 欄 + landing_path)
 *
 * 冪等：用 PRAGMA + sqlite_master 判斷，已存在 skip。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, name: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${name}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ─────────────── product_view_events ───────────────
  if (!(await tableExists(db, 'product_view_events'))) {
    await db.run(sql`CREATE TABLE \`product_view_events\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`product_id\` integer NOT NULL,
      \`session_id\` text NOT NULL,
      \`user_id\` integer,
      \`utm_source\` text,
      \`utm_medium\` text,
      \`utm_campaign\` text,
      \`utm_term\` text,
      \`utm_content\` text,
      \`referrer\` text,
      \`landing_path\` text,
      \`device_type\` text,
      \`country_code\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
  }
  // index 為了報表頁聚合查詢效能
  if (!(await indexExists(db, 'product_view_events_product_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`product_view_events_product_id_idx\` ON \`product_view_events\` (\`product_id\`);`,
    )
  }
  if (!(await indexExists(db, 'product_view_events_session_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`product_view_events_session_id_idx\` ON \`product_view_events\` (\`session_id\`);`,
    )
  }
  if (!(await indexExists(db, 'product_view_events_utm_source_idx'))) {
    await db.run(
      sql`CREATE INDEX \`product_view_events_utm_source_idx\` ON \`product_view_events\` (\`utm_source\`);`,
    )
  }
  if (!(await indexExists(db, 'product_view_events_utm_campaign_idx'))) {
    await db.run(
      sql`CREATE INDEX \`product_view_events_utm_campaign_idx\` ON \`product_view_events\` (\`utm_campaign\`);`,
    )
  }
  if (!(await indexExists(db, 'product_view_events_created_at_idx'))) {
    await db.run(
      sql`CREATE INDEX \`product_view_events_created_at_idx\` ON \`product_view_events\` (\`created_at\`);`,
    )
  }

  // ─────────────── utm_campaigns ───────────────
  if (!(await tableExists(db, 'utm_campaigns'))) {
    await db.run(sql`CREATE TABLE \`utm_campaigns\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`utm_camp_source\` text DEFAULT 'facebook' NOT NULL,
      \`utm_camp_medium\` text DEFAULT 'cpc' NOT NULL,
      \`default_content\` text,
      \`default_term\` text,
      \`start_date\` text,
      \`end_date\` text,
      \`budget\` numeric,
      \`spend\` numeric,
      \`utm_camp_status\` text DEFAULT 'planning',
      \`campaign_notes\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE UNIQUE INDEX \`utm_campaigns_slug_idx\` ON \`utm_campaigns\` (\`slug\`);`,
    )
  }

  // ─────────────── orders.attribution_* (14 cols) ───────────────
  const orderAttrCols = [
    'attribution_first_touch_utm_source',
    'attribution_first_touch_utm_medium',
    'attribution_first_touch_utm_campaign',
    'attribution_first_touch_utm_term',
    'attribution_first_touch_utm_content',
    'attribution_first_touch_referrer',
    'attribution_first_touch_captured_at',
    'attribution_last_touch_utm_source',
    'attribution_last_touch_utm_medium',
    'attribution_last_touch_utm_campaign',
    'attribution_last_touch_utm_term',
    'attribution_last_touch_utm_content',
    'attribution_last_touch_referrer',
    'attribution_last_touch_captured_at',
  ]
  for (const c of orderAttrCols) {
    if (!(await columnExists(db, 'orders', c))) {
      await db.run(sql.raw(`ALTER TABLE \`orders\` ADD COLUMN \`${c}\` text;`))
    }
  }

  // ─────────────── users.first_touch_attribution_* (8 cols) ───────────────
  const userAttrCols = [
    'first_touch_attribution_utm_source',
    'first_touch_attribution_utm_medium',
    'first_touch_attribution_utm_campaign',
    'first_touch_attribution_utm_term',
    'first_touch_attribution_utm_content',
    'first_touch_attribution_referrer',
    'first_touch_attribution_landing_path',
    'first_touch_attribution_captured_at',
  ]
  for (const c of userAttrCols) {
    if (!(await columnExists(db, 'users', c))) {
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${c}\` text;`))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 刪 columns
  const userAttrCols = [
    'first_touch_attribution_utm_source',
    'first_touch_attribution_utm_medium',
    'first_touch_attribution_utm_campaign',
    'first_touch_attribution_utm_term',
    'first_touch_attribution_utm_content',
    'first_touch_attribution_referrer',
    'first_touch_attribution_landing_path',
    'first_touch_attribution_captured_at',
  ]
  for (const c of userAttrCols) {
    if (await columnExists(db, 'users', c)) {
      await db.run(sql.raw(`ALTER TABLE \`users\` DROP COLUMN \`${c}\`;`))
    }
  }
  const orderAttrCols = [
    'attribution_first_touch_utm_source',
    'attribution_first_touch_utm_medium',
    'attribution_first_touch_utm_campaign',
    'attribution_first_touch_utm_term',
    'attribution_first_touch_utm_content',
    'attribution_first_touch_referrer',
    'attribution_first_touch_captured_at',
    'attribution_last_touch_utm_source',
    'attribution_last_touch_utm_medium',
    'attribution_last_touch_utm_campaign',
    'attribution_last_touch_utm_term',
    'attribution_last_touch_utm_content',
    'attribution_last_touch_referrer',
    'attribution_last_touch_captured_at',
  ]
  for (const c of orderAttrCols) {
    if (await columnExists(db, 'orders', c)) {
      await db.run(sql.raw(`ALTER TABLE \`orders\` DROP COLUMN \`${c}\`;`))
    }
  }
  // 刪 tables
  if (await tableExists(db, 'utm_campaigns')) {
    await db.run(sql`DROP TABLE \`utm_campaigns\`;`)
  }
  if (await tableExists(db, 'product_view_events')) {
    await db.run(sql`DROP TABLE \`product_view_events\`;`)
  }
}
