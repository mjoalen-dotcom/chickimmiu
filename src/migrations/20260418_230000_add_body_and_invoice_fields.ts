import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Add body measurements + invoice info columns to users table.
 *   - body_profile_foot_length / bust / waist / hips (AI 尺寸推薦)
 *   - invoice_info_invoice_title / tax_id / invoice_address / invoice_contact_name / invoice_phone
 *     (顧客自存三聯式發票抬頭，結帳頁可一鍵帶入)
 *
 * 冪等：沿用 20260417_100000_add_stored_value_balance.ts 的 PRAGMA table_info 判斷。
 * 乾淨 DB、dev push schema 後的 DB、prod 第一次 migrate 都不會 duplicate column 報錯。
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

const NUMERIC_COLUMNS = [
  'body_profile_foot_length',
  'body_profile_bust',
  'body_profile_waist',
  'body_profile_hips',
] as const

const TEXT_COLUMNS = [
  'invoice_info_invoice_title',
  'invoice_info_tax_id',
  'invoice_info_invoice_address',
  'invoice_info_invoice_contact_name',
  'invoice_info_invoice_phone',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const col of NUMERIC_COLUMNS) {
    if (!(await columnExists(db, 'users', col))) {
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${col}\` numeric;`))
    }
  }
  for (const col of TEXT_COLUMNS) {
    if (!(await columnExists(db, 'users', col))) {
      await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${col}\` text;`))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const col of [...NUMERIC_COLUMNS, ...TEXT_COLUMNS]) {
    if (await columnExists(db, 'users', col)) {
      await db.run(sql.raw(`ALTER TABLE \`users\` DROP COLUMN \`${col}\`;`))
    }
  }
}
