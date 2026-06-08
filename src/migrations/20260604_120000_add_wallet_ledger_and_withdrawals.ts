import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 2 C 組 — 錢包帳本 + 儲值金退現
 *   新增 `wallet_withdrawals` 表（儲值金退現申請）
 *   新增 `wallet_transactions` 表（購物金 + 儲值金 流水帳；FK 參照 wallet_withdrawals）
 *   並在 `payload_locked_documents_rels` 補兩個 FK 欄位。
 *
 * 建表順序：先 wallet_withdrawals，後 wallet_transactions（後者 related_withdrawal_id
 *   參照前者）。
 *
 * 冪等：sqlite_master / PRAGMA 判斷是否已存在。Pattern 承襲
 *   20260603_120000_add_newsletter_and_wishlist.ts。
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
  // ── 儲值金退現申請（先建，供 wallet_transactions FK 參照） ──
  if (!(await tableExists(db, 'wallet_withdrawals'))) {
    await db.run(sql`CREATE TABLE \`wallet_withdrawals\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`user_id\` integer REFERENCES users(id) ON DELETE SET NULL,
      \`status\` text DEFAULT 'pending' NOT NULL,
      \`amount\` numeric NOT NULL,
      \`bank_info_bank_name\` text,
      \`bank_info_bank_code\` text,
      \`bank_info_account_name\` text,
      \`bank_info_account_number\` text,
      \`user_note\` text,
      \`admin_note\` text,
      \`held\` integer DEFAULT false,
      \`refunded_to_wallet\` integer DEFAULT false,
      \`processed_at\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE INDEX \`wallet_withdrawals_user_id_idx\` ON \`wallet_withdrawals\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wallet_withdrawals_status_idx\` ON \`wallet_withdrawals\` (\`status\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wallet_withdrawals_created_at_idx\` ON \`wallet_withdrawals\` (\`created_at\`);`,
    )
  }

  // ── 錢包帳本 ──
  if (!(await tableExists(db, 'wallet_transactions'))) {
    await db.run(sql`CREATE TABLE \`wallet_transactions\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`user_id\` integer REFERENCES users(id) ON DELETE SET NULL,
      \`wallet\` text NOT NULL,
      \`type\` text,
      \`amount\` numeric NOT NULL,
      \`balance\` numeric,
      \`source\` text,
      \`description\` text,
      \`related_order_id\` integer REFERENCES orders(id) ON DELETE SET NULL,
      \`related_withdrawal_id\` integer REFERENCES wallet_withdrawals(id) ON DELETE SET NULL,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE INDEX \`wallet_transactions_user_id_idx\` ON \`wallet_transactions\` (\`user_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wallet_transactions_wallet_idx\` ON \`wallet_transactions\` (\`wallet\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wallet_transactions_related_order_id_idx\` ON \`wallet_transactions\` (\`related_order_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wallet_transactions_related_withdrawal_id_idx\` ON \`wallet_transactions\` (\`related_withdrawal_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`wallet_transactions_created_at_idx\` ON \`wallet_transactions\` (\`created_at\`);`,
    )
  }

  // ── payload_locked_documents_rels FK 欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'wallet_transactions_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`wallet_transactions_id\` integer REFERENCES wallet_transactions(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_wallet_transactions_id_idx\` ON \`payload_locked_documents_rels\` (\`wallet_transactions_id\`);`,
    )
  }
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'wallet_withdrawals_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`wallet_withdrawals_id\` integer REFERENCES wallet_withdrawals(id);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_wallet_withdrawals_id_idx\` ON \`payload_locked_documents_rels\` (\`wallet_withdrawals_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'wallet_transactions')) {
    await db.run(sql`DROP TABLE \`wallet_transactions\`;`)
  }
  if (await tableExists(db, 'wallet_withdrawals')) {
    await db.run(sql`DROP TABLE \`wallet_withdrawals\`;`)
  }
  // 刻意不 DROP COLUMN（SQLite 成本太高），留 dangling FK column；無害。
}
