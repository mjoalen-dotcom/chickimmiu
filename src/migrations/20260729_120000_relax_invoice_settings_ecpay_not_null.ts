import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * invoice_settings：ecpay_config 三欄 NOT NULL → nullable
 * ──────────────────────────────────────────────────────────
 * ecpayConfig.merchantId / hashKey / hashIV 是死欄位：發票引擎
 * （ecpayInvoiceEngine.ts）只讀 process.env.ECPAY_INVOICE_*，全 repo 無人
 * 消費這三欄。但 baseline 建表為 NOT NULL + InvoiceSettings.ts required:true，
 * 導致任何人要儲存這個 global（例如只想填賣方統編）都被迫填憑證，
 * seed-invoice-settings-20260729.ts 也被驗證擋死。
 *
 * 對應 config 修改：src/globals/InvoiceSettings.ts 三欄改 required:false。
 *
 * seller_info_seller_u_b_n / seller_info_seller_name 一併評估後「維持 NOT NULL」：
 * 兩欄仍是 Payload 層 required（PDF 真的需要），sellerName 有 DEFAULT、
 * seed 與後台表單都會帶值，且維持與 config 產生的 schema 一致、避免 drift。
 *
 * SQLite 不支援 ALTER COLUMN DROP NOT NULL → 整表重建。
 * 子表 invoice_settings_automation_config_notify_channels FK 指向本表
 * （ON DELETE cascade）：若 FK enforcement 開啟，先 DROP 父表會觸發隱式
 * DELETE 連鎖清空子表 → 因此順序固定「快照兩表 → 先 DROP 子表再 DROP 父表
 * → 重建 → 回填」，不依賴 PRAGMA foreign_keys 狀態（transaction 內 PRAGMA
 * 是 no-op，不可信）。
 *
 * 冪等：PRAGMA table_info 檢查 ecpay_config_merchant_id 的 notnull flag，
 * 已是 0 直接略過（fresh DB 走 baseline 後仍會執行一次；資料 0~1 列，成本可忽略）。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableInfo(db: any, table: string): Promise<Array<Record<string, unknown>>> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  return (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function snapshotRows(db: any, table: string): Promise<Array<Record<string, unknown>>> {
  const res = await db.run(sql.raw(`SELECT * FROM \`${table}\`;`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  // libsql 的 row 可能是 array-like + 具名屬性；用 columns 名單取值最穩，
  // 沒有 columns 時退回過濾掉數字索引的 Object.keys。
  const columns: string[] =
    (res?.columns as string[] | undefined) ??
    (rows[0] ? Object.keys(rows[0]).filter((k) => !/^\d+$/.test(k)) : [])
  return rows.map((r) => {
    const out: Record<string, unknown> = {}
    for (const c of columns) out[c] = r[c]
    return out
  })
}

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function restoreRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row)
    if (!cols.length) continue
    await db.run(
      sql.raw(
        `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols
          .map((c) => sqlLiteral(row[c]))
          .join(', ')});`,
      ),
    )
  }
}

const CHILD_TABLE = 'invoice_settings_automation_config_notify_channels'

const CREATE_CHILD = `CREATE TABLE IF NOT EXISTS \`${CHILD_TABLE}\` (
  \`order\` integer NOT NULL,
  \`parent_id\` integer NOT NULL,
  \`value\` text,
  \`id\` integer PRIMARY KEY NOT NULL,
  FOREIGN KEY (\`parent_id\`) REFERENCES \`invoice_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS \`invoice_settings_branding_config_branding_config_invoice_idx\` ON \`invoice_settings\` (\`branding_config_invoice_logo_id\`);`,
  `CREATE INDEX IF NOT EXISTS \`invoice_settings_branding_config_branding_config_company_idx\` ON \`invoice_settings\` (\`branding_config_company_chop_id\`);`,
  `CREATE INDEX IF NOT EXISTS \`invoice_settings_automation_config_notify_channels_order_idx\` ON \`${CHILD_TABLE}\` (\`order\`);`,
  `CREATE INDEX IF NOT EXISTS \`invoice_settings_automation_config_notify_channels_parent_idx\` ON \`${CHILD_TABLE}\` (\`parent_id\`);`,
]

/** ecpayNullable=true → up 後的新 DDL；false → down 還原 baseline DDL */
function createParentSql(ecpayNullable: boolean): string {
  const nn = ecpayNullable ? '' : ' NOT NULL'
  return `CREATE TABLE IF NOT EXISTS \`invoice_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`ecpay_config_merchant_id\` text${nn},
  \`ecpay_config_hash_key\` text${nn},
  \`ecpay_config_hash_i_v\` text${nn},
  \`ecpay_config_environment\` text DEFAULT 'test',
  \`ecpay_config_test_gateway_url\` text DEFAULT 'https://einvoice-stage.ecpay.com.tw',
  \`ecpay_config_prod_gateway_url\` text DEFAULT 'https://einvoice.ecpay.com.tw',
  \`seller_info_seller_u_b_n\` text NOT NULL,
  \`seller_info_seller_name\` text NOT NULL DEFAULT '靚秀國際有限公司',
  \`seller_info_seller_address\` text DEFAULT '臺北市信義區基隆路一段68號9樓',
  \`seller_info_seller_phone\` text,
  \`seller_info_seller_email\` text,
  \`branding_config_invoice_logo_id\` integer,
  \`branding_config_company_chop_id\` integer,
  \`branding_config_footer_text\` text DEFAULT '感謝您的購買！CHIC KIM & MIU 靚秀國際有限公司',
  \`automation_config_auto_issue_enabled\` integer DEFAULT true,
  \`automation_config_auto_notify_enabled\` integer DEFAULT true,
  \`automation_config_retry_enabled\` integer DEFAULT true,
  \`automation_config_max_retry_count\` numeric DEFAULT 3,
  \`automation_config_retry_interval_minutes\` numeric DEFAULT 5,
  \`default_config_default_invoice_type\` text DEFAULT 'b2c_personal',
  \`default_config_default_donation_code\` text,
  \`default_config_default_tax_type\` text DEFAULT 'taxable',
  \`default_config_item_tax_free\` integer DEFAULT false,
  \`updated_at\` text,
  \`created_at\` text,
  FOREIGN KEY (\`branding_config_invoice_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (\`branding_config_company_chop_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
);`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rebuild(db: any, ecpayNullable: boolean): Promise<void> {
  const parentRows = await snapshotRows(db, 'invoice_settings')
  const childRows = await snapshotRows(db, CHILD_TABLE)

  await db.run(sql.raw(`DROP TABLE IF EXISTS \`${CHILD_TABLE}\`;`))
  await db.run(sql.raw(`DROP TABLE IF EXISTS \`invoice_settings\`;`))

  await db.run(sql.raw(createParentSql(ecpayNullable)))
  await db.run(sql.raw(CREATE_CHILD))
  for (const idx of INDEXES) await db.run(sql.raw(idx))

  await restoreRows(db, 'invoice_settings', parentRows)
  await restoreRows(db, CHILD_TABLE, childRows)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const cols = await tableInfo(db, 'invoice_settings')
  const target = cols.find((c) => c?.name === 'ecpay_config_merchant_id')
  if (!target || Number(target.notnull) === 0) return
  await rebuild(db, true)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const cols = await tableInfo(db, 'invoice_settings')
  const target = cols.find((c) => c?.name === 'ecpay_config_merchant_id')
  if (!target || Number(target.notnull) === 1) return
  // 還原 NOT NULL 前把 NULL 憑證欄補成空字串，避免回填違反約束
  const rows = await snapshotRows(db, 'invoice_settings')
  for (const r of rows) {
    for (const c of ['ecpay_config_merchant_id', 'ecpay_config_hash_key', 'ecpay_config_hash_i_v']) {
      if (r[c] === null || r[c] === undefined) r[c] = ''
    }
  }
  // rebuild 會重新快照，先把補值寫回舊表
  for (const r of rows) {
    await db.run(
      sql.raw(
        `UPDATE \`invoice_settings\` SET
           \`ecpay_config_merchant_id\` = ${sqlLiteral(r.ecpay_config_merchant_id)},
           \`ecpay_config_hash_key\` = ${sqlLiteral(r.ecpay_config_hash_key)},
           \`ecpay_config_hash_i_v\` = ${sqlLiteral(r.ecpay_config_hash_i_v)}
         WHERE \`id\` = ${sqlLiteral(r.id)};`,
      ),
    )
  }
  await rebuild(db, false)
}
