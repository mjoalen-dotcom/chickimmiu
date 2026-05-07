import { sql } from '@payloadcms/db-sqlite'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS products_alias_slugs (
      _order    INTEGER NOT NULL,
      _parent_id INTEGER NOT NULL,
      id        TEXT    PRIMARY KEY,
      slug      TEXT    NOT NULL,
      source    TEXT    DEFAULT 'manual',
      FOREIGN KEY (_parent_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS products_alias_slugs_parent_id_idx
      ON products_alias_slugs (_parent_id);
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS products_alias_slugs_slug_idx
      ON products_alias_slugs (slug);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS products_alias_slugs;`)
}
