import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Podcasts collection — chickimmiu 品牌 podcast 系列管理
 *
 * 對應檔案：src/collections/Podcasts.ts
 *
 * 新增 tables：
 *   - podcasts（主表）
 *   - podcasts_tags（array { tag }）
 *   - podcasts_sources（array { label, url }）
 *   - podcasts_hosts（array { name, role }）
 *   - podcasts_rels（hasMany: relatedProducts / relatedCategories）
 *
 * 新增 columns：
 *   - payload_locked_documents_rels.podcasts_id
 *
 * 冪等：sqlite_master / PRAGMA pattern，承襲 20260428_074640_add_customer_service_v1.ts
 *
 * down：DROP 新表，不 ALTER 移除 payload_locked_documents_rels.podcasts_id
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
  // ─── podcasts 主表 ──────────────────────────────────────────────
  if (!(await tableExists(db, 'podcasts'))) {
    await db.run(sql`CREATE TABLE \`podcasts\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`title\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`episode_number\` numeric NOT NULL,
      \`excerpt\` text,
      \`category\` text DEFAULT 'trends' NOT NULL,
      \`audio_file_id\` integer NOT NULL,
      \`duration\` numeric,
      \`cover_image_id\` integer,
      \`show_notes\` text,
      \`ai_generated\` integer DEFAULT false,
      \`notebook_id\` text,
      \`status\` text DEFAULT 'draft' NOT NULL,
      \`published_at\` text,
      \`seo_meta_title\` text,
      \`seo_meta_description\` text,
      \`seo_meta_image_id\` integer,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`audio_file_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`seo_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`podcasts_slug_idx\` ON \`podcasts\` (\`slug\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_episode_number_idx\` ON \`podcasts\` (\`episode_number\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_category_idx\` ON \`podcasts\` (\`category\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_status_idx\` ON \`podcasts\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_published_at_idx\` ON \`podcasts\` (\`published_at\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_audio_file_idx\` ON \`podcasts\` (\`audio_file_id\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_cover_image_idx\` ON \`podcasts\` (\`cover_image_id\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_seo_meta_image_idx\` ON \`podcasts\` (\`seo_meta_image_id\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_updated_at_idx\` ON \`podcasts\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_created_at_idx\` ON \`podcasts\` (\`created_at\`);`)
  }

  // ─── podcasts_tags（array { tag }）──────────────────────────────
  if (!(await tableExists(db, 'podcasts_tags'))) {
    await db.run(sql`CREATE TABLE \`podcasts_tags\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`tag\` text NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`podcasts\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`podcasts_tags_order_idx\` ON \`podcasts_tags\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_tags_parent_id_idx\` ON \`podcasts_tags\` (\`_parent_id\`);`)
  }

  // ─── podcasts_sources（array { label, url }）────────────────────
  if (!(await tableExists(db, 'podcasts_sources'))) {
    await db.run(sql`CREATE TABLE \`podcasts_sources\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`label\` text NOT NULL,
      \`url\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`podcasts\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`podcasts_sources_order_idx\` ON \`podcasts_sources\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_sources_parent_id_idx\` ON \`podcasts_sources\` (\`_parent_id\`);`)
  }

  // ─── podcasts_hosts（array { name, role }）──────────────────────
  if (!(await tableExists(db, 'podcasts_hosts'))) {
    await db.run(sql`CREATE TABLE \`podcasts_hosts\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`role\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`podcasts\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`podcasts_hosts_order_idx\` ON \`podcasts_hosts\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_hosts_parent_id_idx\` ON \`podcasts_hosts\` (\`_parent_id\`);`)
  }

  // ─── podcasts_rels（hasMany: relatedProducts / relatedCategories）
  if (!(await tableExists(db, 'podcasts_rels'))) {
    await db.run(sql`CREATE TABLE \`podcasts_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`products_id\` integer,
      \`categories_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`podcasts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`podcasts_rels_order_idx\` ON \`podcasts_rels\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_rels_parent_idx\` ON \`podcasts_rels\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_rels_path_idx\` ON \`podcasts_rels\` (\`path\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_rels_products_id_idx\` ON \`podcasts_rels\` (\`products_id\`);`)
    await db.run(sql`CREATE INDEX \`podcasts_rels_categories_id_idx\` ON \`podcasts_rels\` (\`categories_id\`);`)
  }

  // ─── payload_locked_documents_rels.podcasts_id FK ──────────────
  if (await tableExists(db, 'payload_locked_documents_rels')) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', 'podcasts_id'))) {
      await db.run(
        sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`podcasts_id\` integer REFERENCES podcasts(id);`,
      )
      await db.run(
        sql`CREATE INDEX \`payload_locked_documents_rels_podcasts_id_idx\` ON \`payload_locked_documents_rels\` (\`podcasts_id\`);`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`podcasts_rels\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`podcasts_hosts\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`podcasts_sources\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`podcasts_tags\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`podcasts\`;`)
  // SQLite DROP COLUMN 成本高，留 payload_locked_documents_rels.podcasts_id 不刪
}
