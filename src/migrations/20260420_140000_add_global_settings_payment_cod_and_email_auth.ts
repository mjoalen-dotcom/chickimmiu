import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * GlobalSettings — payment.codDefaultFee/codMaxAmount + emailAuth.requireEmailVerification
 *   3 個欄位先前在 src/globals/GlobalSettings.ts 直接加，但漏寫對應 migration，
 *   prod 跑 select 時噴 `no such column: payment_cod_default_fee` 導致整個
 *   全站設定後台 not-found。這支補回 schema gap。
 *
 * 冪等：PRAGMA table_info pattern，承襲 20260417_100000_add_stored_value_balance.ts。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'global_settings', 'payment_cod_default_fee'))) {
    await db.run(
      sql`ALTER TABLE \`global_settings\` ADD COLUMN \`payment_cod_default_fee\` numeric DEFAULT 30;`,
    )
  }
  if (!(await columnExists(db, 'global_settings', 'payment_cod_max_amount'))) {
    await db.run(
      sql`ALTER TABLE \`global_settings\` ADD COLUMN \`payment_cod_max_amount\` numeric DEFAULT 20000;`,
    )
  }
  if (!(await columnExists(db, 'global_settings', 'email_auth_require_email_verification'))) {
    await db.run(
      sql`ALTER TABLE \`global_settings\` ADD COLUMN \`email_auth_require_email_verification\` integer DEFAULT 0;`,
    )
  }
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // SQLite pre-3.35 DROP COLUMN 要 rebuild 整張表，代價過高；保留欄位無害
}
