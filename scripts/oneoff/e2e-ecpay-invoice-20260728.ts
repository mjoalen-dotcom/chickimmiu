/**
 * ECPay B2CInvoice JSON+AES 傳輸層 E2E — 2026-07-28
 * 對 einvoice-stage（官方測試憑證 2000132）跑：開立 → 查詢 → 作廢。
 * 執行：pnpm cross-env NODE_OPTIONS=--no-deprecation payload run scripts/oneoff/e2e-ecpay-invoice-20260728.ts
 */
import {
  issueInvoice,
  queryInvoice,
  voidInvoice,
} from '../../src/lib/invoice/ecpayInvoiceEngine'

async function main() {
  const relate = `CKE2E${Date.now().toString(36).toUpperCase()}`
  console.log(`[E2E] RelateNumber: ${relate}`)

  // 1) 開立
  const issue = await issueInvoice({
    orderId: 'e2e-transport-test',
    orderNumber: relate,
    invoiceType: 'b2c_personal',
    buyerName: 'E2E測試買受人',
    buyerEmail: 'mjoalen+einvoice@gmail.com',
    buyerPhone: '0911222333',
    items: [
      { name: 'E2E 測試商品 A', count: 2, word: '件', price: 500 },
      { name: 'E2E 測試商品 B', count: 1, word: '件', price: 100 },
    ],
    totalAmount: 1100,
    taxType: 'taxable',
  })
  console.log('[E2E][Issue]', JSON.stringify(issue, null, 2))
  if (!issue.success || !issue.invoiceNo) {
    console.error('[E2E] 開立失敗，中止')
    process.exit(1)
  }

  // 2) 查詢
  const query = await queryInvoice(issue.invoiceNo, issue.invoiceDate || '')
  console.log('[E2E][GetIssue]', JSON.stringify(query, null, 2))

  // 3) 作廢
  const invalid = await voidInvoice(issue.invoiceNo, 'E2E傳輸層驗證作廢', issue.invoiceDate)
  console.log('[E2E][Invalid]', JSON.stringify(invalid, null, 2))

  const allPass = query.RtnCode === 1 && invalid.success
  console.log(`[E2E] 結果：Issue=PASS GetIssue=${query.RtnCode === 1 ? 'PASS' : 'FAIL'} Invalid=${invalid.success ? 'PASS' : 'FAIL'}`)
  process.exit(allPass ? 0 : 1)
}

await main()
