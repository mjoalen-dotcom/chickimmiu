import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Campaign Engine V1（CHIC Commerce OS P0-B）
 * ──────────────────────────────────────────
 * 新表：promotion_rules（+ rels / select / array 子表）、promotion_applications、
 *       promotion_settings（global）、marketing_campaigns_commerce_surfaces
 * 加欄：marketing_campaigns.commerce_*、orders.promotion_*、behavior_events campaign 歸因
 * 特別約束：
 * - promotion_applications.idempotency_key UNIQUE（同單同規則重放不重複）
 * - promotion_rules (campaign_id, slug, version) UNIQUE（ruleKey 唯一性的 DB 護欄）
 * down：DROP 新表；新增欄位刻意不 DROP（SQLite 成本高，dangling column 無害，repo 慣例）
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1. promotion_rules 主表 ────────────────────────────────────────────────
  if (!(await tableExists(db, 'promotion_rules'))) {
    await db.run(sql`CREATE TABLE \`promotion_rules\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`campaign_id\` integer,
      \`status\` text DEFAULT 'draft' NOT NULL,
      \`version\` numeric DEFAULT 1 NOT NULL,
      \`benefit_class\` text DEFAULT 'item_promo' NOT NULL,
      \`priority\` numeric DEFAULT 100 NOT NULL,
      \`conditions_min_quantity\` numeric,
      \`conditions_min_eligible_subtotal\` numeric,
      \`conditions_min_order_subtotal\` numeric,
      \`conditions_members_only\` integer DEFAULT false,
      \`conditions_first_purchase_only\` integer DEFAULT false,
      \`effect_effect_type\` text DEFAULT 'fixed_discount_per_group' NOT NULL,
      \`effect_group_size\` numeric DEFAULT 2,
      \`effect_amount\` numeric,
      \`effect_percent_off\` numeric,
      \`effect_max_amount\` numeric,
      \`effect_repeat_mode\` text DEFAULT 'once_per_order',
      \`effect_unit_selection\` text DEFAULT 'cheapest_first',
      \`effect_gift_product_id\` integer,
      \`effect_gift_quantity\` numeric DEFAULT 1,
      \`effect_multiplier\` numeric,
      \`effect_reward_key\` text,
      \`stacking_exclusive_group\` text,
      \`stacking_max_benefit_per_order\` numeric,
      \`stacking_stackable_with_all\` integer DEFAULT true,
      \`guardrails_minimum_gross_margin_pct\` numeric,
      \`guardrails_per_user_limit\` numeric,
      \`guardrails_total_usage_limit\` numeric,
      \`admin_note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`campaign_id\`) REFERENCES \`marketing_campaigns\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`effect_gift_product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`promotion_rules_campaign_idx\` ON \`promotion_rules\` (\`campaign_id\`);`)
    await db.run(sql`CREATE INDEX \`promotion_rules_status_idx\` ON \`promotion_rules\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`promotion_rules_updated_at_idx\` ON \`promotion_rules\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`promotion_rules_created_at_idx\` ON \`promotion_rules\` (\`created_at\`);`)
    await db.run(
      sql`CREATE UNIQUE INDEX \`promotion_rules_campaign_slug_version_uidx\` ON \`promotion_rules\` (\`campaign_id\`, \`slug\`, \`version\`);`,
    )
  }

  // ── 2. promotion_rules 關聯子表（hasMany relationship → _rels）────────────
  if (!(await tableExists(db, 'promotion_rules_rels'))) {
    await db.run(sql`CREATE TABLE \`promotion_rules_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`categories_id\` integer,
      \`products_id\` integer,
      \`membership_tiers_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`promotion_rules\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`membership_tiers_id\`) REFERENCES \`membership_tiers\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`promotion_rules_rels_order_idx\` ON \`promotion_rules_rels\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`promotion_rules_rels_parent_idx\` ON \`promotion_rules_rels\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`promotion_rules_rels_path_idx\` ON \`promotion_rules_rels\` (\`path\`);`)
    await db.run(sql`CREATE INDEX \`promotion_rules_rels_categories_id_idx\` ON \`promotion_rules_rels\` (\`categories_id\`);`)
    await db.run(sql`CREATE INDEX \`promotion_rules_rels_products_id_idx\` ON \`promotion_rules_rels\` (\`products_id\`);`)
    await db.run(
      sql`CREATE INDEX \`promotion_rules_rels_membership_tiers_id_idx\` ON \`promotion_rules_rels\` (\`membership_tiers_id\`);`,
    )
  }

  // ── 3. promotion_rules select-hasMany / array 子表 ─────────────────────────
  const selectChild = async (table: string) => {
    if (await tableExists(db, table)) return false
    await db.run(
      sql.raw(`CREATE TABLE \`${table}\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`promotion_rules\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`),
    )
    await db.run(sql.raw(`CREATE INDEX \`${table}_order_idx\` ON \`${table}\` (\`order\`);`))
    await db.run(sql.raw(`CREATE INDEX \`${table}_parent_idx\` ON \`${table}\` (\`parent_id\`);`))
    return true
  }
  await selectChild('promotion_rules_conditions_segments_not_in')
  await selectChild('promotion_rules_conditions_channels')
  await selectChild('promotion_rules_stacking_stackable_with')

  const tagChild = async (table: string) => {
    if (await tableExists(db, table)) return false
    await db.run(
      sql.raw(`CREATE TABLE \`${table}\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`tag\` text NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`promotion_rules\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`),
    )
    await db.run(sql.raw(`CREATE INDEX \`${table}_order_idx\` ON \`${table}\` (\`_order\`);`))
    await db.run(sql.raw(`CREATE INDEX \`${table}_parent_id_idx\` ON \`${table}\` (\`_parent_id\`);`))
    return true
  }
  await tagChild('promotion_rules_scope_include_tags')
  await tagChild('promotion_rules_scope_exclude_tags')

  // ── 4. promotion_applications（不可變交易表）──────────────────────────────
  if (!(await tableExists(db, 'promotion_applications'))) {
    await db.run(sql`CREATE TABLE \`promotion_applications\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order_id\` integer,
      \`user_id\` integer,
      \`campaign_id\` integer,
      \`rule_id\` integer,
      \`rule_key\` text NOT NULL,
      \`version\` numeric NOT NULL,
      \`source\` text NOT NULL,
      \`coupon_code\` text,
      \`effect_type\` text NOT NULL,
      \`status\` text DEFAULT 'applied' NOT NULL,
      \`discount_amount\` numeric NOT NULL,
      \`shipping_discount_amount\` numeric DEFAULT 0,
      \`allocations\` text,
      \`idempotency_key\` text NOT NULL,
      \`reversed_at\` text,
      \`reversal_reason\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`campaign_id\`) REFERENCES \`marketing_campaigns\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`rule_id\`) REFERENCES \`promotion_rules\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`promotion_applications_idempotency_key_idx\` ON \`promotion_applications\` (\`idempotency_key\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_order_idx\` ON \`promotion_applications\` (\`order_id\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_user_idx\` ON \`promotion_applications\` (\`user_id\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_campaign_idx\` ON \`promotion_applications\` (\`campaign_id\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_rule_idx\` ON \`promotion_applications\` (\`rule_id\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_rule_key_idx\` ON \`promotion_applications\` (\`rule_key\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_status_idx\` ON \`promotion_applications\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_updated_at_idx\` ON \`promotion_applications\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`promotion_applications_created_at_idx\` ON \`promotion_applications\` (\`created_at\`);`)
  }

  // ── 5. promotion_settings（global）─────────────────────────────────────────
  if (!(await tableExists(db, 'promotion_settings'))) {
    await db.run(sql`CREATE TABLE \`promotion_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`kill_switch\` integer DEFAULT false,
      \`storefront_enabled\` integer DEFAULT false,
      \`server_pricing_enforcement\` integer DEFAULT true,
      \`quote_ttl_seconds\` numeric DEFAULT 300,
      \`default_margin_floor_pct\` numeric,
      \`updated_at\` text,
      \`created_at\` text
    );`)
  }

  // ── 6. marketing_campaigns 加 commerce 欄位 ───────────────────────────────
  const mcCols: Array<{ name: string; ddl: string }> = [
    { name: 'commerce_enabled', ddl: '`commerce_enabled` integer DEFAULT false' },
    { name: 'commerce_kill_switch', ddl: '`commerce_kill_switch` integer DEFAULT false' },
    { name: 'commerce_objective', ddl: '`commerce_objective` text' },
    { name: 'commerce_headline', ddl: '`commerce_headline` text' },
    { name: 'commerce_badge_text', ddl: '`commerce_badge_text` text' },
    { name: 'commerce_cta_text', ddl: '`commerce_cta_text` text' },
    { name: 'commerce_cta_href', ddl: '`commerce_cta_href` text' },
    { name: 'commerce_budget_cap', ddl: '`commerce_budget_cap` numeric' },
    { name: 'commerce_budget_spent', ddl: '`commerce_budget_spent` numeric DEFAULT 0' },
    {
      name: 'commerce_approval_approved_by_id',
      ddl: '`commerce_approval_approved_by_id` integer REFERENCES users(id)',
    },
    { name: 'commerce_approval_approved_at', ddl: '`commerce_approval_approved_at` text' },
    { name: 'commerce_approval_approval_note', ddl: '`commerce_approval_approval_note` text' },
  ]
  for (const col of mcCols) {
    if (!(await columnExists(db, 'marketing_campaigns', col.name))) {
      await db.run(sql.raw(`ALTER TABLE \`marketing_campaigns\` ADD COLUMN ${col.ddl};`))
    }
  }
  if (!(await tableExists(db, 'marketing_campaigns_commerce_surfaces'))) {
    await db.run(sql`CREATE TABLE \`marketing_campaigns_commerce_surfaces\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`marketing_campaigns\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`marketing_campaigns_commerce_surfaces_order_idx\` ON \`marketing_campaigns_commerce_surfaces\` (\`order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`marketing_campaigns_commerce_surfaces_parent_idx\` ON \`marketing_campaigns_commerce_surfaces\` (\`parent_id\`);`,
    )
  }

  // ── 7. orders 加 promotion 快照欄位 ───────────────────────────────────────
  const orderCols: Array<{ name: string; ddl: string }> = [
    { name: 'promotion_quote_id', ddl: '`promotion_quote_id` text' },
    { name: 'promotion_pricing_version', ddl: '`promotion_pricing_version` text' },
    { name: 'promotion_server_enforced', ddl: '`promotion_server_enforced` integer DEFAULT false' },
    { name: 'promotion_quote_hash', ddl: '`promotion_quote_hash` text' },
    { name: 'promotion_discount_total', ddl: '`promotion_discount_total` numeric DEFAULT 0' },
    { name: 'promotion_shipping_discount_total', ddl: '`promotion_shipping_discount_total` numeric DEFAULT 0' },
    { name: 'promotion_applied_promotion_snapshots', ddl: '`promotion_applied_promotion_snapshots` text' },
    { name: 'promotion_reward_intents', ddl: '`promotion_reward_intents` text' },
  ]
  for (const col of orderCols) {
    if (!(await columnExists(db, 'orders', col.name))) {
      await db.run(sql.raw(`ALTER TABLE \`orders\` ADD COLUMN ${col.ddl};`))
    }
  }

  // ── 8. behavior_events 加活動歸因欄位 ─────────────────────────────────────
  // 守衛：某些本機 dev DB（push 建置、較舊）沒有 behavior_events 表；prod 有。
  if (await tableExists(db, 'behavior_events')) {
    const beCols: Array<{ name: string; ddl: string }> = [
      { name: 'campaign_id', ddl: '`campaign_id` integer REFERENCES marketing_campaigns(id)' },
      { name: 'rule_key', ddl: '`rule_key` text' },
      { name: 'variant_id', ddl: '`variant_id` text' },
      { name: 'surface', ddl: '`surface` text' },
    ]
    for (const col of beCols) {
      if (!(await columnExists(db, 'behavior_events', col.name))) {
        await db.run(sql.raw(`ALTER TABLE \`behavior_events\` ADD COLUMN ${col.ddl};`))
      }
    }
    await db.run(sql`CREATE INDEX IF NOT EXISTS \`behavior_events_campaign_idx\` ON \`behavior_events\` (\`campaign_id\`);`)
    await db.run(sql`CREATE INDEX IF NOT EXISTS \`behavior_events_rule_key_idx\` ON \`behavior_events\` (\`rule_key\`);`)
  }

  // ── 9. payload_locked_documents_rels：新 collection FK 欄（repo 硬規則）────
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'promotion_rules_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`promotion_rules_id\` integer REFERENCES promotion_rules(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_promotion_rules_id_idx\` ON \`payload_locked_documents_rels\` (\`promotion_rules_id\`);`,
    )
  }
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'promotion_applications_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`promotion_applications_id\` integer REFERENCES promotion_applications(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_promotion_applications_id_idx\` ON \`payload_locked_documents_rels\` (\`promotion_applications_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of [
    'promotion_rules_scope_include_tags',
    'promotion_rules_scope_exclude_tags',
    'promotion_rules_conditions_segments_not_in',
    'promotion_rules_conditions_channels',
    'promotion_rules_stacking_stackable_with',
    'promotion_rules_rels',
    'promotion_applications',
    'promotion_rules',
    'promotion_settings',
    'marketing_campaigns_commerce_surfaces',
  ]) {
    await db.run(sql.raw(`DROP TABLE IF EXISTS \`${table}\`;`))
  }
  // 刻意不 DROP marketing_campaigns / orders / behavior_events /
  // payload_locked_documents_rels 的新增欄位（SQLite 成本高；dangling column 無害）
}
