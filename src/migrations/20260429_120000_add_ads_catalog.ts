import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-A — 廣告目錄 schema：
 *   1. products: 加 9 個 ads 欄位（excludeFromAdsCatalog / adsGender / adsAgeGroup /
 *      adsCondition / googleProductCategory / productType / gtin / mpn /
 *      adsTitleOverride / adsDescriptionOverride）
 *   2. products_variants: 加 gtin 欄位（per-SKU 條碼，feed 變體展開使用）
 *   3. ads_catalog_settings: 新 global 表（feed 啟用 / token / TTL / 預設值 /
 *      Meta+Google ID）
 *
 * 冪等：用 PRAGMA table_info 判斷欄位是否存在 + sqlite_master 判斷表是否存在，
 *      已有則 skip。對應 pattern：
 *      20260416_140000_add_gender_and_male_tier_name.ts (column-level)
 *      20260421_200000_add_checkout_order_settings.ts  (global table)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ─────────────── products: 廣告目錄欄位 ───────────────
  const productCols: Array<{ name: string; ddl: string }> = [
    { name: 'exclude_from_ads_catalog', ddl: '`exclude_from_ads_catalog` integer DEFAULT false' },
    { name: 'ads_gender', ddl: "`ads_gender` text DEFAULT 'female'" },
    { name: 'ads_age_group', ddl: "`ads_age_group` text DEFAULT 'adult'" },
    { name: 'ads_condition', ddl: "`ads_condition` text DEFAULT 'new'" },
    { name: 'google_product_category', ddl: '`google_product_category` text' },
    { name: 'product_type', ddl: '`product_type` text' },
    { name: 'gtin', ddl: '`gtin` text' },
    { name: 'mpn', ddl: '`mpn` text' },
    { name: 'ads_title_override', ddl: '`ads_title_override` text' },
    { name: 'ads_description_override', ddl: '`ads_description_override` text' },
  ]
  for (const c of productCols) {
    if (!(await columnExists(db, 'products', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`products\` ADD COLUMN ${c.ddl};`))
    }
  }

  // ─────────────── products_variants: gtin per SKU ───────────────
  if (!(await columnExists(db, 'products_variants', 'gtin'))) {
    await db.run(sql`ALTER TABLE \`products_variants\` ADD COLUMN \`gtin\` text;`)
  }

  // ─────────────── ads_catalog_settings global ───────────────
  if (!(await tableExists(db, 'ads_catalog_settings'))) {
    await db.run(sql`CREATE TABLE \`ads_catalog_settings\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`general_enabled\` integer DEFAULT true,
      \`general_feed_secret_token\` text,
      \`general_feed_cache_ttl_minutes\` numeric DEFAULT 60,
      \`general_include_out_of_stock\` integer DEFAULT true,
      \`general_include_draft\` integer DEFAULT false,
      \`defaults_default_brand\` text DEFAULT 'CHIC KIM & MIU',
      \`defaults_default_currency\` text DEFAULT 'TWD',
      \`defaults_default_gender\` text DEFAULT 'female',
      \`defaults_default_age_group\` text DEFAULT 'adult',
      \`defaults_default_condition\` text DEFAULT 'new',
      \`defaults_default_google_product_category\` text DEFAULT 'Apparel & Accessories > Clothing > Dresses',
      \`defaults_default_product_type_prefix\` text DEFAULT '女裝 > 韓系',
      \`defaults_default_locale\` text DEFAULT 'zh_TW',
      \`meta_business_manager_id\` text,
      \`meta_catalog_id\` text,
      \`meta_ad_account_id\` text,
      \`meta_system_user_token\` text,
      \`google_merchant_center_id\` text,
      \`google_service_account_email\` text,
      \`feed_urls_meta_feed_url\` text DEFAULT 'https://chickimmiu.com/feeds/meta.xml',
      \`feed_urls_google_feed_url\` text DEFAULT 'https://chickimmiu.com/feeds/google.xml',
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'ads_catalog_settings')) {
    await db.run(sql`DROP TABLE \`ads_catalog_settings\`;`)
  }
  if (await columnExists(db, 'products_variants', 'gtin')) {
    await db.run(sql`ALTER TABLE \`products_variants\` DROP COLUMN \`gtin\`;`)
  }
  const productCols = [
    'exclude_from_ads_catalog',
    'ads_gender',
    'ads_age_group',
    'ads_condition',
    'google_product_category',
    'product_type',
    'gtin',
    'mpn',
    'ads_title_override',
    'ads_description_override',
  ]
  for (const c of productCols) {
    if (await columnExists(db, 'products', c)) {
      await db.run(sql.raw(`ALTER TABLE \`products\` DROP COLUMN \`${c}\`;`))
    }
  }
}
