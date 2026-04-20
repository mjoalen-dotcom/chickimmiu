import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Shopline gap — 19D 促銷三件套
 *   - add_on_products + add_on_products_rels（conditions.appliesToProducts hasMany）
 *   - gift_rules + gift_rules_rels（triggerProducts hasMany + giftProduct）
 *   - bundles + bundles_items（array 子表）+ bundles_rels（items.product FK）
 *   - orders_items ADD COLUMN：bundle_ref_id / is_gift / is_add_on /
 *     gift_rule_ref_id / add_on_rule_ref_id
 *   - payload_locked_documents_rels 加 3 個 FK：add_on_products_id /
 *     gift_rules_id / bundles_id
 *
 * 冪等：sqlite_master / PRAGMA 判斷（同 20260418_220000_add_login_attempts.ts 等 pattern）
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
  // ────────────────── add_on_products ──────────────────
  if (!(await tableExists(db, 'add_on_products'))) {
    await db.run(sql`CREATE TABLE \`add_on_products\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`product_id\` integer,
      \`add_on_price\` numeric NOT NULL,
      \`conditions_min_cart_subtotal\` numeric DEFAULT 0,
      \`conditions_usage_limit_per_order\` numeric DEFAULT 1,
      \`starts_at\` text,
      \`expires_at\` text,
      \`is_active\` integer DEFAULT true,
      \`priority\` numeric DEFAULT 0,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`add_on_products_product_idx\` ON \`add_on_products\` (\`product_id\`);`)
    await db.run(sql`CREATE INDEX \`add_on_products_updated_at_idx\` ON \`add_on_products\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`add_on_products_created_at_idx\` ON \`add_on_products\` (\`created_at\`);`)
  }

  // add_on_products_rels（conditions.appliesToProducts hasMany）
  if (!(await tableExists(db, 'add_on_products_rels'))) {
    await db.run(sql`CREATE TABLE \`add_on_products_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`products_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`add_on_products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`add_on_products_rels_order_idx\` ON \`add_on_products_rels\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`add_on_products_rels_parent_idx\` ON \`add_on_products_rels\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`add_on_products_rels_path_idx\` ON \`add_on_products_rels\` (\`path\`);`)
    await db.run(sql`CREATE INDEX \`add_on_products_rels_products_id_idx\` ON \`add_on_products_rels\` (\`products_id\`);`)
  }

  // ────────────────── gift_rules ──────────────────
  if (!(await tableExists(db, 'gift_rules'))) {
    await db.run(sql`CREATE TABLE \`gift_rules\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`trigger_type\` text DEFAULT 'min_amount' NOT NULL,
      \`min_amount\` numeric,
      \`gift_product_id\` integer,
      \`gift_quantity\` numeric DEFAULT 1,
      \`stackable\` integer DEFAULT false,
      \`starts_at\` text,
      \`expires_at\` text,
      \`is_active\` integer DEFAULT true,
      \`priority\` numeric DEFAULT 0,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`gift_product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`gift_rules_gift_product_idx\` ON \`gift_rules\` (\`gift_product_id\`);`)
    await db.run(sql`CREATE INDEX \`gift_rules_updated_at_idx\` ON \`gift_rules\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`gift_rules_created_at_idx\` ON \`gift_rules\` (\`created_at\`);`)
  }

  // gift_rules_rels（triggerProducts hasMany）
  if (!(await tableExists(db, 'gift_rules_rels'))) {
    await db.run(sql`CREATE TABLE \`gift_rules_rels\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL,
      \`path\` text NOT NULL,
      \`products_id\` integer,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`gift_rules\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`gift_rules_rels_order_idx\` ON \`gift_rules_rels\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`gift_rules_rels_parent_idx\` ON \`gift_rules_rels\` (\`parent_id\`);`)
    await db.run(sql`CREATE INDEX \`gift_rules_rels_path_idx\` ON \`gift_rules_rels\` (\`path\`);`)
    await db.run(sql`CREATE INDEX \`gift_rules_rels_products_id_idx\` ON \`gift_rules_rels\` (\`products_id\`);`)
  }

  // ────────────────── bundles ──────────────────
  if (!(await tableExists(db, 'bundles'))) {
    await db.run(sql`CREATE TABLE \`bundles\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`slug\` text NOT NULL UNIQUE,
      \`description\` text,
      \`original_price\` numeric,
      \`bundle_price\` numeric NOT NULL,
      \`savings\` numeric,
      \`image_id\` integer,
      \`starts_at\` text,
      \`expires_at\` text,
      \`is_active\` integer DEFAULT true,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE UNIQUE INDEX \`bundles_slug_uniq\` ON \`bundles\` (\`slug\`);`)
    await db.run(sql`CREATE INDEX \`bundles_image_idx\` ON \`bundles\` (\`image_id\`);`)
    await db.run(sql`CREATE INDEX \`bundles_updated_at_idx\` ON \`bundles\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`bundles_created_at_idx\` ON \`bundles\` (\`created_at\`);`)
  }

  // bundles_items（array 子表）
  if (!(await tableExists(db, 'bundles_items'))) {
    await db.run(sql`CREATE TABLE \`bundles_items\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`product_id\` integer,
      \`quantity\` numeric DEFAULT 1,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`bundles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`bundles_items_order_idx\` ON \`bundles_items\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`bundles_items_parent_id_idx\` ON \`bundles_items\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`bundles_items_product_idx\` ON \`bundles_items\` (\`product_id\`);`)
  }

  // ────────────────── orders_items ADD COLUMN（5 個新欄位） ──────────────────
  const ordersItemsCols: Array<{ name: string; type: string }> = [
    { name: 'bundle_ref_id', type: 'integer' },
    { name: 'is_gift', type: 'integer DEFAULT 0' },
    { name: 'is_add_on', type: 'integer DEFAULT 0' },
    { name: 'gift_rule_ref_id', type: 'integer' },
    { name: 'add_on_rule_ref_id', type: 'integer' },
  ]
  if (await tableExists(db, 'orders_items')) {
    for (const col of ordersItemsCols) {
      if (!(await columnExists(db, 'orders_items', col.name))) {
        await db.run(sql.raw(`ALTER TABLE \`orders_items\` ADD COLUMN \`${col.name}\` ${col.type};`))
      }
    }
    // FK indexes（不加 ALTER TABLE ADD CONSTRAINT，SQLite 不支援；僅加 index）
    for (const col of ['bundle_ref_id', 'gift_rule_ref_id', 'add_on_rule_ref_id']) {
      const idx = `orders_items_${col}_idx`
      if (!(await indexExists(db, idx))) {
        await db.run(sql.raw(`CREATE INDEX \`${idx}\` ON \`orders_items\` (\`${col}\`);`))
      }
    }
  }

  // ────────────────── payload_locked_documents_rels FK 欄位 ──────────────────
  for (const col of ['add_on_products_id', 'gift_rules_id', 'bundles_id']) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', col))) {
      const refTable = col.replace(/_id$/, '')
      await db.run(
        sql.raw(
          `ALTER TABLE \`payload_locked_documents_rels\` ADD \`${col}\` integer REFERENCES ${refTable}(id);`,
        ),
      )
    }
    const idx = `payload_locked_documents_rels_${col}_idx`
    if (!(await indexExists(db, idx))) {
      await db.run(
        sql.raw(`CREATE INDEX \`${idx}\` ON \`payload_locked_documents_rels\` (\`${col}\`);`),
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of [
    'add_on_products_rels',
    'add_on_products',
    'gift_rules_rels',
    'gift_rules',
    'bundles_items',
    'bundles',
  ]) {
    if (await tableExists(db, table)) {
      await db.run(sql.raw(`DROP TABLE \`${table}\`;`))
    }
  }
  // 刻意不 DROP COLUMN on orders_items / payload_locked_documents_rels（SQLite 成本高）
}
