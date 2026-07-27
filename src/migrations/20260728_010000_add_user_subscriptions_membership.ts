import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 訂閱系統（綠界定期定額）schema：
 *   1. user_subscriptions — 訂閱紀錄主表（母交易/狀態/權益期限/streak）
 *   2. user_subscriptions_auth_log — 每期授權紀錄 array 子表
 *   3. users.membership_* — 生效訂閱 denormalized 快照 4 欄
 *   4. payload_locked_documents_rels.user_subscriptions_id — 後台編輯鎖定
 *
 * 對應檔案：src/collections/UserSubscriptions.ts、Users.ts membership group、
 *           src/lib/subscription/activate.ts
 * 冪等：sqlite_master / PRAGMA pattern（承襲 20260609_140000_add_email_templates.ts）。
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
  // ── 1. 主表 ──
  if (!(await tableExists(db, 'user_subscriptions'))) {
    await db.run(sql`CREATE TABLE \`user_subscriptions\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`user_id\` integer NOT NULL,
      \`plan_id\` integer NOT NULL,
      \`status\` text NOT NULL DEFAULT 'pending',
      \`billing_cycle\` text NOT NULL DEFAULT 'monthly',
      \`amount\` numeric NOT NULL,
      \`started_at\` text,
      \`current_period_end\` text,
      \`streak_months\` numeric DEFAULT 0,
      \`ecpay_merchant_trade_no\` text,
      \`ecpay_gwsr\` text,
      \`ecpay_period_type\` text,
      \`ecpay_exec_times\` numeric,
      \`ecpay_total_success_times\` numeric DEFAULT 0,
      \`ecpay_last_auth_at\` text,
      \`cancelled_at\` text,
      \`cancel_reason\` text,
      \`updated_at\` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      \`created_at\` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`plan_id\`) REFERENCES \`subscription_plans\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(
      sql`CREATE INDEX \`user_subscriptions_user_idx\` ON \`user_subscriptions\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_subscriptions_status_idx\` ON \`user_subscriptions\` (\`status\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_subscriptions_ecpay_mtn_idx\` ON \`user_subscriptions\` (\`ecpay_merchant_trade_no\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_subscriptions_updated_at_idx\` ON \`user_subscriptions\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_subscriptions_created_at_idx\` ON \`user_subscriptions\` (\`created_at\`);`,
    )
  }

  // ── 2. authLog array 子表 ──
  if (!(await tableExists(db, 'user_subscriptions_auth_log'))) {
    await db.run(sql`CREATE TABLE \`user_subscriptions_auth_log\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`at\` text,
      \`amount\` numeric,
      \`gwsr\` text,
      \`rtn_code\` text,
      \`success\` integer,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`user_subscriptions\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`user_subscriptions_auth_log_order_idx\` ON \`user_subscriptions_auth_log\` (\`_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`user_subscriptions_auth_log_parent_id_idx\` ON \`user_subscriptions_auth_log\` (\`_parent_id\`);`,
    )
  }

  // ── 3. users.membership_* denormalized 快照 ──
  const userCols: Array<{ name: string; ddl: string }> = [
    {
      name: 'membership_active_plan_id',
      ddl: 'integer REFERENCES subscription_plans(id)',
    },
    {
      name: 'membership_active_subscription_id',
      ddl: 'integer REFERENCES user_subscriptions(id)',
    },
    { name: 'membership_valid_until', ddl: 'text' },
    { name: 'membership_streak_months', ddl: 'numeric DEFAULT 0' },
  ]
  for (const col of userCols) {
    if (!(await columnExists(db, 'users', col.name))) {
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${col.name}\` ${col.ddl};`))
    }
  }

  // ── 4. 後台編輯鎖定 rels ──
  if (await tableExists(db, 'payload_locked_documents_rels')) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', 'user_subscriptions_id'))) {
      await db.run(
        sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`user_subscriptions_id\` integer REFERENCES user_subscriptions(id);`,
      )
      await db.run(
        sql`CREATE INDEX \`payload_locked_documents_rels_user_subscriptions_id_idx\` ON \`payload_locked_documents_rels\` (\`user_subscriptions_id\`);`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`user_subscriptions_auth_log\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`user_subscriptions\`;`)
  // SQLite DROP COLUMN 成本高：users.membership_* 與
  // payload_locked_documents_rels.user_subscriptions_id 保留不刪
}
