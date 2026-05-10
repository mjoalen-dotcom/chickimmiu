import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Hotfix — 補齊 prize_pools FK 欄位到 Payload 內部 rels 表
 *
 * 原 migration 20260509_100000_add_prize_pools 建了 prize_pools 表 + 子表，
 * 但漏了把 `prize_pools_id` integer FK 欄加到兩張 Payload 自己用的 rels 表：
 *   - payload_locked_documents_rels
 *   - payload_preferences_rels
 *
 * Payload v3 在每個 collection 啟用後都會在這兩張表查 `<slug>_id` 欄位（locked
 * documents 機制 + preferences），缺欄位 → 任何 payload.create / find 都會觸發
 *   `SqliteError: no such column: <tx_uuid>.prize_pools_id`
 * 這條會擋住 admin upload Media（連帶把 R2 plugin 真實上傳路徑驗不了），所以
 * R2 plugin merge 後第一時間就撞到。
 *
 * Prod 已經在 2026-05-10 14:48 用裸 SQL 修過（DB 備份在
 * /var/www/chickimmiu/data/chickimmiu.db.before-prize-pools-fix.1778424524），
 * 此 migration 補進 repo 讓 dev / staging / 全新 box 也自動修。
 *
 * 冪等：PRAGMA 判斷欄位再加，已有就 skip。其他環境如果也跑過同樣裸 SQL 修補，
 * 此 migration 直接 noop 不重複加。
 */

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
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'prize_pools_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`prize_pools_id\` integer REFERENCES prize_pools(id) ON DELETE cascade;`,
    )
    await db.run(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_prize_pools_id_idx ON payload_locked_documents_rels (prize_pools_id);`,
      ),
    )
  }

  if (!(await columnExists(db, 'payload_preferences_rels', 'prize_pools_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_preferences_rels\` ADD COLUMN \`prize_pools_id\` integer REFERENCES prize_pools(id) ON DELETE cascade;`,
    )
    await db.run(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS payload_preferences_rels_prize_pools_id_idx ON payload_preferences_rels (prize_pools_id);`,
      ),
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql.raw(`DROP INDEX IF EXISTS payload_locked_documents_rels_prize_pools_id_idx;`))
  await db.run(sql.raw(`DROP INDEX IF EXISTS payload_preferences_rels_prize_pools_id_idx;`))

  if (await columnExists(db, 'payload_locked_documents_rels', 'prize_pools_id')) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`prize_pools_id\`;`,
    )
  }
  if (await columnExists(db, 'payload_preferences_rels', 'prize_pools_id')) {
    await db.run(
      sql`ALTER TABLE \`payload_preferences_rels\` DROP COLUMN \`prize_pools_id\`;`,
    )
  }
}
