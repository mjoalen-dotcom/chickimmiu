import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Phase 3 寶物箱兌換系統 PR-C — orders_gifts 子表
 *
 * Payload array field → SQLite child table with `_order`, `_parent_id`
 * (FK orders.id), `id TEXT PK`, plus each array field as a flat column.
 *
 * 對照 `src/collections/Orders.ts` 的 `gifts` array：
 *   - reward_id (FK user-rewards.id)
 *   - reward_type (snapshot)
 *   - display_name (snapshot)
 *   - amount (snapshot)
 *
 * 冪等：sqlite_master / PRAGMA 判定表/欄位是否存在。
 * Pattern 承襲 20260419_200000_add_invoice_profiles.ts。
 */

const TABLE = 'orders_gifts'

const COLUMNS: Array<{ name: string; type: string }> = [
  { name: 'reward_id', type: 'integer' },
  { name: 'reward_type', type: 'text' },
  { name: 'display_name', type: 'text' },
  { name: 'amount', type: 'numeric' },
]

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, index: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${index}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await tableExists(db, TABLE))) {
    await db.run(sql`CREATE TABLE \`orders_gifts\` (
      \`_order\` integer NOT NULL,
      \`_parent_id\` integer NOT NULL,
      \`id\` text PRIMARY KEY NOT NULL,
      \`reward_id\` integer,
      \`reward_type\` text,
      \`display_name\` text,
      \`amount\` numeric,
      FOREIGN KEY (\`_parent_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`reward_id\`) REFERENCES \`user_rewards\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(
      sql`CREATE INDEX \`orders_gifts_order_idx\` ON \`orders_gifts\` (\`_order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`orders_gifts_parent_id_idx\` ON \`orders_gifts\` (\`_parent_id\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`orders_gifts_reward_idx\` ON \`orders_gifts\` (\`reward_id\`);`,
    )
  } else {
    for (const col of COLUMNS) {
      if (!(await columnExists(db, TABLE, col.name))) {
        await db.run(sql.raw(`ALTER TABLE \`${TABLE}\` ADD COLUMN \`${col.name}\` ${col.type};`))
      }
    }
    if (!(await indexExists(db, 'orders_gifts_reward_idx'))) {
      await db.run(
        sql`CREATE INDEX \`orders_gifts_reward_idx\` ON \`orders_gifts\` (\`reward_id\`);`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, TABLE)) {
    await db.run(sql`DROP TABLE \`orders_gifts\`;`)
  }
}
