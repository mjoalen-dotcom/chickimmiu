/**
 * Applies 20260415_112142_add_size_charts UP statements directly via libsql,
 * bypassing Payload's interactive dev-mode confirmation prompt.
 *
 * All statements are non-destructive (CREATE TABLE + ALTER TABLE ADD COLUMN).
 * Safe to run against a dev-push database.
 */
import { createClient } from '@libsql/client'

const client = createClient({ url: 'file:./data/chickimmiu.db' })

const statements = [
  `CREATE TABLE \`size_charts_measurements\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`key\` text NOT NULL,
    \`label\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`size_charts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE INDEX \`size_charts_measurements_order_idx\` ON \`size_charts_measurements\` (\`_order\`)`,
  `CREATE INDEX \`size_charts_measurements_parent_id_idx\` ON \`size_charts_measurements\` (\`_parent_id\`)`,
  `CREATE TABLE \`size_charts_rows_values\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`key\` text NOT NULL,
    \`value\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`size_charts_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE INDEX \`size_charts_rows_values_order_idx\` ON \`size_charts_rows_values\` (\`_order\`)`,
  `CREATE INDEX \`size_charts_rows_values_parent_id_idx\` ON \`size_charts_rows_values\` (\`_parent_id\`)`,
  `CREATE TABLE \`size_charts_rows\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`size\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`size_charts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE INDEX \`size_charts_rows_order_idx\` ON \`size_charts_rows\` (\`_order\`)`,
  `CREATE INDEX \`size_charts_rows_parent_id_idx\` ON \`size_charts_rows\` (\`_parent_id\`)`,
  `CREATE TABLE \`size_charts\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`category\` text DEFAULT 'top',
    \`unit\` text DEFAULT 'cm',
    \`note\` text,
    \`is_active\` integer DEFAULT true,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`,
  `CREATE UNIQUE INDEX \`size_charts_slug_idx\` ON \`size_charts\` (\`slug\`)`,
  `CREATE INDEX \`size_charts_updated_at_idx\` ON \`size_charts\` (\`updated_at\`)`,
  `CREATE INDEX \`size_charts_created_at_idx\` ON \`size_charts\` (\`created_at\`)`,
  `ALTER TABLE \`products_images\` ADD \`caption\` text`,
  `ALTER TABLE \`products_variants\` ADD \`color_swatch_id\` integer REFERENCES media(id)`,
  `CREATE INDEX \`products_variants_color_swatch_idx\` ON \`products_variants\` (\`color_swatch_id\`)`,
  `ALTER TABLE \`products\` ADD \`product_sku\` text`,
  `ALTER TABLE \`products\` ADD \`brand\` text DEFAULT 'CHIC KIM & MIU'`,
  `ALTER TABLE \`products\` ADD \`product_origin\` text`,
  `ALTER TABLE \`products\` ADD \`short_description\` text`,
  `ALTER TABLE \`products\` ADD \`featured_image_id\` integer REFERENCES media(id)`,
  `ALTER TABLE \`products\` ADD \`size_chart_id\` integer REFERENCES size_charts(id)`,
  `ALTER TABLE \`products\` ADD \`material\` text`,
  `ALTER TABLE \`products\` ADD \`care_instructions\` text`,
  `ALTER TABLE \`products\` ADD \`model_info_height\` text`,
  `ALTER TABLE \`products\` ADD \`model_info_weight\` text`,
  `ALTER TABLE \`products\` ADD \`model_info_wearing_size\` text`,
  `ALTER TABLE \`products\` ADD \`model_info_body_shape\` text`,
  `ALTER TABLE \`products\` ADD \`styling_tips\` text`,
  `CREATE INDEX \`products_featured_image_idx\` ON \`products\` (\`featured_image_id\`)`,
  `CREATE INDEX \`products_size_chart_idx\` ON \`products\` (\`size_chart_id\`)`,
  `ALTER TABLE \`payload_locked_documents_rels\` ADD \`size_charts_id\` integer REFERENCES size_charts(id)`,
  `CREATE INDEX \`payload_locked_documents_rels_size_charts_id_idx\` ON \`payload_locked_documents_rels\` (\`size_charts_id\`)`,
]

function isIgnorable(err) {
  const msg = String(err?.message || err)
  // Safe to ignore if the column/table/index already exists — this means the
  // statement has already been applied (partial re-run).
  return (
    msg.includes('duplicate column name') ||
    msg.includes('already exists')
  )
}

let applied = 0
let skipped = 0

for (const [idx, stmt] of statements.entries()) {
  try {
    await client.execute(stmt)
    applied++
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
    console.log(`[${idx + 1}/${statements.length}] OK  ${preview}`)
  } catch (err) {
    if (isIgnorable(err)) {
      skipped++
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
      console.log(`[${idx + 1}/${statements.length}] SKIP (already applied) ${preview}`)
    } else {
      console.error(`[${idx + 1}/${statements.length}] FAIL`, err.message)
      console.error('Statement was:\n', stmt)
      process.exit(1)
    }
  }
}

// Mark the migration as applied in payload_migrations so Payload does not
// try to re-run it.
try {
  const existing = await client.execute({
    sql: 'SELECT id FROM payload_migrations WHERE name = ?',
    args: ['20260415_112142_add_size_charts'],
  })
  if (existing.rows.length === 0) {
    await client.execute({
      sql: 'INSERT INTO payload_migrations (name, batch) VALUES (?, ?)',
      args: ['20260415_112142_add_size_charts', 1],
    })
    console.log('Recorded migration in payload_migrations')
  } else {
    console.log('Migration already recorded in payload_migrations')
  }
} catch (err) {
  console.error('Failed to record migration:', err.message)
  process.exit(1)
}

console.log(`\nDone. Applied: ${applied}, Skipped: ${skipped}`)
