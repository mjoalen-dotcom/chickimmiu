import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase B — PrizePools collection
 *
 * 新表：
 *   - prize_pools                       主表
 *   - prize_pools_eligible_games        hasMany select 子表（遊戲識別碼）
 *
 * 冪等：sqlite_master + PRAGMA pattern；同 20260504_120000_add_mbti_quiz.ts
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── prize_pools 主表 ──
  if (!(await tableExists(db, 'prize_pools'))) {
    await db.run(sql`CREATE TABLE \`prize_pools\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`prize_type\` text NOT NULL,
      \`amount\` numeric DEFAULT 0,
      \`coupon_code\` text,
      \`description\` text,
      \`image_id\` integer,
      \`weight\` numeric DEFAULT 10 NOT NULL,
      \`tier_boost_ordinary\` numeric DEFAULT 1.0,
      \`tier_boost_bronze\` numeric DEFAULT 1.0,
      \`tier_boost_silver\` numeric DEFAULT 1.0,
      \`tier_boost_gold\` numeric DEFAULT 1.0,
      \`tier_boost_platinum\` numeric DEFAULT 1.0,
      \`tier_boost_diamond\` numeric DEFAULT 1.0,
      \`active\` integer DEFAULT true,
      \`inventory_unlimited\` integer DEFAULT true,
      \`inventory_total\` numeric,
      \`inventory_remaining\` numeric,
      \`starts_at\` text,
      \`ends_at\` text,
      \`delivery_method\` text DEFAULT 'instant_credit' NOT NULL,
      \`redemption_instructions\` text,
      \`expiry_days\` numeric DEFAULT 365,
      \`max_per_user_monthly\` numeric,
      \`max_per_user_lifetime\` numeric,
      \`estimated_value\` numeric,
      \`admin_notes\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`prize_pools_slug_idx\` ON \`prize_pools\` (\`slug\`);`)
    await db.run(sql`CREATE INDEX \`prize_pools_image_idx\` ON \`prize_pools\` (\`image_id\`);`)
    await db.run(sql`CREATE INDEX \`prize_pools_active_idx\` ON \`prize_pools\` (\`active\`);`)
    await db.run(sql`CREATE INDEX \`prize_pools_prize_type_idx\` ON \`prize_pools\` (\`prize_type\`);`)
  }

  // ── prize_pools_eligible_games 子表（hasMany select）──
  if (!(await tableExists(db, 'prize_pools_eligible_games'))) {
    await db.run(sql`CREATE TABLE \`prize_pools_eligible_games\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`prize_pools\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`prize_pools_eligible_games_order_idx\` ON \`prize_pools_eligible_games\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`prize_pools_eligible_games_parent_idx\` ON \`prize_pools_eligible_games\` (\`parent_id\`);`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'prize_pools_eligible_games')) {
    await db.run(sql`DROP TABLE \`prize_pools_eligible_games\`;`)
  }
  if (await tableExists(db, 'prize_pools')) {
    await db.run(sql`DROP TABLE \`prize_pools\`;`)
  }
}
