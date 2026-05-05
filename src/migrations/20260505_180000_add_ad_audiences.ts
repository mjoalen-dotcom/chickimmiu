import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-E1 — AdAudiences collection schema
 *
 * 對應檔案：src/collections/AdAudiences.ts
 *
 * 新增 tables：
 *   - ad_audiences（主表）
 *   - ad_audiences_rels（hasMany: filterProductIds → products）
 *
 * 新增 columns：
 *   - payload_locked_documents_rels.ad_audiences_id
 *
 * 冪等：sqlite_master / PRAGMA pattern，承襲 20260504_163000_add_podcasts.ts
 *
 * down：DROP 新表，不 ALTER 移除 payload_locked_documents_rels.ad_audiences_id
 *   （SQLite DROP COLUMN 成本高且 prod 無回滾需求）
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
  // ─── ad_audiences 主表 ──────────────────────────────────────────
  if (!(await tableExists(db, 'ad_audiences'))) {
    await db.run(sql`CREATE TABLE \`ad_audiences\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`type\` text DEFAULT 'viewers' NOT NULL,
      \`description\` text,
      \`time_window_days\` numeric DEFAULT 14 NOT NULL,
      \`exclude_purchasers_days\` numeric DEFAULT 14,
      \`enabled\` integer DEFAULT false,
      \`sync_status\` text DEFAULT 'idle',
      \`last_sync_at\` text,
      \`meta_audience_id\` text,
      \`estimated_size\` numeric,
      \`sync_error\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`CREATE INDEX \`ad_audiences_type_idx\` ON \`ad_audiences\` (\`type\`);`)
    await db.run(
      sql`CREATE INDEX \`ad_audiences_sync_status_idx\` ON \`ad_audiences\` (\`sync_status\`);`,
    )
    await db.run(sql`CREATE INDEX \`ad_audiences_enabled_idx\` ON \`ad_audiences\` (\`enabled\`);`)
    await db.run(
      sql`CREATE INDEX \`ad_audiences_last_sync_at_idx\` ON \`ad_audiences\` (\`last_sync_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ad_audiences_updated_at_idx\` ON \`ad_audiences\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`ad_audiences_created_at_idx\` ON \`ad_audiences\` (\`created_at\`);`,
    )
  }

  // ─── ad_audiences_rels（hasMany: filterProductIds → products）──
  if (!(await tableExists(db, 'ad_audiences_rels'))) {
    await db.run(sql`CREATE TABLE \`ad_audiences_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`products_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`ad_audiences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
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
    await db.run(
      sql`CREATE INDEX \`ad_audiences_rels_products_id_idx\` ON \`ad_audiences_rels\` (\`products_id\`);`,
    )
  }

  // ─── payload_locked_documents_rels.ad_audiences_id FK ──────────
  if (await tableExists(db, 'payload_locked_documents_rels')) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', 'ad_audiences_id'))) {
      await db.run(
        sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`ad_audiences_id\` integer REFERENCES ad_audiences(id);`,
      )
      await db.run(
        sql`CREATE INDEX \`payload_locked_documents_rels_ad_audiences_id_idx\` ON \`payload_locked_documents_rels\` (\`ad_audiences_id\`);`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`ad_audiences_rels\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`ad_audiences\`;`)
  // SQLite DROP COLUMN 成本高，留 payload_locked_documents_rels.ad_audiences_id 不刪
}
