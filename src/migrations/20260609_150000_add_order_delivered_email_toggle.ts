import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * OrderSettings.notifications.sendDeliveredEmail —「送達通知信」開關。
 *
 * 對應 src/globals/OrderSettings.ts notifications group 新增 checkbox（預設 true）+
 * Orders.ts status→delivered afterChange hook + src/lib/email/orderDelivered.ts。
 *
 * 冪等：PRAGMA table_info 判斷。
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'order_settings')) {
    if (!(await columnExists(db, 'order_settings', 'notifications_send_delivered_email'))) {
      await db.run(
        sql`ALTER TABLE \`order_settings\` ADD COLUMN \`notifications_send_delivered_email\` integer DEFAULT true;`,
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'order_settings', 'notifications_send_delivered_email')) {
    await db.run(
      sql`ALTER TABLE \`order_settings\` DROP COLUMN \`notifications_send_delivered_email\`;`,
    )
  }
}
