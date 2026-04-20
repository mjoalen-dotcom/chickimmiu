import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Session 19C — Shopline 結帳設定 + 訂單設定
 *   新增 `checkout_settings` / `order_settings` 兩張 global 表，
 *   以及 `order_settings` 的兩個 array sub-table（admin email / custom statuses）。
 *
 * 不動 `orders.order_number`（既有 NOT NULL + unique 保留；Orders.ts beforeChange
 *   新 hook 會在 create 時自動產生，舊單已各自有值）。
 *
 * 冪等：用 sqlite_master 判斷表是否已存在，已存在就 skip。對應 pattern：
 *   20260418_220000_add_login_attempts.ts。
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
  // ─────────────── checkout_settings ───────────────
  if (!(await tableExists(db, 'checkout_settings'))) {
    await db.run(sql`CREATE TABLE \`checkout_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`require_tos\` integer DEFAULT true,
      \`tos_link_text\` text DEFAULT '同意服務條款與隱私權政策',
      \`require_marketing_consent\` integer DEFAULT false,
      \`marketing_consent_text\` text DEFAULT '我願意收到 CHIC KIM & MIU 最新活動與優惠資訊',
      \`field_requirements_phone_required\` integer DEFAULT true,
      \`field_requirements_birthday_required\` integer DEFAULT false,
      \`field_requirements_national_id_required\` integer DEFAULT false,
      \`field_requirements_gender_required\` integer DEFAULT false,
      \`checkout_as_guest\` integer DEFAULT true,
      \`min_order_amount\` numeric DEFAULT 0,
      \`max_items_per_order\` numeric DEFAULT 99,
      \`notes_allow_order_note\` integer DEFAULT true,
      \`notes_order_note_label\` text DEFAULT '給賣家的備註',
      \`notes_order_note_max_length\` numeric DEFAULT 200,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );`)
  }

  // ─────────────── order_settings ───────────────
  if (!(await tableExists(db, 'order_settings'))) {
    await db.run(sql`CREATE TABLE \`order_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`numbering_prefix\` text DEFAULT 'CKMU',
      \`numbering_include_date\` integer DEFAULT true,
      \`numbering_sequence_digits\` numeric DEFAULT 3,
      \`numbering_sequence_reset_daily\` integer DEFAULT true,
      \`auto_actions_auto_cancel_unpaid_minutes\` numeric DEFAULT 60,
      \`auto_actions_auto_complete_after_delivery\` integer DEFAULT false,
      \`auto_actions_auto_complete_after_days\` numeric DEFAULT 7,
      \`notifications_send_confirmation_email\` integer DEFAULT true,
      \`notifications_send_shipped_email\` integer DEFAULT true,
      \`notifications_send_admin_new_order_alert\` integer DEFAULT true,
      \`status_flow_enable_processing\` integer DEFAULT true,
      \`status_flow_enable_ready_for_pickup\` integer DEFAULT false,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );`)
  }

  // ─────────────── order_settings_notifications_admin_alert_emails ───────────────
  if (
    !(await tableExists(
      db,
      'order_settings_notifications_admin_alert_emails',
    ))
  ) {
    await db.run(sql`CREATE TABLE \`order_settings_notifications_admin_alert_emails\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`email\` text NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`order_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`order_settings_notifications_admin_alert_emails_order_idx\` ON \`order_settings_notifications_admin_alert_emails\` (\`_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`order_settings_notifications_admin_alert_emails_parent_id_idx\` ON \`order_settings_notifications_admin_alert_emails\` (\`_parent_id\`);`,
    )
  }

  // ─────────────── order_settings_status_flow_custom_statuses ───────────────
  if (!(await tableExists(db, 'order_settings_status_flow_custom_statuses'))) {
    await db.run(sql`CREATE TABLE \`order_settings_status_flow_custom_statuses\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`value\` text NOT NULL,
      \`label\` text NOT NULL,
      \`sort_order\` numeric DEFAULT 100,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`order_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`order_settings_status_flow_custom_statuses_order_idx\` ON \`order_settings_status_flow_custom_statuses\` (\`_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`order_settings_status_flow_custom_statuses_parent_id_idx\` ON \`order_settings_status_flow_custom_statuses\` (\`_parent_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 刪除順序：先刪 child，再刪 parent，避免 FK 擋住
  if (await tableExists(db, 'order_settings_status_flow_custom_statuses')) {
    await db.run(sql`DROP TABLE \`order_settings_status_flow_custom_statuses\`;`)
  }
  if (await tableExists(db, 'order_settings_notifications_admin_alert_emails')) {
    await db.run(sql`DROP TABLE \`order_settings_notifications_admin_alert_emails\`;`)
  }
  if (await tableExists(db, 'order_settings')) {
    await db.run(sql`DROP TABLE \`order_settings\`;`)
  }
  if (await tableExists(db, 'checkout_settings')) {
    await db.run(sql`DROP TABLE \`checkout_settings\`;`)
  }
}
