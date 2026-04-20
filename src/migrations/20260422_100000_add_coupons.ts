import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Shopline-gap 19A — Coupons + CouponRedemptions
 *
 * 新增 3 張主表 + 1 張 rels 表：
 *   - coupons (主表)
 *   - coupons_rels (Coupons.conditions.productInclude / productExclude 兩個 hasMany)
 *   - coupon_redemptions (主表；coupon / user / order 是單 relationship → 用 scalar FK col)
 *   - orders 加欄位：coupon_code / coupon_id / subtotal_before_discount
 *     （discount_amount 原本已存在，不動）
 *   - payload_locked_documents_rels 加 coupons_id / coupon_redemptions_id 欄 (+index)
 *
 * 冪等：sqlite_master / PRAGMA 判斷；pattern 承襲 20260420_100000_add_style_submissions.ts
 *
 * 注意：
 *   - 單 relationship (conditions.tierRequired / coupon_redemptions.coupon/user/order)
 *     在 Payload v3 SQLite 全部落成 scalar FK 欄位；hasMany 才走 _rels 表。
 *     group 內單 relationship 用 group-prefix 展平（conditions.tierRequired →
 *     `conditions_tier_required_id`）。
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
  // ── 1. coupons 主表 ──
  if (!(await tableExists(db, 'coupons'))) {
    await db.run(sql`CREATE TABLE \`coupons\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`code\` text NOT NULL,
      \`name\` text NOT NULL,
      \`description\` text,
      \`discount_type\` text DEFAULT 'percentage' NOT NULL,
      \`discount_value\` numeric NOT NULL,
      \`max_discount_amount\` numeric,
      \`min_order_amount\` numeric DEFAULT 0,
      \`usage_limit\` numeric,
      \`usage_count\` numeric DEFAULT 0,
      \`usage_limit_per_user\` numeric DEFAULT 1,
      \`starts_at\` text,
      \`expires_at\` text,
      \`is_active\` integer DEFAULT true,
      \`conditions_tier_required_id\` integer,
      \`conditions_first_order_only\` integer DEFAULT false,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`conditions_tier_required_id\`) REFERENCES \`membership_tiers\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`coupons_code_idx\` ON \`coupons\` (\`code\`);`)
    await db.run(sql`CREATE INDEX \`coupons_is_active_idx\` ON \`coupons\` (\`is_active\`);`)
    await db.run(sql`CREATE INDEX \`coupons_expires_at_idx\` ON \`coupons\` (\`expires_at\`);`)
    await db.run(sql`CREATE INDEX \`coupons_conditions_tier_required_id_idx\` ON \`coupons\` (\`conditions_tier_required_id\`);`)
    await db.run(sql`CREATE INDEX \`coupons_updated_at_idx\` ON \`coupons\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`coupons_created_at_idx\` ON \`coupons\` (\`created_at\`);`)
  }

  // ── 2. coupons_rels（productInclude / productExclude 兩個 hasMany） ──
  if (!(await tableExists(db, 'coupons_rels'))) {
    await db.run(sql`CREATE TABLE \`coupons_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`products_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`coupons\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`coupons_rels_order_idx\` ON \`coupons_rels\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`coupons_rels_parent_idx\` ON \`coupons_rels\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`coupons_rels_path_idx\` ON \`coupons_rels\` (\`path\`);`)
    await db.run(sql`CREATE INDEX \`coupons_rels_products_id_idx\` ON \`coupons_rels\` (\`products_id\`);`)
  }

  // ── 3. coupon_redemptions 主表 ──
  if (!(await tableExists(db, 'coupon_redemptions'))) {
    await db.run(sql`CREATE TABLE \`coupon_redemptions\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`coupon_id\` integer NOT NULL,
      \`user_id\` integer,
      \`order_id\` integer NOT NULL,
      \`discount_amount\` numeric NOT NULL,
      \`redeemed_at\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`coupon_id\`) REFERENCES \`coupons\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`coupon_redemptions_coupon_idx\` ON \`coupon_redemptions\` (\`coupon_id\`);`)
    await db.run(sql`CREATE INDEX \`coupon_redemptions_user_idx\` ON \`coupon_redemptions\` (\`user_id\`);`)
    await db.run(sql`CREATE INDEX \`coupon_redemptions_order_idx\` ON \`coupon_redemptions\` (\`order_id\`);`)
    await db.run(sql`CREATE INDEX \`coupon_redemptions_updated_at_idx\` ON \`coupon_redemptions\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`coupon_redemptions_created_at_idx\` ON \`coupon_redemptions\` (\`created_at\`);`)
  }

  // ── 4. orders 加欄位（discount_amount 已存在，不動） ──
  if (!(await columnExists(db, 'orders', 'coupon_code'))) {
    await db.run(sql`ALTER TABLE \`orders\` ADD \`coupon_code\` text;`)
  }
  if (!(await columnExists(db, 'orders', 'coupon_id'))) {
    await db.run(
      sql`ALTER TABLE \`orders\` ADD \`coupon_id\` integer REFERENCES coupons(id);`,
    )
  }
  if (!(await indexExists(db, 'orders_coupon_id_idx'))) {
    await db.run(sql`CREATE INDEX \`orders_coupon_id_idx\` ON \`orders\` (\`coupon_id\`);`)
  }
  if (!(await columnExists(db, 'orders', 'subtotal_before_discount'))) {
    await db.run(sql`ALTER TABLE \`orders\` ADD \`subtotal_before_discount\` numeric DEFAULT 0;`)
  }

  // ── 5. payload_locked_documents_rels FK 欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'coupons_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`coupons_id\` integer REFERENCES coupons(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_coupons_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_coupons_id_idx\` ON \`payload_locked_documents_rels\` (\`coupons_id\`);`,
    )
  }
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'coupon_redemptions_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`coupon_redemptions_id\` integer REFERENCES coupon_redemptions(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_coupon_redemptions_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_coupon_redemptions_id_idx\` ON \`payload_locked_documents_rels\` (\`coupon_redemptions_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'coupon_redemptions')) {
    await db.run(sql`DROP TABLE \`coupon_redemptions\`;`)
  }
  if (await tableExists(db, 'coupons_rels')) {
    await db.run(sql`DROP TABLE \`coupons_rels\`;`)
  }
  if (await tableExists(db, 'coupons')) {
    await db.run(sql`DROP TABLE \`coupons\`;`)
  }
  // 刻意不 DROP orders 新欄位 / locked_documents_rels 新欄位（SQLite 成本太高）
}
