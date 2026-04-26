import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 點數商城實體出貨支援
 * ────────────────────
 * 1. points_redemptions 加 physicalConfig 群組欄位
 *    - physical_config_linked_product_id (FK products)
 *    - physical_config_physical_sku
 *    - physical_config_validity_days
 *    - physical_config_shipping_note
 *    - physical_config_reward_type_override
 * 2. user_rewards 加：
 *    - redemption_ref_id (FK points_redemptions) — 用於 maxPerUser / maxPerDay 檢查
 *    - points_cost_snapshot — 兌換時花費點數（快照）
 *
 * 冪等：PRAGMA / sqlite_master 判斷；pattern 承襲既有 migration。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
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
  // ── points_redemptions: physicalConfig ──
  if (!(await columnExists(db, 'points_redemptions', 'physical_config_linked_product_id'))) {
    await db.run(
      sql`ALTER TABLE \`points_redemptions\` ADD COLUMN \`physical_config_linked_product_id\` integer REFERENCES products(id);`,
    )
  }
  if (!(await indexExists(db, 'points_redemptions_physical_config_linked_product_idx'))) {
    await db.run(
      sql`CREATE INDEX \`points_redemptions_physical_config_linked_product_idx\` ON \`points_redemptions\` (\`physical_config_linked_product_id\`);`,
    )
  }
  if (!(await columnExists(db, 'points_redemptions', 'physical_config_physical_sku'))) {
    await db.run(
      sql`ALTER TABLE \`points_redemptions\` ADD COLUMN \`physical_config_physical_sku\` text;`,
    )
  }
  if (!(await columnExists(db, 'points_redemptions', 'physical_config_validity_days'))) {
    await db.run(
      sql`ALTER TABLE \`points_redemptions\` ADD COLUMN \`physical_config_validity_days\` numeric DEFAULT 365;`,
    )
  }
  if (!(await columnExists(db, 'points_redemptions', 'physical_config_shipping_note'))) {
    await db.run(
      sql`ALTER TABLE \`points_redemptions\` ADD COLUMN \`physical_config_shipping_note\` text;`,
    )
  }
  if (!(await columnExists(db, 'points_redemptions', 'physical_config_reward_type_override'))) {
    await db.run(
      sql`ALTER TABLE \`points_redemptions\` ADD COLUMN \`physical_config_reward_type_override\` text DEFAULT 'gift_physical';`,
    )
  }

  // ── user_rewards: redemptionRef + pointsCostSnapshot ──
  if (!(await columnExists(db, 'user_rewards', 'redemption_ref_id'))) {
    await db.run(
      sql`ALTER TABLE \`user_rewards\` ADD COLUMN \`redemption_ref_id\` integer REFERENCES points_redemptions(id);`,
    )
  }
  if (!(await indexExists(db, 'user_rewards_redemption_ref_idx'))) {
    await db.run(
      sql`CREATE INDEX \`user_rewards_redemption_ref_idx\` ON \`user_rewards\` (\`redemption_ref_id\`);`,
    )
  }
  if (!(await columnExists(db, 'user_rewards', 'points_cost_snapshot'))) {
    await db.run(
      sql`ALTER TABLE \`user_rewards\` ADD COLUMN \`points_cost_snapshot\` numeric;`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // SQLite DROP COLUMN 在較新版本支援；同樣冪等檢查
  if (await indexExists(db, 'user_rewards_redemption_ref_idx')) {
    await db.run(sql`DROP INDEX \`user_rewards_redemption_ref_idx\`;`)
  }
  if (await columnExists(db, 'user_rewards', 'redemption_ref_id')) {
    await db.run(sql`ALTER TABLE \`user_rewards\` DROP COLUMN \`redemption_ref_id\`;`)
  }
  if (await columnExists(db, 'user_rewards', 'points_cost_snapshot')) {
    await db.run(sql`ALTER TABLE \`user_rewards\` DROP COLUMN \`points_cost_snapshot\`;`)
  }
  if (await indexExists(db, 'points_redemptions_physical_config_linked_product_idx')) {
    await db.run(sql`DROP INDEX \`points_redemptions_physical_config_linked_product_idx\`;`)
  }
  for (const col of [
    'physical_config_linked_product_id',
    'physical_config_physical_sku',
    'physical_config_validity_days',
    'physical_config_shipping_note',
    'physical_config_reward_type_override',
  ]) {
    if (await columnExists(db, 'points_redemptions', col)) {
      await db.run(sql.raw(`ALTER TABLE \`points_redemptions\` DROP COLUMN \`${col}\`;`))
    }
  }
}
