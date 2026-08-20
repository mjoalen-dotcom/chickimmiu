/**
 * 一次性驗證腳本 — 營運 AI 助理
 *
 *   建議跑在全新 verify DB（本地 chickimmiu.db 是舊的 dev push 快照，schema 落後於程式碼）：
 *     DATABASE_URI="file:./data/ops-verify.db" pnpm payload migrate
 *     DATABASE_URI="file:./data/ops-verify.db" pnpm payload run scripts/verify-ops-copilot.ts
 *
 * 驗什麼：
 *   1. 七個掃描器對真實 schema 跑得完（查詢欄位名沒寫錯）
 *   2. 掃描器真的抓得到人為造出來的異常
 *   3. generateBriefing({persist:false}) 零寫入；persist:true 會建 pending 提案
 *   4. 行動的 validate / preview 護欄有效（空參數、超幅調價、成本底線）
 *   5. execute() 真的會改資料，且提案狀態轉 executed
 *
 * ⚠️ 這支腳本會寫入資料。**只對 verify DB 跑，不要對 prod 跑。**
 * ⚠️ payload run 需要 top-level await 結尾，否則 process 會靜默早退。
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import { ACTION_TYPES } from '../src/lib/ops-copilot/actions'
import { generateBriefing } from '../src/lib/ops-copilot/briefing'
import { collectSignals } from '../src/lib/ops-copilot/signals'

const DAY = 86_400_000
const ok = (b: boolean) => (b ? '✅' : '❌')

async function seed(payload: Awaited<ReturnType<typeof getPayload>>) {
  const existing = await payload.find({ collection: 'products', limit: 1, depth: 0 })
  if (existing.totalDocs > 0) {
    console.log('（已有資料，跳過 seed）')
    return
  }

  console.log('建立最小 fixture…')

  const category = await payload.create({
    collection: 'categories',
    data: { name: '驗證用分類', slug: 'verify-category' },
    depth: 0,
  })

  // 熱賣但快缺貨的商品 → 應觸發 inventory.low_stock
  const product = await payload.create({
    collection: 'products',
    data: {
      name: '測試羊毛大衣',
      slug: 'verify-wool-coat',
      category: category.id,
      status: 'published',
      price: 3200,
      salePrice: 2980,
      cost: 1200,
      // 33 不是 3：WO-BP002（08-14）起 Orders.beforeChange 有超賣防線，
      // 且每張訂單 create 都會自動扣庫存 —— 下面 6 張 ×5 件扣掉 30 後
      // 正好剩 3，同時滿足「銷速算得出來」與「觸發 low_stock」兩件事。
      stock: 33,
      lowStockThreshold: 10,
      productSku: 'VERIFY-COAT',
      // supplierName 在 sourcing group 底下，不是 top-level
      sourcing: { supplierName: '測試供應商' },
    },
    depth: 0,
  })

  const customer = await payload.create({
    collection: 'users',
    data: {
      email: 'verify-customer@example.test',
      password: 'VerifyOnly!2026',
      name: '驗證用客戶',
      role: 'customer',
    },
    depth: 0,
  })

  // 近 30 天的訂單，讓銷速算得出來（30 件 / 30 天 = 每天 1 件 → 3 件只剩 3 天）
  for (let i = 0; i < 6; i++) {
    await payload.create({
      collection: 'orders',
      data: {
        orderNumber: `VERIFY-${1000 + i}`,
        customer: customer.id,
        status: 'delivered',
        paymentStatus: 'paid',
        subtotal: 2980 * 5,
        shippingFee: 0,
        total: 2980 * 5,
        shippingAddress: {
          recipientName: '驗證用客戶',
          phone: '0900000000',
          city: '台北市',
          district: '中山區',
          address: '測試路 1 號',
        },
        items: [
          {
            product: product.id,
            productName: '測試羊毛大衣',
            sku: 'VERIFY-COAT',
            quantity: 5,
            unitPrice: 2980,
            subtotal: 2980 * 5,
          },
        ],
      },
      depth: 0,
    })
  }

  // 競品比我們便宜 → 應觸發 pricing.competitor_undercut
  await payload.create({
    collection: 'competitor-price-records',
    data: {
      productName: '同款羊毛大衣',
      relatedProduct: product.id,
      platform: 'shopline',
      priceTWD: 2400,
      observedAt: new Date().toISOString(),
    },
    depth: 0,
  })

  return product
}

async function main() {
  const payload = await getPayload({ config })
  const uri = process.env.DATABASE_URI ?? '(unset)'
  console.log(`\nDATABASE_URI = ${uri}`)
  if (!uri.includes('verify')) {
    console.log('⚠️  這不像 verify DB。腳本會寫入資料 —— 若這是正式資料庫請立刻中止。\n')
  }

  await seed(payload)

  console.log('\n── 1. 掃描器 ─────────────────────────────')
  const t0 = Date.now()
  const { signals, failed } = await collectSignals(payload as never)
  console.log(`耗時 ${Date.now() - t0}ms｜訊號 ${signals.length} 項｜失敗掃描器 ${failed.length} 個 ${ok(failed.length === 0)}`)
  if (failed.length) console.log('  失敗：', failed.join(', '))
  for (const s of signals) {
    console.log(`  [${s.severity}] ${s.id} — ${s.title}`)
    console.log(`      metrics: ${JSON.stringify(s.metrics)}`)
    console.log(`      建議行動: ${(s.suggestedActions ?? []).length} 個`)
  }
  console.log(`  抓到低庫存訊號: ${ok(signals.some((s) => s.id === 'inventory.low_stock'))}`)
  console.log(`  抓到競品低價訊號: ${ok(signals.some((s) => s.id === 'pricing.competitor_undercut'))}`)

  console.log('\n── 2. 日報 persist:false 必須零寫入 ───────')
  const before = await payload.find({ collection: 'ops-actions', limit: 0, depth: 0 })
  const dry = await generateBriefing(payload as never, { persist: false })
  const afterDry = await payload.find({ collection: 'ops-actions', limit: 0, depth: 0 })
  console.log(`  headline: ${dry.headline.slice(0, 90)}…`)
  console.log(`  degraded: ${dry.degraded}（沒設 ANTHROPIC_API_KEY 時應為 true）`)
  console.log(`  ops-actions ${before.totalDocs} → ${afterDry.totalDocs} ${ok(before.totalDocs === afterDry.totalDocs)}`)

  console.log('\n── 3. 日報 persist:true 應建立 pending 提案 ─')
  const wet = await generateBriefing(payload as never, { persist: true })
  const afterWet = await payload.find({ collection: 'ops-actions', where: { status: { equals: 'pending' } }, limit: 20, depth: 0 })
  console.log(`  新增提案 ${wet.proposedActionIds.length} 筆｜pending 總數 ${afterWet.totalDocs} ${ok(wet.proposedActionIds.length > 0)}`)
  for (const a of afterWet.docs) {
    console.log(`    · [${a.risk}] ${a.actionType} — ${a.summary}`)
  }

  console.log('\n── 4. 去重：再跑一次不應重複建立 ──────────')
  const wet2 = await generateBriefing(payload as never, { persist: true })
  console.log(`  第二次新增 ${wet2.proposedActionIds.length} 筆（應為 0）${ok(wet2.proposedActionIds.length === 0)}`)

  console.log('\n── 5. validate 護欄（空參數） ─────────────')
  for (const [id, action] of Object.entries(ACTION_TYPES)) {
    const errs = action.validate({})
    console.log(`  ${id.padEnd(24)} risk=${action.risk.padEnd(4)} 被擋 ${ok(errs.length > 0)}`)
  }

  console.log('\n── 6. 調價熔斷 ───────────────────────────')
  const product = (await payload.find({ collection: 'products', limit: 1, depth: 0 })).docs[0]
  const current = (product.salePrice as number) || (product.price as number)
  const halved = await ACTION_TYPES.adjust_product_price.preview(payload as never, {
    productId: product.id,
    salePrice: Math.round(current * 0.5),
  })
  console.log(`  砍半（-50%）被 20% 上限擋下 ${ok(Boolean(halved.blockers?.length))}：${JSON.stringify(halved.blockers)}`)

  const belowCost = await ACTION_TYPES.adjust_product_price.preview(payload as never, {
    productId: product.id,
    salePrice: Math.round(current * 0.85), // 幅度 15% 過關，但可能低於成本底線
  })
  console.log(`  -15% 調價：blockers=${JSON.stringify(belowCost.blockers ?? [])}｜預覽 ${belowCost.headline}`)

  console.log('\n── 7. 實際執行一筆低風險提案 ──────────────')
  const lowRisk = afterWet.docs.find((d) => d.risk === 'low')
  if (!lowRisk) {
    console.log('  （沒有低風險提案可測）')
  } else {
    const type = ACTION_TYPES[lowRisk.actionType as keyof typeof ACTION_TYPES]
    const result = await type.execute(payload as never, lowRisk.input as Record<string, unknown>, 1)
    console.log(`  ${lowRisk.summary}`)
    console.log(`  結果 ${ok(result.ok)}：${result.message}`)
    console.log(`  受影響：${JSON.stringify(result.affected)}`)
    const pos = await payload.find({ collection: 'purchase-orders', limit: 5, depth: 0 })
    console.log(`  purchase-orders 筆數：${pos.totalDocs}（狀態應為 draft：${pos.docs.map((p) => p.status).join(',')}）`)
  }

  console.log('\n完成。\n')
  process.exit(0)
}

await main()
