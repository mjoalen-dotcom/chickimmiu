import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PackagingPageSettings global（/packaging 商品包裝頁後台化）三張表。
 * 欄位 = src/globals/PackagingPageSettings.ts 攤平（group 前綴 + snake_case），
 * DDL 慣例照 20260414_000000_baseline.ts 的 faq_page_settings 系列。
 * 前台 page.tsx 有 try/catch fallback，migration 未跑前頁面不會壞；
 * 這裡建表後後台才能開啟編輯。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`packaging_page_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`hero_background_image_url\` text DEFAULT 'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png',
  \`hero_eyebrow\` text DEFAULT 'Packaging',
  \`hero_title\` text DEFAULT '商品包裝',
  \`hero_subtitle\` text DEFAULT '精心包裝每一份心意，從拆封的那一刻開始享受',
  \`philosophy_eyebrow\` text DEFAULT 'Philosophy',
  \`philosophy_heading\` text DEFAULT '包裝理念',
  \`philosophy_body\` text,
  \`features_eyebrow\` text DEFAULT 'Features',
  \`features_heading\` text DEFAULT '包裝特色',
  \`process_eyebrow\` text DEFAULT 'Process',
  \`process_heading\` text DEFAULT '出貨流程',
  \`gift_cta_heading\` text DEFAULT '禮物包裝服務',
  \`gift_cta_description\` text,
  \`gift_cta_badge_text\` text DEFAULT '加購禮物包裝 NT$ 80 / 件',
  \`seo_meta_title\` text DEFAULT '商品包裝',
  \`seo_meta_description\` text DEFAULT 'CHIC KIM & MIU 商品包裝說明 — 了解我們精心設計的包裝細節與環保理念。',
  \`updated_at\` text,
  \`created_at\` text
);`),
  )

  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`packaging_page_settings_features_items\` (
  \`_order\` integer NOT NULL,
  \`_parent_id\` integer NOT NULL,
  \`id\` text PRIMARY KEY NOT NULL,
  \`icon\` text DEFAULT 'Sparkles',
  \`title\` text NOT NULL,
  \`description\` text NOT NULL,
  FOREIGN KEY (\`_parent_id\`) REFERENCES \`packaging_page_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`),
  )

  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`packaging_page_settings_process_steps\` (
  \`_order\` integer NOT NULL,
  \`_parent_id\` integer NOT NULL,
  \`id\` text PRIMARY KEY NOT NULL,
  \`step\` text NOT NULL,
  \`title\` text NOT NULL,
  \`description\` text NOT NULL,
  FOREIGN KEY (\`_parent_id\`) REFERENCES \`packaging_page_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`),
  )

  const indexes = [
    ['packaging_page_settings_features_items_order_idx', 'packaging_page_settings_features_items', '_order'],
    ['packaging_page_settings_features_items_parent_id_idx', 'packaging_page_settings_features_items', '_parent_id'],
    ['packaging_page_settings_process_steps_order_idx', 'packaging_page_settings_process_steps', '_order'],
    ['packaging_page_settings_process_steps_parent_id_idx', 'packaging_page_settings_process_steps', '_parent_id'],
  ] as const

  for (const [name, table, column] of indexes) {
    await db.run(
      sql.raw(`CREATE INDEX IF NOT EXISTS \`${name}\` ON \`${table}\` (\`${column}\`);`),
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql.raw('DROP TABLE IF EXISTS `packaging_page_settings_process_steps`;'))
  await db.run(sql.raw('DROP TABLE IF EXISTS `packaging_page_settings_features_items`;'))
  await db.run(sql.raw('DROP TABLE IF EXISTS `packaging_page_settings`;'))
}
