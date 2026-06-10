import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Add object_position column to pages_blocks_magazine_cover
 *
 * 動機：含人臉的圖在覆蓋全寬 layout 下，admin 要能控制裁切焦點
 * （避免 object-cover center 把臉裁掉）。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'pages_blocks_magazine_cover', 'object_position'))) {
    await db.run(
      sql`ALTER TABLE \`pages_blocks_magazine_cover\` ADD \`object_position\` text DEFAULT 'center';`,
    )
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite drop column 成本高，留無害
}
