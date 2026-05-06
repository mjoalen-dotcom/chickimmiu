import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-B follow-up — `utm_campaigns` 欄位 rename
 * ─────────────────────────────────────────────
 * `20260429_180000_add_utm_attribution` 依 `UTMCampaigns.ts` 中
 * 三個 `dbName: 'utm_camp_*'` 把 DB 欄位建為 `utm_camp_source` /
 * `utm_camp_medium` / `utm_camp_status`。
 *
 * 但 Payload v3 的 Drizzle adapter 對 `type: 'select'` field 不會
 * honor `dbName`，runtime schema 仍把欄位識別為 fieldName
 * (`source` / `medium` / `status`)，導致 list view SELECT 炸：
 *   SQLITE_ERROR: no such column: source
 * 結果 `/admin/collections/utm-campaigns` 進不去。
 *
 * 修法：拿掉 collection 中三個 dbName，並把 DB 欄位 rename 對齊。
 * 冪等：先檢查舊欄名存在才 rename；新欄名已存在則 skip。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

async function renameIfNeeded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  oldName: string,
  newName: string,
): Promise<void> {
  if (!(await tableExists(db, table))) return
  const hasOld = await columnExists(db, table, oldName)
  const hasNew = await columnExists(db, table, newName)
  if (hasOld && !hasNew) {
    await db.run(
      sql.raw(`ALTER TABLE \`${table}\` RENAME COLUMN \`${oldName}\` TO \`${newName}\`;`),
    )
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await renameIfNeeded(db, 'utm_campaigns', 'utm_camp_source', 'source')
  await renameIfNeeded(db, 'utm_campaigns', 'utm_camp_medium', 'medium')
  await renameIfNeeded(db, 'utm_campaigns', 'utm_camp_status', 'status')
}

export async function down({ db }: MigrateUpArgs | MigrateDownArgs): Promise<void> {
  await renameIfNeeded(db, 'utm_campaigns', 'source', 'utm_camp_source')
  await renameIfNeeded(db, 'utm_campaigns', 'medium', 'utm_camp_medium')
  await renameIfNeeded(db, 'utm_campaigns', 'status', 'utm_camp_status')
}
