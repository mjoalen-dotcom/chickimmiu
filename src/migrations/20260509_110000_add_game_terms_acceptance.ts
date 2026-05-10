import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase C — 遊戲規範同意書
 *
 * 新欄位（users）：
 *   - game_terms_acceptance_accepted_at         text (ISO date)
 *   - game_terms_acceptance_accepted_version    text
 *   - game_terms_acceptance_adult_confirmed     integer (boolean)
 *   - game_terms_acceptance_acceptance_ip       text
 *
 * 冪等：PRAGMA pattern；同 20260417_100000_add_stored_value_balance.ts
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
  const cols: Array<{ name: string; def: string }> = [
    { name: 'game_terms_acceptance_accepted_at', def: 'text' },
    { name: 'game_terms_acceptance_accepted_version', def: 'text' },
    { name: 'game_terms_acceptance_adult_confirmed', def: 'integer DEFAULT 0' },
    { name: 'game_terms_acceptance_acceptance_ip', def: 'text' },
  ]
  for (const c of cols) {
    if (!(await columnExists(db, 'users', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${c.name}\` ${c.def};`))
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite DROP COLUMN 成本高且少用；保留 dangling column 無害
}
