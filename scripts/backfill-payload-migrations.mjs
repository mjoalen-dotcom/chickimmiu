/**
 * One-shot: backfill `payload_migrations` rows for migrations whose schema
 * was applied via dev-push or direct @libsql/client (so Payload's migrate
 * runner never wrote a row for them).
 *
 * Why this matters:
 *   When `pnpm payload migrate` runs in prod, Payload reads `payload_migrations`
 *   to decide what's pending. Without these rows, prod will re-run both
 *   migrations. Both are now idempotent (PRAGMA-guarded ADD COLUMN), so
 *   re-running is *safe* — but it leaves a confusing audit trail:
 *   payload_migrations claims they ran "today on prod" when they were
 *   actually applied weeks earlier in dev.
 *
 *   This script makes the table reflect reality.
 *
 * Safety:
 *   - Idempotent: re-runs only INSERT rows that don't yet exist.
 *   - Schema-checked: before inserting, verifies the columns the migration
 *     SAYS it added are actually present in the DB. If they're missing, we
 *     refuse to insert (would be lying about state) and the operator should
 *     run the migration normally instead.
 *   - Read/write only `payload_migrations` — no schema changes.
 *
 * Usage:
 *   node scripts/backfill-payload-migrations.mjs
 *
 * Environment:
 *   Targets `file:./data/chickimmiu.db` (local SQLite). Adjust `DB_URL`
 *   below if you ever need to point this at a different file.
 */
import { createClient } from '@libsql/client'

const DB_URL = 'file:./data/chickimmiu.db'

/**
 * Each entry says: migration `name` is considered applied iff every
 * (table, column) tuple in `requiredColumns` exists. If the entry's columns
 * are NOT all present, we will NOT insert a row — the operator should run
 * the actual migration to apply them.
 */
const MIGRATIONS_TO_BACKFILL = [
  {
    name: '20260416_140000_add_gender_and_male_tier_name',
    batch: 2,
    requiredColumns: [
      ['users', 'gender'],
      ['membership_tiers', 'front_name_male'],
    ],
  },
  {
    name: '20260416_193835_add_daily_checkin_streak',
    batch: 2,
    requiredColumns: [
      ['users', 'total_check_ins'],
      ['users', 'consecutive_check_ins'],
      ['users', 'last_check_in_date'],
    ],
  },
]

const client = createClient({ url: DB_URL })

async function columnExists(table, column) {
  const res = await client.execute({
    sql: `PRAGMA table_info('${table}');`,
    args: [],
  })
  return res.rows.some((r) => r.name === column)
}

async function alreadyRecorded(name) {
  const res = await client.execute({
    sql: 'SELECT id FROM payload_migrations WHERE name = ?',
    args: [name],
  })
  return res.rows.length > 0 ? res.rows[0].id : null
}

let inserted = 0
let skippedAlreadyRecorded = 0
let refusedSchemaMissing = 0

for (const m of MIGRATIONS_TO_BACKFILL) {
  const existingId = await alreadyRecorded(m.name)
  if (existingId !== null) {
    console.log(`SKIP   ${m.name}  (already recorded as id=${existingId})`)
    skippedAlreadyRecorded++
    continue
  }

  // Verify every claimed column is actually present before lying about state.
  const missing = []
  for (const [table, col] of m.requiredColumns) {
    if (!(await columnExists(table, col))) missing.push(`${table}.${col}`)
  }
  if (missing.length > 0) {
    console.error(
      `REFUSE ${m.name}  (missing columns: ${missing.join(', ')}) — ` +
        `run the actual migration instead of backfilling`,
    )
    refusedSchemaMissing++
    continue
  }

  await client.execute({
    sql: 'INSERT INTO payload_migrations (name, batch) VALUES (?, ?)',
    args: [m.name, m.batch],
  })
  console.log(`INSERT ${m.name}  (batch=${m.batch})`)
  inserted++
}

console.log(
  `\nDone. inserted=${inserted}  already-recorded=${skippedAlreadyRecorded}  refused=${refusedSchemaMissing}`,
)

if (refusedSchemaMissing > 0) {
  process.exit(1)
}
