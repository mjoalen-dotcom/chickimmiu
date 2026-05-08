import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Session 33 — PR-2 + PR-3 自動計價
 *
 * 新表：
 *   - pricing_formula_settings  （single-row global）
 *
 * 新欄位：
 *   - products.auto_pricing_use_auto_pricing      （checkbox，預設 0）
 *   - products.auto_pricing_cost_amount           （採購金額，採購幣別）
 *   - products.auto_pricing_cost_currency_code    （'KRW' / 'JPY' / 'USD' / 'CNY'）
 *
 * 冪等：sqlite_master + PRAGMA pattern；沿用 20260421_100000_add_tax.ts。
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
  /* ── pricing_formula_settings 主表（single row global） ── */
  if (!(await tableExists(db, 'pricing_formula_settings'))) {
    await db.run(sql`CREATE TABLE \`pricing_formula_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`currency_code\` text DEFAULT 'KRW',
      \`manual_rate_override\` numeric,
      \`weight_shipping_per_gram\` numeric DEFAULT 0.3,
      \`weight_shipping_flat_fee\` numeric DEFAULT 80,
      \`profit_mode\` text DEFAULT 'percent_only',
      \`profit_percent\` numeric DEFAULT 35,
      \`profit_fixed_floor\` numeric DEFAULT 200,
      \`price_round_to\` numeric DEFAULT 10,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
  }

  /* ── products.auto_pricing_* 3 欄 ── */
  const productCols: Array<{ name: string; def: string }> = [
    { name: 'auto_pricing_use_auto_pricing', def: 'integer DEFAULT 0' },
    { name: 'auto_pricing_cost_amount', def: 'numeric' },
    { name: 'auto_pricing_cost_currency_code', def: "text DEFAULT 'KRW'" },
  ]
  for (const c of productCols) {
    if (!(await columnExists(db, 'products', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`products\` ADD COLUMN \`${c.name}\` ${c.def};`))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'pricing_formula_settings')) {
    await db.run(sql`DROP TABLE \`pricing_formula_settings\`;`)
  }
  // SQLite DROP COLUMN >= 3.35 支援；保留 products.auto_pricing_* 也無害
}
