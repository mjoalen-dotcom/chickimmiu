import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase G — APP 下載頁設定
 *
 * 新欄位（global_settings）：
 *   - app_links_enabled                   integer (boolean)
 *   - app_links_ios_url                   text
 *   - app_links_android_url               text
 *   - app_links_apk_url                   text
 *   - app_links_tagline                   text
 *   - app_links_subtagline                text
 *   - app_links_qr_code_image_id          integer (FK media)
 *   - app_links_coming_soon_note          text
 *
 * 新表（array sub-table）：
 *   - global_settings_app_links_features  (array `appLinks.features`)
 *
 * 冪等：PRAGMA + sqlite_master pattern
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
  // ── global_settings 8 個攤平 column ──
  const cols: Array<{ name: string; def: string }> = [
    { name: 'app_links_enabled', def: 'integer DEFAULT 1' },
    { name: 'app_links_ios_url', def: "text DEFAULT 'https://apps.apple.com/us/app/ckmu-%E9%9F%93%E5%9C%8B%E6%9C%8D%E9%A3%BE/id6740013272'" },
    { name: 'app_links_android_url', def: 'text' },
    { name: 'app_links_apk_url', def: 'text' },
    { name: 'app_links_tagline', def: "text DEFAULT '下載 CKMU APP，韓國服飾隨身逛'" },
    { name: 'app_links_subtagline', def: 'text' },
    { name: 'app_links_qr_code_image_id', def: 'integer' },
    { name: 'app_links_coming_soon_note', def: "text DEFAULT '即將上線'" },
  ]
  for (const c of cols) {
    if (!(await columnExists(db, 'global_settings', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`global_settings\` ADD COLUMN \`${c.name}\` ${c.def};`))
    }
  }

  // ── global_settings_app_links_features 子表（array）──
  if (!(await tableExists(db, 'global_settings_app_links_features'))) {
    await db.run(sql`CREATE TABLE \`global_settings_app_links_features\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`icon\` text DEFAULT '✨',
      \`title\` text,
      \`description\` text,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`global_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`global_settings_app_links_features_order_idx\` ON \`global_settings_app_links_features\` (\`_order\`);`)
    await db.run(sql`CREATE INDEX \`global_settings_app_links_features_parent_id_idx\` ON \`global_settings_app_links_features\` (\`_parent_id\`);`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'global_settings_app_links_features')) {
    await db.run(sql`DROP TABLE \`global_settings_app_links_features\`;`)
  }
  // SQLite DROP COLUMN cost 高，保留 dangling 欄位無害
}
