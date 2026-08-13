/**
 * Campaign Engine 正式環境驗收（唯讀 + 零副作用）
 * ─────────────────────────────────────────────
 * 跑法（在 prod）：
 *   cd /var/www/chickimmiu && NODE_ENV=production pnpm payload run scripts/verify-campaign-engine-prod.ts
 *
 * 只做讀取與「不寫入的計價試算」：
 * - schema：新表 / 新欄位存在
 * - 設定：promotion-settings 預設安全（storefront off、計價強制 on）
 * - 引擎：對真實商品跑 computeOrderPricing（純計算，不建單、不寫 reward）
 * - 資安：確認 serverPricingEnforcement 生效路徑存在
 * 不建立、不修改、不刪除任何資料。
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { computeOrderPricing } from '../src/lib/promotions/pricing'
import { loadActiveCommerceRules, loadPromotionSettings } from '../src/lib/promotions/snapshots'

const log = (...args: unknown[]) => console.error('[prod-verify]', ...args)
const keepAlive = setInterval(() => {}, 60_000)
let failures = 0
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) log(`✓ ${name}`)
  else {
    failures++
    log(`✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : '')
  }
}

async function main() {
  const payload = await getPayload({ config: await config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drizzle = (payload.db as any).drizzle

  // ── 1. schema ───────────────────────────────────────────────────────────
  const tablesRes = await drizzle.run(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN
     ('promotion_rules','promotion_applications','promotion_settings',
      'marketing_campaigns_commerce_surfaces','promotion_rules_rels');` as never,
  )
  const tables = new Set(
    ((tablesRes?.rows ?? []) as Array<Record<string, unknown>>).map((r) => String(r.name)),
  )
  check('新表齊全（5 張）', tables.size === 5, [...tables])

  const colCheck = async (table: string, col: string) => {
    const res = await drizzle.run(`PRAGMA table_info('${table}');` as never)
    return ((res?.rows ?? []) as Array<Record<string, unknown>>).some((r) => r.name === col)
  }
  check('orders.promotion_quote_hash 欄位存在', await colCheck('orders', 'promotion_quote_hash'))
  check('orders.promotion_server_enforced 欄位存在', await colCheck('orders', 'promotion_server_enforced'))
  check('marketing_campaigns.commerce_budget_cap 欄位存在', await colCheck('marketing_campaigns', 'commerce_budget_cap'))
  check('behavior_events.campaign_id 欄位存在', await colCheck('behavior_events', 'campaign_id'))

  const idxRes = await drizzle.run(
    `SELECT name FROM sqlite_master WHERE type='index'
     AND name='promotion_applications_idempotency_key_idx';` as never,
  )
  check(
    'promotion_applications idempotencyKey UNIQUE index 存在',
    ((idxRes?.rows ?? []) as unknown[]).length === 1,
  )

  // ── 2. 設定預設安全 ─────────────────────────────────────────────────────
  const settings = await loadPromotionSettings(payload)
  check('storefrontEnabled 預設關閉（前台無感）', settings.storefrontEnabled === false, settings.storefrontEnabled)
  check('serverPricingEnforcement 開啟（資安防線生效）', settings.serverPricingEnforcement === true)
  check('killSwitch 未觸發', settings.killSwitch === false)

  // ── 3. 活動狀態 ─────────────────────────────────────────────────────────
  const active = await loadActiveCommerceRules(payload, { settings })
  check('目前無 active 商務活動（72H 應為 draft）', active.campaigns.length === 0, {
    campaigns: active.campaigns.map((c) => `${c.campaignSlug}:${c.status}`),
  })

  const seeded = await payload.find({
    collection: 'marketing-campaigns',
    where: { campaignSlug: { equals: '72h-chic-style-hunt' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const campaign = seeded.docs[0] as Record<string, any> | undefined
  if (campaign) {
    check('72H 活動已 seed 且為 draft', campaign.status === 'draft', campaign.status)
    check('72H killSwitch=true（雙保險）', campaign.commerce?.killSwitch === true)
    check('72H budgetCap 留空（未填不可啟用）', campaign.commerce?.budgetCap == null)
    const rules = await payload.find({
      collection: 'promotion-rules' as never,
      where: { campaign: { equals: campaign.id } },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    })
    const rule = rules.docs[0] as Record<string, any> | undefined
    check('72H 規則已 seed 且為 draft', rule?.status === 'draft', rule?.status)
    check('72H 規則 = 任選 2 件折 1000', rule?.effect?.amount === 1000 && rule?.effect?.groupSize === 2)
  } else {
    log('⊙ 72H 活動尚未 seed（跑 pnpm seed:campaign72h）')
  }

  // ── 4. 引擎對真實商品試算（純計算，零寫入）──────────────────────────────
  const products = await payload.find({
    collection: 'products',
    where: { and: [{ status: { equals: 'published' } }, { price: { greater_than: 0 } }] },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  const docs = products.docs as Array<Record<string, any>>
  if (docs.length >= 2) {
    const result = await computeOrderPricing(payload, {
      items: [
        { productId: docs[0].id, quantity: 1 },
        { productId: docs[1].id, quantity: 1 },
      ],
      couponCodes: [],
      user: null,
      channel: 'web',
    })
    const expectedSubtotal = docs
      .slice(0, 2)
      .reduce((s, p) => s + (typeof p.salePrice === 'number' && p.salePrice < p.price ? p.salePrice : p.price), 0)
    check('引擎可對真實商品報價', result.ok, { errors: result.errors })
    check('小計 = DB 現價加總（不信任何 client 值）', result.breakdown.itemsSubtotal === expectedSubtotal, {
      got: result.breakdown.itemsSubtotal,
      expected: expectedSubtotal,
    })
    check('活動未啟用 → 折抵 0', result.breakdown.promotionDiscount === 0)
    check('quoteHash 已產生', Boolean(result.quote.quoteHash) && result.quote.pricingVersion === 'pe-v1')
    log(
      `  報價樣本：小計 ${result.breakdown.itemsSubtotal} / 運費 ${result.breakdown.shippingFee}` +
        `（預估=${result.breakdown.shippingEstimated}）/ 合計 ${result.breakdown.total}`,
    )
  } else {
    log('⊙ 上架商品不足 2 件，跳過報價試算')
  }

  // ── 5. 既有資料未受影響 ─────────────────────────────────────────────────
  const orders = await payload.count({ collection: 'orders', overrideAccess: true })
  const coupons = await payload.count({ collection: 'coupons', overrideAccess: true })
  const apps = await payload.count({ collection: 'promotion-applications' as never, overrideAccess: true })
  log(`  現況：訂單 ${orders.totalDocs} 筆 / 優惠券 ${coupons.totalDocs} 張 / 促銷套用紀錄 ${apps.totalDocs} 筆`)
  check('促銷套用紀錄為空（尚無活動訂單）', apps.totalDocs === 0, apps.totalDocs)

  log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
  clearInterval(keepAlive)
  process.exit(failures === 0 ? 0 : 1)
}

await main().catch((err) => {
  console.error('[prod-verify] FATAL', err)
  process.exit(1)
})
