/**
 * 驗 whitehat dashboard 欄位修正：write 路徑 + getWhiteHatDashboard + 失敗的 find 都不再炸。
 *   rm -f data/_wh.db*; yes y | DATABASE_URI=file:./data/_wh.db ... payload migrate
 *   DATABASE_URI=file:./data/_wh.db ... payload run scripts/check_whitehat.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { getWhiteHatDashboard } from '@/lib/marketing/whiteHatAutomation'

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any
  let fail = 0

  // 1. write 路徑（priceTWD/priceKRW/estimatedCostTWD 欄位映射）
  try {
    await p.create({
      collection: 'competitor-price-records',
      data: { productName: '測試競品', platform: 'sinsang', priceTWD: 1200, priceKRW: 50000, estimatedCostTWD: 400, status: 'new', flags: ['high_margin'] },
      overrideAccess: true,
    })
    process.stdout.write('  [PASS] write competitor-price-record\n')
  } catch (e) {
    fail++; process.stdout.write('  [FAIL] write — ' + (e instanceof Error ? e.message : String(e)) + '\n')
  }

  // 2. 失敗的那條 find（status in [new,reviewed], depth 1 觸發 flags 子查詢）
  try {
    const r = await p.find({ collection: 'competitor-price-records', where: { status: { in: ['new', 'reviewed'] } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true })
    const ok = r.totalDocs >= 1 && r.docs[0]?.priceTWD === 1200
    if (ok) process.stdout.write(`  [PASS] find (failing query) total=${r.totalDocs} priceTWD=${r.docs[0]?.priceTWD}\n`)
    else { fail++; process.stdout.write(`  [FAIL] find shape total=${r.totalDocs} priceTWD=${r.docs[0]?.priceTWD}\n`) }
  } catch (e) {
    fail++; process.stdout.write('  [FAIL] find — ' + (e instanceof Error ? e.message : String(e)) + '\n')
  }

  // 3. getWhiteHatDashboard（dashboard API 的真實路徑）
  try {
    const dash = await getWhiteHatDashboard(payload as never)
    process.stdout.write(`  [PASS] getWhiteHatDashboard ok (keys: ${Object.keys(dash || {}).join(',')})\n`)
  } catch (e) {
    fail++; process.stdout.write('  [FAIL] getWhiteHatDashboard — ' + (e instanceof Error ? e.message : String(e)) + '\n')
  }

  process.stdout.write(`\n=== whitehat fix verify: ${fail === 0 ? 'ALL PASS' : fail + ' FAIL'} ===\n`)
  if (fail > 0) process.exitCode = 1
}

await main()
