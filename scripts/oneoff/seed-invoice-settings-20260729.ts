import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * InvoiceSettings 賣方資訊 seed（冪等，可重跑）— 2026-07-29
 * ─────────────────────────────────────────────
 * 背景：invoice_settings global 從未儲存（0 rows）→ 發票 PDF 賣方名稱/統編/地址
 * 渲染空白（invoicePdfGenerator.ts sellerInfo 區塊）。engine 開立走 process.env
 * 不受影響，此處只補 PDF 顯示用的賣方資訊。
 *
 * 冪等規則：sellerUBN 已有值就整組略過（不覆蓋人工改過的資料）。
 *
 * 注意：ecpayConfig.merchantId/hashKey/hashIV 為死欄位（engine 只讀 env），
 * 已於 20260729_120000 migration 改 nullable + config required:false，
 * 本腳本不再受其驗證阻擋。若 updateGlobal 仍失敗，腳本印出錯誤並以非 0 退出。
 *
 * 用法：pnpm payload run scripts/oneoff/seed-invoice-settings-20260729.ts
 */

const SELLER = {
  sellerUBN: '24540533',
  sellerName: '靚秀國際有限公司',
  sellerAddress: '臺北市信義區基隆路一段68號9樓',
  sellerPhone: '02-2718-9488',
  sellerEmail: 'service@chickimmiu.com',
}

async function main() {
  const payload = await getPayload({ config })

  const before = (await payload.findGlobal({ slug: 'invoice-settings', depth: 0 })) as unknown as {
    sellerInfo?: Record<string, unknown>
  }
  const current = before.sellerInfo ?? {}
  console.log('[invoice-settings] before sellerInfo:', JSON.stringify(current))

  if (current.sellerUBN) {
    console.log('[invoice-settings] sellerUBN 已有值，略過不覆蓋')
    process.exit(0)
  }

  try {
    const updated = (await payload.updateGlobal({
      slug: 'invoice-settings',
      data: { sellerInfo: SELLER } as never,
    })) as unknown as { sellerInfo?: Record<string, unknown> }
    console.log('[invoice-settings] after sellerInfo:', JSON.stringify(updated.sellerInfo))
    process.exit(0)
  } catch (e) {
    console.error('[invoice-settings] updateGlobal 失敗（可能是 apiSettings required 驗證）:', (e as Error).message)
    process.exit(1)
  }
}

await main()
