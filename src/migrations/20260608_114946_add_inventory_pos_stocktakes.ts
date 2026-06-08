import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 進銷存 — InventoryTransactions（庫存異動流水）+ PurchaseOrders（進貨單）+ StockTakes（盤點）
 *
 * 手寫冪等版（本 repo 慣例）：Payload migrate:create 因 repo 用手寫 migration、
 * snapshot baseline 失準，會誤產出重建全 schema 的 migration；故只取它算出的「我這 3 張
 * 表 + 2 張 array 子表」的正確 SQL，包成 tableExists 冪等。
 *
 * 建表順序：purchase_orders / stock_takes 先（inventory_transactions FK 參照它們）。
 * Pattern 承襲 20260604_120000_add_wallet_ledger_and_withdrawals.ts。
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
  // ── 進貨單 + 品項 ──
  if (!(await tableExists(db, 'purchase_orders'))) {
    await db.run(sql`CREATE TABLE \`purchase_orders\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`po_number\` text,
      \`status\` text DEFAULT 'draft' NOT NULL,
      \`supplier_name\` text,
      \`expected_date\` text,
      \`total_cost\` numeric,
      \`received_date\` text,
      \`stock_applied\` integer DEFAULT false,
      \`note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`CREATE INDEX \`purchase_orders_status_idx\` ON \`purchase_orders\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`purchase_orders_updated_at_idx\` ON \`purchase_orders\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`purchase_orders_created_at_idx\` ON \`purchase_orders\` (\`created_at\`);`)
  }
  if (!(await tableExists(db, 'purchase_orders_items'))) {
    await db.run(sql`CREATE TABLE \`purchase_orders_items\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`product_id\` integer,
      \`sku\` text,
      \`quantity\` numeric NOT NULL,
      \`unit_cost\` numeric,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`purchase_orders\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`purchase_orders_items_order_idx\` ON \`purchase_orders_items\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`purchase_orders_items_parent_id_idx\` ON \`purchase_orders_items\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`purchase_orders_items_product_idx\` ON \`purchase_orders_items\` (\`product_id\`);`)
  }

  // ── 盤點 + 品項 ──
  if (!(await tableExists(db, 'stock_takes'))) {
    await db.run(sql`CREATE TABLE \`stock_takes\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`title\` text,
      \`status\` text DEFAULT 'draft' NOT NULL,
      \`applied\` integer DEFAULT false,
      \`completed_at\` text,
      \`note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`CREATE INDEX \`stock_takes_status_idx\` ON \`stock_takes\` (\`status\`);`)
    await db.run(sql`CREATE INDEX \`stock_takes_updated_at_idx\` ON \`stock_takes\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`stock_takes_created_at_idx\` ON \`stock_takes\` (\`created_at\`);`)
  }
  if (!(await tableExists(db, 'stock_takes_items'))) {
    await db.run(sql`CREATE TABLE \`stock_takes_items\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`product_id\` integer,
      \`sku\` text,
      \`system_qty\` numeric,
      \`counted_qty\` numeric NOT NULL,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`stock_takes\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`stock_takes_items_order_idx\` ON \`stock_takes_items\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`stock_takes_items_parent_id_idx\` ON \`stock_takes_items\` (\`_parent_id\`);`)
    await db.run(sql`CREATE INDEX \`stock_takes_items_product_idx\` ON \`stock_takes_items\` (\`product_id\`);`)
  }

  // ── 庫存異動流水（FK 參照 purchase_orders / stock_takes，故最後建）──
  if (!(await tableExists(db, 'inventory_transactions'))) {
    await db.run(sql`CREATE TABLE \`inventory_transactions\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`product_id\` integer,
      \`sku\` text,
      \`type\` text NOT NULL,
      \`quantity_delta\` numeric NOT NULL,
      \`balance_after\` numeric,
      \`related_order_id\` integer,
      \`related_purchase_order_id\` integer,
      \`related_stock_take_id\` integer,
      \`note\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`related_order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`related_purchase_order_id\`) REFERENCES \`purchase_orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`related_stock_take_id\`) REFERENCES \`stock_takes\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`inventory_transactions_product_idx\` ON \`inventory_transactions\` (\`product_id\`);`)
    await db.run(sql`CREATE INDEX \`inventory_transactions_type_idx\` ON \`inventory_transactions\` (\`type\`);`)
    await db.run(sql`CREATE INDEX \`inventory_transactions_related_order_idx\` ON \`inventory_transactions\` (\`related_order_id\`);`)
    await db.run(sql`CREATE INDEX \`inventory_transactions_related_purchase_order_idx\` ON \`inventory_transactions\` (\`related_purchase_order_id\`);`)
    await db.run(sql`CREATE INDEX \`inventory_transactions_related_stock_take_idx\` ON \`inventory_transactions\` (\`related_stock_take_id\`);`)
    await db.run(sql`CREATE INDEX \`inventory_transactions_updated_at_idx\` ON \`inventory_transactions\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`inventory_transactions_created_at_idx\` ON \`inventory_transactions\` (\`created_at\`);`)
  }

  // ── payload_locked_documents_rels FK 欄位 ──
  for (const col of ['inventory_transactions_id', 'purchase_orders_id', 'stock_takes_id']) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', col))) {
      const refTable = col.replace(/_id$/, '')
      await db.run(
        sql.raw(
          `ALTER TABLE \`payload_locked_documents_rels\` ADD \`${col}\` integer REFERENCES ${refTable}(id);`,
        ),
      )
      await db.run(
        sql.raw(
          `CREATE INDEX \`payload_locked_documents_rels_${col}_idx\` ON \`payload_locked_documents_rels\` (\`${col}\`);`,
        ),
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of [
    'inventory_transactions',
    'purchase_orders_items',
    'purchase_orders',
    'stock_takes_items',
    'stock_takes',
  ]) {
    if (await tableExists(db, t)) {
      await db.run(sql.raw(`DROP TABLE \`${t}\`;`))
    }
  }
}
