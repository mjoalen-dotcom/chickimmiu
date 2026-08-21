import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C-2（Alan 2026-08-21 拍板）：customers 加公開暱稱欄位
 * ────────────────────────────────────────────────
 * 排行榜等公開場合顯示會員自訂暱稱；未設定時前端顯示遮罩真名。
 * SQLite 本地端由 scripts/dev-sync-sqlite-schema.ts 自動補欄（鏈已凍結，不另寫 SQLite 版）。
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "nickname" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customers" DROP COLUMN IF EXISTS "nickname";`)
}
