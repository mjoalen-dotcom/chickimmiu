import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Add `users_invoice_profiles` array sub-table for multi-company invoice records.
 *
 * Pattern: Payload arrays in SQLite create a child table with `_order INTEGER`,
 * `_parent_id` (FK → users.id), `id TEXT PK`, plus the array's flat fields.
 *
 * Mirrors the existing `users_addresses` shape (snapshot 20260413_025234.json).
 *
 * 冪等：先 sqlite_master 查 table 存在；建後再 PRAGMA 補欄位（防 schema 漂移）。
 */

const TABLE = 'users_invoice_profiles'

const COLUMNS: Array<{ name: string; type: string }> = [
  { name: 'profile_name', type: 'text' },
  { name: 'invoice_title', type: 'text' },
  { name: 'tax_id', type: 'text' },
  { name: 'invoice_contact_name', type: 'text' },
  { name: 'invoice_phone', type: 'text' },
  { name: 'invoice_address', type: 'text' },
  { name: 'note', type: 'text' },
]

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
  if (!(await tableExists(db, TABLE))) {
    const colDefs = COLUMNS.map((c) => `\`${c.name}\` ${c.type}`).join(',\n  ')
    await db.run(
      sql.raw(`CREATE TABLE \`${TABLE}\` (
  \`_order\` integer NOT NULL,
  \`_parent_id\` integer NOT NULL,
  \`id\` text PRIMARY KEY NOT NULL,
  ${colDefs},
  FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`),
    )
    await db.run(
      sql.raw(`CREATE INDEX \`${TABLE}_order_idx\` ON \`${TABLE}\` (\`_order\`);`),
    )
    await db.run(
      sql.raw(`CREATE INDEX \`${TABLE}_parent_id_idx\` ON \`${TABLE}\` (\`_parent_id\`);`),
    )
  } else {
    // 補欄位（schema 漂移時）
    for (const col of COLUMNS) {
      if (!(await columnExists(db, TABLE, col.name))) {
        await db.run(sql.raw(`ALTER TABLE \`${TABLE}\` ADD COLUMN \`${col.name}\` ${col.type};`))
      }
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, TABLE)) {
    await db.run(sql.raw(`DROP TABLE \`${TABLE}\`;`))
  }
}
