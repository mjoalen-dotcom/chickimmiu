import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

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
  if (!(await columnExists(db, 'users', 'shopline_customer_id'))) {
    await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`shopline_customer_id\` text;`))
  }
  if (!(await columnExists(db, 'users', 'signup_source'))) {
    await db.run(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`signup_source\` text;`))
  }

  // Index for fast upsert lookups
  await db.run(sql.raw(
    `CREATE INDEX IF NOT EXISTS \`idx_users_shopline_customer_id\` ON \`users\` (\`shopline_customer_id\`);`,
  ))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql.raw(`DROP INDEX IF EXISTS \`idx_users_shopline_customer_id\`;`))
  if (await columnExists(db, 'users', 'shopline_customer_id')) {
    await db.run(sql.raw(`ALTER TABLE \`users\` DROP COLUMN \`shopline_customer_id\`;`))
  }
  if (await columnExists(db, 'users', 'signup_source')) {
    await db.run(sql.raw(`ALTER TABLE \`users\` DROP COLUMN \`signup_source\`;`))
  }
}
