import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 5.7 commerce-core — carts table.
 *   Per-user server-side cart (one row per user). Merged from localStorage
 *   on login; synced on mutation while logged in. See src/collections/Carts.ts.
 *
 * Schema follows Payload SQLite conventions (same shape auto-push produces):
 *   id integer PK, user_id integer FK (users.id), items text (JSON), timestamps.
 *
 * Idempotent: checks sqlite_master so a dev DB that already got the table via
 *   `push: true` does not fail on prod migrate.
 */

async function tableExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'carts')) return

  await db.run(sql`
    CREATE TABLE \`carts\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`user_id\` integer NOT NULL REFERENCES \`users\`(\`id\`) ON UPDATE NO ACTION ON DELETE SET NULL,
      \`items\` text DEFAULT '[]',
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`carts_user_idx\` ON \`carts\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`carts_updated_at_idx\` ON \`carts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`carts_created_at_idx\` ON \`carts\` (\`created_at\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'carts')) {
    await db.run(sql`DROP TABLE \`carts\`;`)
  }
}
