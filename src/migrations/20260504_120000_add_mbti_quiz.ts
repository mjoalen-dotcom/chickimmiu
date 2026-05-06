import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * MBTI 個性穿搭測驗 — 第 15 款遊戲
 *
 * 新增 columns:
 *   - users.mbti_profile_mbti_type (text)
 *   - users.mbti_profile_mbti_taken_at (text — Payload 把 date 存 ISO 字串)
 *   - users.mbti_profile_mbti_scores (text — Payload 把 json 存 stringified JSON)
 *
 * 新增 tables:
 *   - products_personality_types (hasMany select 子表，pattern 同 users_notification_preferences_channels)
 *
 * 不需動 schema 的：
 *   - mini-game-records.game_type (TEXT，加 'mbti_quiz' enum 是 Payload 應用層驗證)
 *   - game-settings.* (Payload globals 自動處理 schema 變動)
 *
 * 冪等：sqlite_master / PRAGMA pattern (承襲 20260428_074640_add_customer_service_v1.ts)
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
  // ─── users.mbti_profile_* 3 個欄位 (group field 攤平) ──────────────────
  const userCols: Array<{ name: string; def: string }> = [
    { name: 'mbti_profile_mbti_type', def: 'text' },
    { name: 'mbti_profile_mbti_taken_at', def: 'text' },
    { name: 'mbti_profile_mbti_scores', def: 'text' },
  ]
  for (const col of userCols) {
    if (!(await columnExists(db, 'users', col.name))) {
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${col.name}\` ${col.def};`))
    }
  }

  // ─── products_personality_types（hasMany select 子表）──────────────────
  if (!(await tableExists(db, 'products_personality_types'))) {
    await db.run(sql`CREATE TABLE \`products_personality_types\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(sql`CREATE INDEX \`products_personality_types_order_idx\` ON \`products_personality_types\` (\`order\`);`)
    await db.run(sql`CREATE INDEX \`products_personality_types_parent_idx\` ON \`products_personality_types\` (\`parent_id\`);`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // DROP 新表；不 DROP COLUMN（SQLite 成本高，留著為 dangling 無害）
  if (await tableExists(db, 'products_personality_types')) {
    await db.run(sql.raw('DROP TABLE `products_personality_types`;'))
  }
}
