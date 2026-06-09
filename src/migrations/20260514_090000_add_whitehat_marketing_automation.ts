import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * White-hat marketing automation
 *
 * Adds three admin-only collections:
 * - search_console_keywords
 * - competitor_price_records
 * - marketing_content_drafts
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

async function indexIfMissing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  name: string,
  ddl: string,
): Promise<void> {
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS \`${name}\` ${ddl};`))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await tableExists(db, 'search_console_keywords'))) {
    await db.run(sql`CREATE TABLE \`search_console_keywords\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`query\` text NOT NULL,
      \`page_path\` text,
      \`target_product_id\` integer REFERENCES products(id) ON DELETE SET NULL,
      \`source\` text DEFAULT 'gsc',
      \`impressions\` numeric DEFAULT 0,
      \`clicks\` numeric DEFAULT 0,
      \`ctr\` numeric DEFAULT 0,
      \`position\` numeric,
      \`opportunity_score\` numeric DEFAULT 0,
      \`intent\` text DEFAULT 'unknown',
      \`status\` text DEFAULT 'new',
      \`suggestions_title\` text,
      \`suggestions_meta_description\` text,
      \`suggestions_faq\` text,
      \`suggestions_copy_patch\` text,
      \`imported_at\` text,
      \`last_applied_at\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
  }
  await indexIfMissing(db, 'search_console_keywords_query_idx', 'ON `search_console_keywords` (`query`)')
  await indexIfMissing(db, 'search_console_keywords_page_path_idx', 'ON `search_console_keywords` (`page_path`)')
  await indexIfMissing(db, 'search_console_keywords_target_product_idx', 'ON `search_console_keywords` (`target_product_id`)')
  await indexIfMissing(db, 'search_console_keywords_status_idx', 'ON `search_console_keywords` (`status`)')
  await indexIfMissing(db, 'search_console_keywords_opportunity_idx', 'ON `search_console_keywords` (`opportunity_score`)')
  await indexIfMissing(db, 'search_console_keywords_updated_at_idx', 'ON `search_console_keywords` (`updated_at`)')
  await indexIfMissing(db, 'search_console_keywords_created_at_idx', 'ON `search_console_keywords` (`created_at`)')

  if (!(await tableExists(db, 'competitor_price_records'))) {
    await db.run(sql`CREATE TABLE \`competitor_price_records\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`product_name\` text NOT NULL,
      \`normalized_name\` text,
      \`related_product_id\` integer REFERENCES products(id) ON DELETE SET NULL,
      \`platform\` text DEFAULT 'other',
      \`competitor_name\` text,
      \`source_url\` text,
      \`price_t_w_d\` numeric,
      \`price_k_r_w\` numeric,
      \`estimated_cost_t_w_d\` numeric,
      \`style\` text,
      \`material\` text,
      \`observed_at\` text,
      \`metrics_margin_score\` numeric,
      \`metrics_trend_score\` numeric,
      \`metrics_risk_score\` numeric,
      \`metrics_matching_score\` numeric,
      \`metrics_live_score\` numeric,
      \`metrics_ads_score\` numeric,
      \`metrics_estimated_margin_percent\` numeric,
      \`total_score\` numeric DEFAULT 0,
      \`purchase_recommendation\` text,
      \`status\` text DEFAULT 'new',
      \`notes\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
  }
  await indexIfMissing(db, 'competitor_price_records_product_name_idx', 'ON `competitor_price_records` (`product_name`)')
  await indexIfMissing(db, 'competitor_price_records_normalized_name_idx', 'ON `competitor_price_records` (`normalized_name`)')
  await indexIfMissing(db, 'competitor_price_records_related_product_idx', 'ON `competitor_price_records` (`related_product_id`)')
  await indexIfMissing(db, 'competitor_price_records_total_score_idx', 'ON `competitor_price_records` (`total_score`)')
  await indexIfMissing(db, 'competitor_price_records_status_idx', 'ON `competitor_price_records` (`status`)')

  if (!(await tableExists(db, 'competitor_price_records_flags'))) {
    await db.run(sql`CREATE TABLE \`competitor_price_records_flags\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`competitor_price_records\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  await indexIfMissing(db, 'competitor_price_records_flags_order_idx', 'ON `competitor_price_records_flags` (`order`)')
  await indexIfMissing(db, 'competitor_price_records_flags_parent_idx', 'ON `competitor_price_records_flags` (`parent_id`)')

  if (!(await tableExists(db, 'marketing_content_drafts'))) {
    await db.run(sql`CREATE TABLE \`marketing_content_drafts\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`type\` text NOT NULL,
      \`title\` text NOT NULL,
      \`status\` text DEFAULT 'draft',
      \`target_product_id\` integer REFERENCES products(id) ON DELETE SET NULL,
      \`target_segment\` text DEFAULT 'all',
      \`body\` text NOT NULL,
      \`hashtags\` text,
      \`metadata\` text,
      \`scheduled_at\` text,
      \`generated_by\` text DEFAULT 'whitehat-automation',
      \`notes\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
  }
  await indexIfMissing(db, 'marketing_content_drafts_type_idx', 'ON `marketing_content_drafts` (`type`)')
  await indexIfMissing(db, 'marketing_content_drafts_title_idx', 'ON `marketing_content_drafts` (`title`)')
  await indexIfMissing(db, 'marketing_content_drafts_status_idx', 'ON `marketing_content_drafts` (`status`)')
  await indexIfMissing(db, 'marketing_content_drafts_target_product_idx', 'ON `marketing_content_drafts` (`target_product_id`)')
  await indexIfMissing(db, 'marketing_content_drafts_scheduled_at_idx', 'ON `marketing_content_drafts` (`scheduled_at`)')

  if (!(await tableExists(db, 'marketing_content_drafts_channels'))) {
    await db.run(sql`CREATE TABLE \`marketing_content_drafts_channels\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`marketing_content_drafts\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  await indexIfMissing(db, 'marketing_content_drafts_channels_order_idx', 'ON `marketing_content_drafts_channels` (`order`)')
  await indexIfMissing(db, 'marketing_content_drafts_channels_parent_idx', 'ON `marketing_content_drafts_channels` (`parent_id`)')

  const lockColumns = [
    { name: 'search_console_keywords_id', ref: 'search_console_keywords(id)' },
    { name: 'competitor_price_records_id', ref: 'competitor_price_records(id)' },
    { name: 'marketing_content_drafts_id', ref: 'marketing_content_drafts(id)' },
  ]
  for (const c of lockColumns) {
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
  if (await tableExists(db, 'marketing_content_drafts_channels')) {
    await db.run(sql`DROP TABLE \`marketing_content_drafts_channels\`;`)
  }
  if (await tableExists(db, 'marketing_content_drafts')) {
    await db.run(sql`DROP TABLE \`marketing_content_drafts\`;`)
  }
  if (await tableExists(db, 'competitor_price_records_flags')) {
    await db.run(sql`DROP TABLE \`competitor_price_records_flags\`;`)
  }
  if (await tableExists(db, 'competitor_price_records')) {
    await db.run(sql`DROP TABLE \`competitor_price_records\`;`)
  }
  if (await tableExists(db, 'search_console_keywords')) {
    await db.run(sql`DROP TABLE \`search_console_keywords\`;`)
  }
}
