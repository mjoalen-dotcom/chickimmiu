import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * 補 PR #167 (d3f127d) 缺的 schema migration
 *
 * PR #167 在 LoyaltySettings.ts 加了 signupReward group（4 欄位）但沒寫對應
 * migration。prod build 用新 collection schema 產 SELECT 把 signup_reward_*
 * 列入 → SQLite 回 "no such column" → payload.findGlobal('loyalty-settings')
 * reject → /account/points 等 SSR 頁面 React error #419 全炸。
 *
 * 對應 Collection 欄位：LoyaltySettings.ts:46-56
 *   - signupReward.enabled       (checkbox, default true)
 *   - signupReward.points        (number, default 100)
 *   - signupReward.shoppingCredit(number, default 0)
 *   - signupReward.description   (text, default '新會員註冊禮')
 *
 * 冪等：columnExists 守門，prod 已 hotfix ALTER 過也不會 duplicate。
 * Pattern 承襲 20260417_100000_add_stored_value_balance.ts。
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

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'loyalty_settings', 'signup_reward_enabled'))) {
    await db.run(
      sql`ALTER TABLE \`loyalty_settings\` ADD COLUMN \`signup_reward_enabled\` integer DEFAULT true;`,
    )
  }
  if (!(await columnExists(db, 'loyalty_settings', 'signup_reward_points'))) {
    await db.run(
      sql`ALTER TABLE \`loyalty_settings\` ADD COLUMN \`signup_reward_points\` numeric DEFAULT 100;`,
    )
  }
  if (!(await columnExists(db, 'loyalty_settings', 'signup_reward_shopping_credit'))) {
    await db.run(
      sql`ALTER TABLE \`loyalty_settings\` ADD COLUMN \`signup_reward_shopping_credit\` numeric DEFAULT 0;`,
    )
  }
  if (!(await columnExists(db, 'loyalty_settings', 'signup_reward_description'))) {
    await db.run(
      sql`ALTER TABLE \`loyalty_settings\` ADD COLUMN \`signup_reward_description\` text DEFAULT '新會員註冊禮';`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'loyalty_settings', 'signup_reward_description')) {
    await db.run(sql`ALTER TABLE \`loyalty_settings\` DROP COLUMN \`signup_reward_description\`;`)
  }
  if (await columnExists(db, 'loyalty_settings', 'signup_reward_shopping_credit')) {
    await db.run(sql`ALTER TABLE \`loyalty_settings\` DROP COLUMN \`signup_reward_shopping_credit\`;`)
  }
  if (await columnExists(db, 'loyalty_settings', 'signup_reward_points')) {
    await db.run(sql`ALTER TABLE \`loyalty_settings\` DROP COLUMN \`signup_reward_points\`;`)
  }
  if (await columnExists(db, 'loyalty_settings', 'signup_reward_enabled')) {
    await db.run(sql`ALTER TABLE \`loyalty_settings\` DROP COLUMN \`signup_reward_enabled\`;`)
  }
}
