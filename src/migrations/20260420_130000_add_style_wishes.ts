import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-1 games-social — style_wishes 主表 + reference_photos / grants 兩個 array 子表。
 *
 * 對照 src/collections/StyleWishes.ts：
 *   主表：id / seeker_id / title / description / budget_hint / bounty_points /
 *     status / winning_grant_id / expires_at / metadata / created_at / updated_at
 *   子表 style_wishes_reference_photos：_order / _parent_id / id / image_id
 *   子表 style_wishes_grants：_order / _parent_id / id / granter_id /
 *     submission_id / note
 *
 * FK：seeker_id, winning_grant_id, grants.granter_id, grants.submission_id
 *   全 `ON DELETE set null`；_parent_id `ON DELETE cascade`。
 *
 * 冪等：sqlite_master / PRAGMA 判斷。
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, index: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${index}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1. 主表 style_wishes ──
  if (!(await tableExists(db, 'style_wishes'))) {
    await db.run(sql`CREATE TABLE \`style_wishes\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`seeker_id\` integer NOT NULL,
      \`title\` text NOT NULL,
      \`description\` text NOT NULL,
      \`budget_hint\` text,
      \`bounty_points\` numeric DEFAULT 0,
      \`status\` text DEFAULT 'open' NOT NULL,
      \`winning_grant_id\` integer,
      \`expires_at\` text NOT NULL,
      \`metadata\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`seeker_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`winning_grant_id\`) REFERENCES \`style_submissions\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    await db.run(sql`CREATE INDEX \`style_wishes_seeker_idx\` ON \`style_wishes\` (\`seeker_id\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_status_idx\` ON \`style_wishes\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_winning_grant_idx\` ON \`style_wishes\` (\`winning_grant_id\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_expires_at_idx\` ON \`style_wishes\` (\`expires_at\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_updated_at_idx\` ON \`style_wishes\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_created_at_idx\` ON \`style_wishes\` (\`created_at\`);`)
    // 複合 index：會員自己許願清單、公開 feed、過期掃
    await db.run(sql`CREATE INDEX \`style_wishes_seeker_status_created_at_idx\` ON \`style_wishes\` (\`seeker_id\`, \`status\`, \`created_at\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_status_created_at_idx\` ON \`style_wishes\` (\`status\`, \`created_at\`);`)
  }

  // ── 2. 子表 style_wishes_reference_photos ──
  if (!(await tableExists(db, 'style_wishes_reference_photos'))) {
    await db.run(sql`CREATE TABLE \`style_wishes_reference_photos\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`image_id\` integer NOT NULL,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`style_wishes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`style_wishes_reference_photos_order_idx\` ON \`style_wishes_reference_photos\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_reference_photos_parent_id_idx\` ON \`style_wishes_reference_photos\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_reference_photos_image_idx\` ON \`style_wishes_reference_photos\` (\`image_id\`);`)
  }

  // ── 3. 子表 style_wishes_grants ──
  if (!(await tableExists(db, 'style_wishes_grants'))) {
    await db.run(sql`CREATE TABLE \`style_wishes_grants\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`granter_id\` integer NOT NULL,
      \`submission_id\` integer NOT NULL,
      \`note\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`style_wishes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`granter_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`submission_id\`) REFERENCES \`style_submissions\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`style_wishes_grants_order_idx\` ON \`style_wishes_grants\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_grants_parent_id_idx\` ON \`style_wishes_grants\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_grants_granter_idx\` ON \`style_wishes_grants\` (\`granter_id\`);`)
    await db.run(sql`CREATE INDEX \`style_wishes_grants_submission_idx\` ON \`style_wishes_grants\` (\`submission_id\`);`)
  }

  // ── 4. payload_locked_documents_rels 加欄位 ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'style_wishes_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`style_wishes_id\` integer REFERENCES style_wishes(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_style_wishes_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_style_wishes_id_idx\` ON \`payload_locked_documents_rels\` (\`style_wishes_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'style_wishes_grants')) {
    await db.run(sql`DROP TABLE \`style_wishes_grants\`;`)
  }
  if (await tableExists(db, 'style_wishes_reference_photos')) {
    await db.run(sql`DROP TABLE \`style_wishes_reference_photos\`;`)
  }
  if (await tableExists(db, 'style_wishes')) {
    await db.run(sql`DROP TABLE \`style_wishes\`;`)
  }
}
