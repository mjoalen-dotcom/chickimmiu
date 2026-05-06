import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * MBTI64 — 16 × 4 場合擴充（PR-Y）
 *
 * 新增 columns（users.mbtiProfile group）:
 *   - users.mbti_profile_primary_occasion (text — urban/vacation/party/cozy)
 *   - users.mbti_profile_occasion_scores (text — JSON 字串，4 場合票數)
 *
 * 用法：
 *   1. 玩家做完 28 題基本 MBTI + 4 題 lifestyle 場合題
 *   2. computeMBTI64() 推算 (mbtiType, primaryOccasion) tuple
 *   3. 寫進 users.mbtiProfile.{primaryOccasion, occasionScores}
 *   4. /account/personality 頁面以此推 64 sub-personality + 商品推薦
 *
 * 不需動 schema 的：
 *   - users.mbti_profile_mbti_type / mbti_taken_at / mbti_scores 已在
 *     20260504_120000_add_mbti_quiz 加好
 *
 * 冪等：PRAGMA pattern (承襲既有 migration)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'users', 'mbti_profile_primary_occasion'))) {
    await db.run(
      sql`ALTER TABLE \`users\` ADD COLUMN \`mbti_profile_primary_occasion\` text;`,
    )
  }
  if (!(await columnExists(db, 'users', 'mbti_profile_occasion_scores'))) {
    await db.run(
      sql`ALTER TABLE \`users\` ADD COLUMN \`mbti_profile_occasion_scores\` text;`,
    )
  }

  // 補：原 20260504_120000_add_mbti_quiz 缺漏的 game_settings.mbti_style_* columns
  //   原 commit (7cd4ce5) 假設「Payload globals 自動處理 schema 變動」但 push=false
  //   所以實際上 prod / 新 dev DB 沒有這些欄位 → mbti-style 遊戲頁面 500
  // 在本 migration 一併補齊，冪等 column-exists 檢查。
  const gameSettingsColumns: Array<{ name: string; def: string }> = [
    { name: 'game_list_mbti_style_enabled', def: 'integer DEFAULT false' },
    { name: 'mbti_style_points_cost_per_play', def: 'numeric DEFAULT 50' },
    { name: 'mbti_style_daily_limit', def: 'numeric DEFAULT 1' },
    { name: 'mbti_style_allow_retake', def: 'integer DEFAULT false' },
    { name: 'mbti_style_share_bonus_points', def: 'numeric DEFAULT 5' },
    { name: 'mbti_style_display_name', def: 'text' },
    { name: 'mbti_style_description', def: 'text' },
    { name: 'mbti_style_icon', def: 'text' },
  ]
  for (const col of gameSettingsColumns) {
    if (!(await columnExists(db, 'game_settings', col.name))) {
      await db.run(
        sql.raw(`ALTER TABLE \`game_settings\` ADD COLUMN \`${col.name}\` ${col.def};`),
      )
    }
  }

  // 補：原 20260504_100000_add_total_sold_and_korean_celebrity 也漏的
  // products.korean_celebrity_ref_* 群組欄位
  //   migration 註解寫「collectionTags 不需 schema migration」是對的（subTable 走 _values 表）
  //   但忽略了同 commit 加的 koreanCelebrityRef group field，那個是 group=展平到欄位
  //   → prod 沒這些欄位 → /products/[slug] PDP 任何 personalityTypes 查詢都炸
  // 一併補齊，冪等。
  const productCols: Array<{ name: string; def: string }> = [
    { name: 'korean_celebrity_ref_celebrity_name', def: 'text' },
    { name: 'korean_celebrity_ref_drama_or_show', def: 'text' },
    { name: 'korean_celebrity_ref_source_brand', def: 'text' },
  ]
  for (const col of productCols) {
    if (!(await columnExists(db, 'products', col.name))) {
      await db.run(
        sql.raw(`ALTER TABLE \`products\` ADD COLUMN \`${col.name}\` ${col.def};`),
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const col of ['mbti_profile_primary_occasion', 'mbti_profile_occasion_scores']) {
    if (await columnExists(db, 'users', col)) {
      await db.run(sql.raw(`ALTER TABLE \`users\` DROP COLUMN \`${col}\`;`))
    }
  }
}
