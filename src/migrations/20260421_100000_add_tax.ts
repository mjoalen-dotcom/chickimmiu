import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Session 19B — TaxSettings global + per-product taxCategory + order tax + invoice taxBreakdown
 *
 * 新增 tables：
 *   - tax_settings                   （global，single row）
 *   - tax_settings_tax_categories    （array 子表）
 * 新欄位：
 *   - products.tax_category
 *   - orders.tax_amount / tax_rate / subtotal_excluding_tax / shipping_tax_amount
 *   - invoices.tax_breakdown_standard_taxable / _standard_tax / _zero_rated_sales / _exempt_sales
 *
 * 冪等：sqlite_master + PRAGMA pattern，承襲 20260418_220000_add_login_attempts.ts。
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
  // ── tax_settings 主表 ─────────────────────────────
  if (!(await tableExists(db, 'tax_settings'))) {
    await db.run(sql`CREATE TABLE \`tax_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`default_tax_included\` integer DEFAULT 1,
      \`default_tax_rate\` numeric DEFAULT 5,
      \`shipping_taxable\` integer DEFAULT 1,
      \`invoice_breakdown_show_tax_line\` integer DEFAULT 1,
      \`invoice_breakdown_rounding_mode\` text DEFAULT 'round_half_up',
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
  }

  // ── tax_settings_tax_categories array 子表 ───────
  if (!(await tableExists(db, 'tax_settings_tax_categories'))) {
    await db.run(sql`CREATE TABLE \`tax_settings_tax_categories\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`value\` text,
      \`label\` text,
      \`rate\` numeric DEFAULT 0,
      \`exempt\` integer DEFAULT 0,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`tax_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`tax_settings_tax_categories_order_idx\` ON \`tax_settings_tax_categories\` (\`_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`tax_settings_tax_categories_parent_id_idx\` ON \`tax_settings_tax_categories\` (\`_parent_id\`);`,
    )
  }

  // ── products.tax_category ────────────────────────
  if (!(await columnExists(db, 'products', 'tax_category'))) {
    await db.run(
      sql`ALTER TABLE \`products\` ADD COLUMN \`tax_category\` text DEFAULT 'standard';`,
    )
  }

  // ── orders 稅金 4 欄 ──────────────────────────────
  const orderCols: Array<{ name: string; def: string }> = [
    { name: 'tax_amount', def: 'numeric DEFAULT 0' },
    { name: 'tax_rate', def: 'numeric DEFAULT 5' },
    { name: 'subtotal_excluding_tax', def: 'numeric DEFAULT 0' },
    { name: 'shipping_tax_amount', def: 'numeric DEFAULT 0' },
  ]
  for (const c of orderCols) {
    if (!(await columnExists(db, 'orders', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`orders\` ADD COLUMN \`${c.name}\` ${c.def};`))
    }
  }

  // ── invoices.tax_breakdown_* 4 欄 ────────────────
  const invoiceCols: Array<{ name: string; def: string }> = [
    { name: 'tax_breakdown_standard_taxable', def: 'numeric DEFAULT 0' },
    { name: 'tax_breakdown_standard_tax', def: 'numeric DEFAULT 0' },
    { name: 'tax_breakdown_zero_rated_sales', def: 'numeric DEFAULT 0' },
    { name: 'tax_breakdown_exempt_sales', def: 'numeric DEFAULT 0' },
  ]
  for (const c of invoiceCols) {
    if (!(await columnExists(db, 'invoices', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`invoices\` ADD COLUMN \`${c.name}\` ${c.def};`))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'tax_settings_tax_categories')) {
    await db.run(sql`DROP TABLE \`tax_settings_tax_categories\`;`)
  }
  if (await tableExists(db, 'tax_settings')) {
    await db.run(sql`DROP TABLE \`tax_settings\`;`)
  }
  // SQLite DROP COLUMN 成本高；保留欄位無害（products.tax_category / orders.tax_* / invoices.tax_breakdown_*）
}
