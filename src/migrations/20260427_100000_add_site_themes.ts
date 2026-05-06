import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * SiteThemes — 全站主題 preset collection（春/夏/秋/冬/活動/常駐）
 * + HomepageSettings.heroLayoutOverride 欄位
 *
 * 冪等 pattern 承襲 20260418_220000_add_login_attempts.ts。
 * dev pushDevSchema 過的 DB → tableExists/columnExists 全 true → skip。
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
  // ── site_themes 主表 ──
  if (!(await tableExists(db, 'site_themes'))) {
    await db.run(sql`CREATE TABLE \`site_themes\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text,
      \`season\` text DEFAULT 'default',
      \`is_active\` integer DEFAULT false,
      \`palette_primary\` text DEFAULT '#C19A5B',
      \`palette_accent\` text DEFAULT '#EFBBAA',
      \`palette_surface\` text DEFAULT '#F9F5EC',
      \`palette_ink\` text DEFAULT '#2C2C2C',
      \`palette_on_primary\` text DEFAULT '#FDFBF7',
      \`palette_on_accent\` text DEFAULT '#2C2C2C',
      \`palette_hero_overlay_from\` text DEFAULT '#000000',
      \`palette_hero_overlay_to\` text DEFAULT '#000000',
      \`palette_hero_overlay_opacity\` numeric DEFAULT 0.45,
      \`serif_font\` text DEFAULT 'noto-serif-tc',
      \`sans_font\` text DEFAULT 'noto-sans-tc',
      \`hero_layout\` text DEFAULT 'split',
      \`hero_min_height_desktop\` numeric DEFAULT 85,
      \`hero_min_height_mobile\` numeric DEFAULT 60,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(
      sql`CREATE INDEX \`site_themes_is_active_idx\` ON \`site_themes\` (\`is_active\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`site_themes_updated_at_idx\` ON \`site_themes\` (\`updated_at\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`site_themes_created_at_idx\` ON \`site_themes\` (\`created_at\`);`,
    )
  }

  // ── payload_locked_documents_rels FK ──
  if (await tableExists(db, 'payload_locked_documents_rels')) {
    if (!(await columnExists(db, 'payload_locked_documents_rels', 'site_themes_id'))) {
      await db.run(
        sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`site_themes_id\` integer REFERENCES site_themes(id);`,
      )
      await db.run(
        sql`CREATE INDEX \`payload_locked_documents_rels_site_themes_id_idx\` ON \`payload_locked_documents_rels\` (\`site_themes_id\`);`,
      )
    }
  }

  // ── homepage_settings.hero_layout_override ──
  if (await tableExists(db, 'homepage_settings')) {
    if (!(await columnExists(db, 'homepage_settings', 'hero_layout_override'))) {
      await db.run(
        sql`ALTER TABLE \`homepage_settings\` ADD COLUMN \`hero_layout_override\` text DEFAULT 'inherit';`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'site_themes')) {
    await db.run(sql`DROP TABLE \`site_themes\`;`)
  }
  // homepage_settings.hero_layout_override 留著（SQLite DROP COLUMN 成本高）；無害。
  // payload_locked_documents_rels.site_themes_id 同理留著。
}
