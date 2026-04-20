import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR #66 feat(about) — AboutPageSettings.ourVision + AboutPageSettings.legacyGallery
 *
 * 加兩個 group 到 about_page_settings global：
 *   ourVision：      enabled / subtitle / title / logo_id / logo_background_class / content
 *   legacyGallery：  enabled / subtitle / title / description + images[] (array 子表)
 *
 * 對照 src/globals/AboutPageSettings.ts 第 94-166（ourVision 區）、227-289（legacyGallery 區）。
 *
 * 冪等 pattern 承襲 20260417_100000_add_stored_value_balance.ts（PRAGMA / sqlite_master 判斷）。
 *   - dev 已 pushDevSchema 過的 DB → 所有 columnExists/tableExists 回 true → skip，不 duplicate
 *   - prod 第一次跑 → 正常新增
 */

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
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
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
  // ── ourVision group ──（6 個欄位）
  if (!(await columnExists(db, 'about_page_settings', 'our_vision_enabled'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`our_vision_enabled\` integer DEFAULT true;`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'our_vision_subtitle'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`our_vision_subtitle\` text DEFAULT 'Our Vision';`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'our_vision_title'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`our_vision_title\` text DEFAULT '品牌願景';`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'our_vision_logo_id'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`our_vision_logo_id\` integer REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null;`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'our_vision_logo_background_class'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`our_vision_logo_background_class\` text DEFAULT 'bg-[#1a1a1a]';`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'our_vision_content'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`our_vision_content\` text;`,
    )
  }

  // ── legacyGallery group ──（4 個 scalar 欄位 + 1 個 array 子表）
  if (!(await columnExists(db, 'about_page_settings', 'legacy_gallery_enabled'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`legacy_gallery_enabled\` integer DEFAULT true;`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'legacy_gallery_subtitle'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`legacy_gallery_subtitle\` text DEFAULT 'Gallery';`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'legacy_gallery_title'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`legacy_gallery_title\` text DEFAULT '品牌相簿';`,
    )
  }
  if (!(await columnExists(db, 'about_page_settings', 'legacy_gallery_description'))) {
    await db.run(
      sql`ALTER TABLE \`about_page_settings\` ADD COLUMN \`legacy_gallery_description\` text DEFAULT '品牌歷年精選照片，記錄 CKMU 每一段旅程。';`,
    )
  }

  // ── legacyGallery.images[] array 子表（pattern 同 about_page_settings_brand_values / contact_cta_buttons）──
  if (!(await tableExists(db, 'about_page_settings_legacy_gallery_images'))) {
    await db.run(sql`CREATE TABLE \`about_page_settings_legacy_gallery_images\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`src\` text NOT NULL,
      \`alt\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`about_page_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
  }
  if (!(await indexExists(db, 'about_page_settings_legacy_gallery_images_order_idx'))) {
    await db.run(
      sql`CREATE INDEX \`about_page_settings_legacy_gallery_images_order_idx\` ON \`about_page_settings_legacy_gallery_images\` (\`_order\`);`,
    )
  }
  if (!(await indexExists(db, 'about_page_settings_legacy_gallery_images_parent_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`about_page_settings_legacy_gallery_images_parent_id_idx\` ON \`about_page_settings_legacy_gallery_images\` (\`_parent_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // array 子表先刪（外鍵依賴 about_page_settings）
  if (await tableExists(db, 'about_page_settings_legacy_gallery_images')) {
    await db.run(sql`DROP TABLE \`about_page_settings_legacy_gallery_images\`;`)
  }

  // legacyGallery scalar 欄位
  for (const col of [
    'legacy_gallery_description',
    'legacy_gallery_title',
    'legacy_gallery_subtitle',
    'legacy_gallery_enabled',
  ]) {
    if (await columnExists(db, 'about_page_settings', col)) {
      await db.run(sql.raw(`ALTER TABLE \`about_page_settings\` DROP COLUMN \`${col}\`;`))
    }
  }

  // ourVision 欄位
  for (const col of [
    'our_vision_content',
    'our_vision_logo_background_class',
    'our_vision_logo_id',
    'our_vision_title',
    'our_vision_subtitle',
    'our_vision_enabled',
  ]) {
    if (await columnExists(db, 'about_page_settings', col)) {
      await db.run(sql.raw(`ALTER TABLE \`about_page_settings\` DROP COLUMN \`${col}\`;`))
    }
  }
}
