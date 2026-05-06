import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-E1 — AdAudiences collection table
 *
 * 冪等：sqlite_master 判斷表是否存在，已有則 skip。
 * Pattern 同 20260429_120000_add_ads_catalog.ts。
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
  // ─────────────── ad_audiences ───────────────
  if (!(await tableExists(db, 'ad_audiences'))) {
    await db.run(sql`CREATE TABLE \`ad_audiences\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`description\` text,
      \`type\` text DEFAULT 'viewers' NOT NULL,
      \`enabled\` integer DEFAULT true,
      \`time_window_days\` numeric DEFAULT 14 NOT NULL,
      \`exclude_purchasers_days\` numeric DEFAULT 14,
      \`sync_status\` text DEFAULT 'idle',
      \`meta_audience_id\` text,
      \`last_sync_at\` text,
      \`sync_error\` text,
      \`estimated_size\` numeric,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
  }

  // ─────────────── ad_audiences_rels (relationship join table for filterProducts) ───────────────
  if (!(await tableExists(db, 'ad_audiences_rels'))) {
    await db.run(sql`CREATE TABLE \`ad_audiences_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`products_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`ad_audiences\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE
    );`)
    await db.run(
      sql`CREATE INDEX \`ad_audiences_rels_order_idx\` ON \`ad_audiences_rels\` (\`order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ad_audiences_rels_parent_idx\` ON \`ad_audiences_rels\` (\`parent_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ad_audiences_rels_path_idx\` ON \`ad_audiences_rels\` (\`path\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'ad_audiences_rels')) {
    await db.run(sql`DROP TABLE \`ad_audiences_rels\`;`)
  }
  if (await tableExists(db, 'ad_audiences')) {
    await db.run(sql`DROP TABLE \`ad_audiences\`;`)
  }
}
