import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 客服中心 v1 Phase 1A — Foundation Schema
 *
 * 新增 4 collection + 1 global + Users.notificationPreferences group
 * 對應檔案：
 *   - src/collections/Conversations.ts
 *   - src/collections/Messages.ts
 *   - src/collections/MessageTags.ts
 *   - src/collections/ConversationActivities.ts
 *   - src/globals/CustomerServiceSettings.ts (slug: cs-settings, 縮短避免 enum 名稱超 63 字)
 *   - src/collections/Users.ts (notificationPreferences group)
 *
 * 新增 tables：
 *   - message_tags（多階層 self-ref）
 *   - conversations（thread 主檔，含 SLA / AI / CSAT / UTM 欄位 schema-first）
 *   - messages（獨立訊息表，FK to conversations）
 *   - messages_attachments（messages.attachments inline array）
 *   - conversation_activities（audit log）
 *   - conversations_rels（hasMany: tags / orders / products / returns）
 *   - cs_settings（global 主表，FK to users(default_assignee_id)）
 *   - cs_settings_business_hours_schedule / _holidays（array 子表）
 *   - cs_settings_sla_first_response_minutes / _resolution_hours（array 子表）
 *   - cs_settings_anti_spam_blocked_keywords / _blocked_anon_ids / _blocked_i_ps（array 子表）
 *   - users_notification_preferences_channels（select hasMany 子表）
 *
 * 新增 columns：
 *   - users.notification_preferences_bell_in_admin / _email_digest / _email_digest_time /
 *     _quiet_hours_start / _quiet_hours_end / _mobile_push_token
 *   - payload_locked_documents_rels.conversations_id / messages_id / message_tags_id /
 *     conversation_activities_id
 *
 * 冪等：sqlite_master / PRAGMA pattern，承襲 20260418_220000_add_login_attempts.ts
 *   - tableExists / columnExists guard
 *   - 重複跑跳過已建表 / 已加欄位
 *   - 安全於：fresh DB / dev push'd DB / prod 第一次 migrate / 重跑
 *
 * down：DROP 新表，不 ALTER 移除 users 欄位（SQLite DROP COLUMN 成本高）
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
  // ─── message_tags（先建：自我參照 + conversations_rels 依賴此）──────
  if (!(await tableExists(db, 'message_tags'))) {
    await db.run(sql`CREATE TABLE \`message_tags\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`parent_id\` integer,
      \`color\` text,
      \`description\` text,
      \`usage_count\` numeric DEFAULT 0,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`message_tags\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`message_tags_name_idx\` ON \`message_tags\` (\`name\`);`)
    await db.run(sql`CREATE UNIQUE INDEX \`message_tags_slug_idx\` ON \`message_tags\` (\`slug\`);`)
    await db.run(sql`CREATE INDEX \`message_tags_parent_idx\` ON \`message_tags\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`message_tags_updated_at_idx\` ON \`message_tags\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`message_tags_created_at_idx\` ON \`message_tags\` (\`created_at\`);`)
  }

  // ─── conversations（thread 主檔）─────────────────────────────────────
  if (!(await tableExists(db, 'conversations'))) {
    await db.run(sql`CREATE TABLE \`conversations\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`ticket_number\` text NOT NULL,
      \`external_thread_id\` text,
      \`subject\` text,
      \`channel\` text NOT NULL,
      \`channel_metadata\` text,
      \`customer_id\` integer,
      \`anon_id\` text,
      \`guest_name\` text,
      \`guest_email\` text,
      \`guest_phone\` text,
      \`status\` text DEFAULT 'open' NOT NULL,
      \`priority\` text DEFAULT 'normal',
      \`unread\` integer DEFAULT true,
      \`assignee_id\` integer,
      \`category\` text,
      \`merged_into_id\` integer,
      \`first_response_at\` text,
      \`resolved_at\` text,
      \`last_message_at\` text,
      \`sla_due_at\` text,
      \`sla_breached\` integer DEFAULT false,
      \`internal_note\` text,
      \`source\` text,
      \`utm_source\` text,
      \`utm_medium\` text,
      \`utm_campaign\` text,
      \`ai_summary\` text,
      \`ai_summary_generated_at\` text,
      \`sentiment\` text,
      \`detected_language\` text,
      \`csat_score\` numeric,
      \`csat_at\` text,
      \`csat_comment\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`customer_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`assignee_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`merged_into_id\`) REFERENCES \`conversations\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`conversations_ticket_number_idx\` ON \`conversations\` (\`ticket_number\`);`)
    await db.run(sql`CREATE INDEX \`conversations_external_thread_id_idx\` ON \`conversations\` (\`external_thread_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_channel_idx\` ON \`conversations\` (\`channel\`);`)
    await db.run(sql`CREATE INDEX \`conversations_customer_idx\` ON \`conversations\` (\`customer_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_anon_id_idx\` ON \`conversations\` (\`anon_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_status_idx\` ON \`conversations\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`conversations_priority_idx\` ON \`conversations\` (\`priority\`);`)
    await db.run(sql`CREATE INDEX \`conversations_unread_idx\` ON \`conversations\` (\`unread\`);`)
    await db.run(sql`CREATE INDEX \`conversations_assignee_idx\` ON \`conversations\` (\`assignee_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_merged_into_idx\` ON \`conversations\` (\`merged_into_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_last_message_at_idx\` ON \`conversations\` (\`last_message_at\`);`)
    await db.run(sql`CREATE INDEX \`conversations_sla_breached_idx\` ON \`conversations\` (\`sla_breached\`);`)
    await db.run(sql`CREATE INDEX \`conversations_updated_at_idx\` ON \`conversations\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`conversations_created_at_idx\` ON \`conversations\` (\`created_at\`);`)
  }

  // ─── messages（FK 到 conversations）──────────────────────────────────
  if (!(await tableExists(db, 'messages'))) {
    await db.run(sql`CREATE TABLE \`messages\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`conversation_id\` integer NOT NULL,
      \`preview\` text,
      \`direction\` text NOT NULL,
      \`sender\` text NOT NULL,
      \`staff_user_id\` integer,
      \`body\` text,
      \`internal\` integer DEFAULT false,
      \`external_id\` text,
      \`reply_to_external_id\` text,
      \`quoted_message_id\` integer,
      \`read_by_customer_at\` text,
      \`read_by_staff_at\` text,
      \`edited_at\` text,
      \`deleted_at\` text,
      \`ai_suggestion\` text,
      \`ai_used\` integer DEFAULT false,
      \`raw_payload\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`staff_user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`quoted_message_id\`) REFERENCES \`messages\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`messages_conversation_idx\` ON \`messages\` (\`conversation_id\`);`)
    await db.run(sql`CREATE INDEX \`messages_direction_idx\` ON \`messages\` (\`direction\`);`)
    await db.run(sql`CREATE INDEX \`messages_staff_user_idx\` ON \`messages\` (\`staff_user_id\`);`)
    await db.run(sql`CREATE INDEX \`messages_internal_idx\` ON \`messages\` (\`internal\`);`)
    await db.run(sql`CREATE INDEX \`messages_external_id_idx\` ON \`messages\` (\`external_id\`);`)
    await db.run(sql`CREATE INDEX \`messages_quoted_message_idx\` ON \`messages\` (\`quoted_message_id\`);`)
    await db.run(sql`CREATE INDEX \`messages_updated_at_idx\` ON \`messages\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`messages_created_at_idx\` ON \`messages\` (\`created_at\`);`)
  }

  // ─── messages_attachments（messages.attachments inline array）─────────
  if (!(await tableExists(db, 'messages_attachments'))) {
    await db.run(sql`CREATE TABLE \`messages_attachments\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`media_id\` integer,
      \`caption\` text,
      \`kind\` text,
      \`external_url\` text,
      \`metadata\` text,
      FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`messages\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`messages_attachments_order_idx\` ON \`messages_attachments\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`messages_attachments_parent_id_idx\` ON \`messages_attachments\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`messages_attachments_media_idx\` ON \`messages_attachments\` (\`media_id\`);`)
  }

  // ─── conversation_activities（audit log）─────────────────────────────
  if (!(await tableExists(db, 'conversation_activities'))) {
    await db.run(sql`CREATE TABLE \`conversation_activities\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`conversation_id\` integer NOT NULL,
      \`actor_id\` integer,
      \`actor_type\` text DEFAULT 'staff' NOT NULL,
      \`type\` text NOT NULL,
      \`payload\` text,
      \`note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`actor_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`conversation_activities_conversation_idx\` ON \`conversation_activities\` (\`conversation_id\`);`)
    await db.run(sql`CREATE INDEX \`conversation_activities_actor_idx\` ON \`conversation_activities\` (\`actor_id\`);`)
    await db.run(sql`CREATE INDEX \`conversation_activities_type_idx\` ON \`conversation_activities\` (\`type\`);`)
    await db.run(sql`CREATE INDEX \`conversation_activities_updated_at_idx\` ON \`conversation_activities\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`conversation_activities_created_at_idx\` ON \`conversation_activities\` (\`created_at\`);`)
  }

  // ─── conversations_rels（hasMany: tags / orders / products / returns）
  if (!(await tableExists(db, 'conversations_rels'))) {
    await db.run(sql`CREATE TABLE \`conversations_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`message_tags_id\` integer,
      \`orders_id\` integer,
      \`products_id\` integer,
      \`returns_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`conversations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`message_tags_id\`) REFERENCES \`message_tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`returns_id\`) REFERENCES \`returns\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`conversations_rels_order_idx\` ON \`conversations_rels\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`conversations_rels_parent_idx\` ON \`conversations_rels\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_rels_path_idx\` ON \`conversations_rels\` (\`path\`);`)
    await db.run(sql`CREATE INDEX \`conversations_rels_message_tags_id_idx\` ON \`conversations_rels\` (\`message_tags_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_rels_orders_id_idx\` ON \`conversations_rels\` (\`orders_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_rels_products_id_idx\` ON \`conversations_rels\` (\`products_id\`);`)
    await db.run(sql`CREATE INDEX \`conversations_rels_returns_id_idx\` ON \`conversations_rels\` (\`returns_id\`);`)
  }

  // ─── cs_settings（global 主表）───────────────────────────────────────
  if (!(await tableExists(db, 'cs_settings'))) {
    await db.run(sql`CREATE TABLE \`cs_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`business_hours_timezone\` text DEFAULT 'Asia/Taipei',
      \`business_hours_off_hour_auto_reply\` text DEFAULT '感謝您的訊息！目前是非營業時段，我們會在下次營業時間（週一至週五 10:00–18:00）盡快回覆您。',
      \`sla_breach_action\` text DEFAULT 'notify_assignee',
      \`default_assignee_id\` integer,
      \`auto_assign_mode\` text DEFAULT 'round_robin',
      \`greeting_web\` text DEFAULT '哈囉！我是 CHIC KIM & MIU 的客服小幫手，請問需要什麼協助呢？',
      \`greeting_line\` text,
      \`greeting_fb\` text,
      \`greeting_ig\` text,
      \`anti_spam_max_messages_per_minute\` numeric DEFAULT 5,
      \`csat_enabled\` integer DEFAULT true,
      \`csat_send_delay_hours\` numeric DEFAULT 24,
      \`csat_question\` text DEFAULT '您對這次客服體驗滿意嗎？（1–5 星）',
      \`updated_at\` text,
      \`created_at\` text,
      FOREIGN KEY (\`default_assignee_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_default_assignee_idx\` ON \`cs_settings\` (\`default_assignee_id\`);`)
  }

  // ─── cs_settings 子 array tables ────────────────────────────────────
  if (!(await tableExists(db, 'cs_settings_business_hours_schedule'))) {
    await db.run(sql`CREATE TABLE \`cs_settings_business_hours_schedule\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`day_of_week\` text,
      \`open_time\` text,
      \`close_time\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`cs_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_business_hours_schedule_order_idx\` ON \`cs_settings_business_hours_schedule\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`cs_settings_business_hours_schedule_parent_id_idx\` ON \`cs_settings_business_hours_schedule\` (\`_parent_id\`);`)
  }

  if (!(await tableExists(db, 'cs_settings_business_hours_holidays'))) {
    await db.run(sql`CREATE TABLE \`cs_settings_business_hours_holidays\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`date\` text,
      \`reason\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`cs_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_business_hours_holidays_order_idx\` ON \`cs_settings_business_hours_holidays\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`cs_settings_business_hours_holidays_parent_id_idx\` ON \`cs_settings_business_hours_holidays\` (\`_parent_id\`);`)
  }

  if (!(await tableExists(db, 'cs_settings_sla_first_response_minutes'))) {
    await db.run(sql`CREATE TABLE \`cs_settings_sla_first_response_minutes\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`channel\` text,
      \`priority\` text,
      \`minutes\` numeric,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`cs_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_sla_first_response_minutes_order_idx\` ON \`cs_settings_sla_first_response_minutes\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`cs_settings_sla_first_response_minutes_parent_id_idx\` ON \`cs_settings_sla_first_response_minutes\` (\`_parent_id\`);`)
  }

  if (!(await tableExists(db, 'cs_settings_sla_resolution_hours'))) {
    await db.run(sql`CREATE TABLE \`cs_settings_sla_resolution_hours\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`priority\` text,
      \`hours\` numeric,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`cs_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_sla_resolution_hours_order_idx\` ON \`cs_settings_sla_resolution_hours\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`cs_settings_sla_resolution_hours_parent_id_idx\` ON \`cs_settings_sla_resolution_hours\` (\`_parent_id\`);`)
  }

  if (!(await tableExists(db, 'cs_settings_anti_spam_blocked_keywords'))) {
    await db.run(sql`CREATE TABLE \`cs_settings_anti_spam_blocked_keywords\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`keyword\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`cs_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_anti_spam_blocked_keywords_order_idx\` ON \`cs_settings_anti_spam_blocked_keywords\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`cs_settings_anti_spam_blocked_keywords_parent_id_idx\` ON \`cs_settings_anti_spam_blocked_keywords\` (\`_parent_id\`);`)
  }

  if (!(await tableExists(db, 'cs_settings_anti_spam_blocked_anon_ids'))) {
    await db.run(sql`CREATE TABLE \`cs_settings_anti_spam_blocked_anon_ids\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`anon_id\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`cs_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_anti_spam_blocked_anon_ids_order_idx\` ON \`cs_settings_anti_spam_blocked_anon_ids\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`cs_settings_anti_spam_blocked_anon_ids_parent_id_idx\` ON \`cs_settings_anti_spam_blocked_anon_ids\` (\`_parent_id\`);`)
  }

  if (!(await tableExists(db, 'cs_settings_anti_spam_blocked_i_ps'))) {
    await db.run(sql`CREATE TABLE \`cs_settings_anti_spam_blocked_i_ps\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`ip\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`cs_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`cs_settings_anti_spam_blocked_i_ps_order_idx\` ON \`cs_settings_anti_spam_blocked_i_ps\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`cs_settings_anti_spam_blocked_i_ps_parent_id_idx\` ON \`cs_settings_anti_spam_blocked_i_ps\` (\`_parent_id\`);`)
  }

  // ─── users_notification_preferences_channels（select hasMany 子表）────
  if (!(await tableExists(db, 'users_notification_preferences_channels'))) {
    await db.run(sql`CREATE TABLE \`users_notification_preferences_channels\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`users_notification_preferences_channels_order_idx\` ON \`users_notification_preferences_channels\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`users_notification_preferences_channels_parent_idx\` ON \`users_notification_preferences_channels\` (\`parent_id\`);`)
  }

  // ─── users.notification_preferences_* 6 個欄位 ───────────────────────
  const userCols: Array<{ name: string; def: string }> = [
    { name: 'notification_preferences_bell_in_admin', def: 'integer DEFAULT true' },
    { name: 'notification_preferences_email_digest', def: 'integer DEFAULT false' },
    { name: 'notification_preferences_email_digest_time', def: "text DEFAULT '09:00'" },
    { name: 'notification_preferences_quiet_hours_start', def: 'text' },
    { name: 'notification_preferences_quiet_hours_end', def: 'text' },
    { name: 'notification_preferences_mobile_push_token', def: 'text' },
  ]
  for (const c of userCols) {
    if (!(await columnExists(db, 'users', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD \`${c.name}\` ${c.def};`))
    }
  }

  // ─── payload_locked_documents_rels FK 4 欄 ──────────────────────────
  const lockedRelsCols: Array<{ name: string; ref: string }> = [
    { name: 'conversations_id', ref: 'conversations(id)' },
    { name: 'messages_id', ref: 'messages(id)' },
    { name: 'message_tags_id', ref: 'message_tags(id)' },
    { name: 'conversation_activities_id', ref: 'conversation_activities(id)' },
  ]
  for (const c of lockedRelsCols) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', c.name))) {
      await db.run(
        sql.raw(
          `ALTER TABLE \`payload_locked_documents_rels\` ADD \`${c.name}\` integer REFERENCES ${c.ref};`,
        ),
      )
      await db.run(
        sql.raw(
          `CREATE INDEX \`payload_locked_documents_rels_${c.name}_idx\` ON \`payload_locked_documents_rels\` (\`${c.name}\`);`,
        ),
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 順序顛倒（依 FK 依賴）
  for (const t of [
    'conversation_activities',
    'messages_attachments',
    'messages',
    'conversations_rels',
    'conversations',
    'message_tags',
    'cs_settings_business_hours_schedule',
    'cs_settings_business_hours_holidays',
    'cs_settings_sla_first_response_minutes',
    'cs_settings_sla_resolution_hours',
    'cs_settings_anti_spam_blocked_keywords',
    'cs_settings_anti_spam_blocked_anon_ids',
    'cs_settings_anti_spam_blocked_i_ps',
    'cs_settings',
    'users_notification_preferences_channels',
  ]) {
    if (await tableExists(db, t)) {
      await db.run(sql.raw(`DROP TABLE \`${t}\`;`))
    }
  }
  // 不 DROP COLUMN users.notification_preferences_* 與 payload_locked_documents_rels.*_id（SQLite 成本高，留著為 dangling 無害）
}
