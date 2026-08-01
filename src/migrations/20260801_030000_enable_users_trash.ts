import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rows(db: any, query: string): Promise<Array<Record<string, unknown>>> {
  const result = await db.run(sql.raw(query))
  return (result?.rows ?? result ?? []) as Array<Record<string, unknown>>
}

/**
 * Payload trash support for users.
 *
 * Hard-deleting a member can violate required historical relationships (for
 * example member_segments.user_id is NOT NULL while its FK is ON DELETE SET
 * NULL). A nullable deleted_at marker hides the member from normal queries and
 * authentication without breaking order, CRM, points, or audit history.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = await rows(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users';",
  )
  if (tables.length === 0) return

  const columns = await rows(db, "PRAGMA table_info('users');")
  if (!columns.some((column) => column.name === 'deleted_at')) {
    await db.run(sql`ALTER TABLE \`users\` ADD COLUMN \`deleted_at\` text;`)
  }

  const indexes = await rows(
    db,
    "SELECT name FROM sqlite_master WHERE type='index' AND name='users_deleted_at_idx';",
  )
  if (indexes.length === 0) {
    await db.run(sql`CREATE INDEX \`users_deleted_at_idx\` ON \`users\` (\`deleted_at\`);`)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep the backwards-compatible nullable column. Dropping it would rewrite
  // the users table and could discard the only marker for archived accounts.
}
