/**
 * Campaign Engine E2E（本機 DB 副本）：72H 活動全鏈驗證
 * ──────────────────────────────────────────────────
 * 跑法：cross-env NODE_OPTIONS=--no-deprecation payload run scripts/verify-quote-e2e.ts
 *
 * 流程：暫時把 72H 活動催成可用（active + budgetCap + approval + 規則 active +
 * killSwitch off + storefront on）→ 對 computeOrderPricing 打真實商品組合 →
 * 驗證折扣 / 進度 / 護欄 → 全部還原成 draft + killSwitch。
 * 只動本機 worktree 的 DB 副本；不碰 prod。
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { computeOrderPricing } from '../src/lib/promotions/pricing'

const log = (...args: unknown[]) => console.error('[e2e]', ...args)
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

  // 1. 撈 72H 活動與規則
  const campaigns = await payload.find({
    collection: 'marketing-campaigns',
    where: { campaignSlug: { equals: '72h-chic-style-hunt' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const campaign = campaigns.docs[0] as Record<string, any> | undefined
  if (!campaign) {
    log('找不到 72H 活動，先跑 pnpm seed:campaign72h')
    process.exit(1)
  }
  const rules = await payload.find({
    collection: 'promotion-rules' as never,
    where: { campaign: { equals: campaign.id } },
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })
  const rule = rules.docs[0] as Record<string, any> | undefined
  if (!rule) {
    log('找不到規則')
    process.exit(1)
  }

  // 2. 撈兩個有價格的商品；不足就自建測試商品（跑完刪除）
  const products = await payload.find({
    collection: 'products',
    where: { price: { greater_than: 0 } },
    limit: 3,
    depth: 0,
    overrideAccess: true,
  })
  const createdProductIds: Array<number | string> = []
  let pool = products.docs as Array<Record<string, any>>
  if (pool.length < 2) {
    log('dev DB 商品不足，建立測試商品')
    // 商品必填主分類 → 沿用既有或自建
    const cats = await payload.find({ collection: 'categories', limit: 1, depth: 0, overrideAccess: true })
    let categoryId = (cats.docs[0] as Record<string, any> | undefined)?.id
    if (categoryId == null) {
      const cat = (await payload.create({
        collection: 'categories',
        data: { name: '[TEST] CE 分類', slug: `test-ce-cat-${Date.now()}` } as never,
        overrideAccess: true,
      })) as Record<string, any>
      categoryId = cat.id
    }
    for (const def of [
      { name: '[TEST] CE 洋裝 A', slug: `test-ce-a-${Date.now()}`, price: 1800, cost: 500 },
      { name: '[TEST] CE 上衣 B', slug: `test-ce-b-${Date.now()}`, price: 1200, cost: 400 },
    ]) {
      const created = (await payload.create({
        collection: 'products',
        data: { ...def, category: categoryId, status: 'published', stock: 99, description: 'E2E 測試商品' } as never,
        overrideAccess: true,
      })) as Record<string, any>
      createdProductIds.push(created.id)
      pool.push(created)
    }
  }
  const [p1, p2] = pool
  const price = (p: Record<string, any>) =>
    typeof p.salePrice === 'number' && p.salePrice < p.price ? p.salePrice : p.price
  log(`測試商品：#${p1.id}（NT$${price(p1)}）+ #${p2.id}（NT$${price(p2)}）`)

  // 3. 暫時催活（記住原狀）
  const now = Date.now()
  await payload.update({
    collection: 'marketing-campaigns',
    id: campaign.id,
    data: {
      status: 'active',
      schedule: {
        startDate: new Date(now - 3600_000).toISOString(),
        endDate: new Date(now + 71 * 3600_000).toISOString(),
        timezone: 'Asia/Taipei',
      },
      commerce: {
        ...campaign.commerce,
        enabled: true,
        killSwitch: false,
        budgetCap: 100_000,
        approval: { approvedBy: null, approvedAt: new Date().toISOString(), approvalNote: 'E2E 本機測試' },
      },
    } as never,
    overrideAccess: true,
  }).catch(async (err) => {
    // 核准人必填 → 找一個 user 當核准人
    const admin = await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true })
    const adminId = (admin.docs[0] as Record<string, any> | undefined)?.id
    if (adminId == null) throw err
    await payload.update({
      collection: 'marketing-campaigns',
      id: campaign.id,
      data: {
        status: 'active',
        schedule: {
          startDate: new Date(now - 3600_000).toISOString(),
          endDate: new Date(now + 71 * 3600_000).toISOString(),
          timezone: 'Asia/Taipei',
        },
        commerce: {
          ...campaign.commerce,
          enabled: true,
          killSwitch: false,
          budgetCap: 100_000,
          approval: { approvedBy: adminId, approvedAt: new Date().toISOString(), approvalNote: 'E2E 本機測試' },
        },
      } as never,
      overrideAccess: true,
    })
  })
  await payload.update({
    collection: 'promotion-rules' as never,
    id: rule.id,
    data: { status: 'active' } as never,
    overrideAccess: true,
  })
  await payload.updateGlobal({
    slug: 'promotion-settings' as never,
    data: { killSwitch: false, storefrontEnabled: true, serverPricingEnforcement: true } as never,
  })
  log('活動已暫時催活（僅本機 DB）')

  try {
    // 4a. 兩件 → 折 1000
    const two = await computeOrderPricing(payload, {
      items: [
        { productId: p1.id, quantity: 1 },
        { productId: p2.id, quantity: 1 },
      ],
      couponCodes: [],
      user: null,
      channel: 'web',
    })
    const expected = Math.min(1000, price(p1) + price(p2))
    check(
      `兩件 → 活動折抵 NT$${expected}`,
      two.ok && two.breakdown.promotionDiscount === expected,
      { ok: two.ok, promo: two.breakdown.promotionDiscount, rejections: two.evaluation?.rejections },
    )
    check(
      '兩件 → 總額 = 小計 − 折抵',
      two.breakdown.total === two.breakdown.itemsSubtotal - expected,
      two.breakdown,
    )
    check(
      '兩件 → progress UNLOCKED',
      (two.evaluation?.progress ?? []).some((p) => p.unlocked),
      two.evaluation?.progress,
    )
    const alloc = two.evaluation?.applications?.[0]?.allocations ?? []
    check(
      '分攤加總 = 折抵',
      alloc.reduce((s: number, a: { amount: number }) => s + a.amount, 0) === expected,
      alloc,
    )

    // 4b. 一件 → 不折 + progress 1/2
    const one = await computeOrderPricing(payload, {
      items: [{ productId: p1.id, quantity: 1 }],
      couponCodes: [],
      user: null,
      channel: 'web',
    })
    const oneHint = (one.evaluation?.progress ?? [])[0]
    check('一件 → 不折', one.breakdown.promotionDiscount === 0)
    check(
      '一件 → progress 1/2 未解鎖',
      Boolean(oneHint && oneHint.current === 1 && oneHint.target === 2 && !oneHint.unlocked),
      oneHint,
    )

    // 4c. kill switch → 折扣消失
    await payload.updateGlobal({
      slug: 'promotion-settings' as never,
      data: { killSwitch: true } as never,
    })
    const killed = await computeOrderPricing(payload, {
      items: [
        { productId: p1.id, quantity: 1 },
        { productId: p2.id, quantity: 1 },
      ],
      couponCodes: [],
      user: null,
      channel: 'web',
    })
    check('global kill switch → 折抵 0', killed.breakdown.promotionDiscount === 0)
    await payload.updateGlobal({
      slug: 'promotion-settings' as never,
      data: { killSwitch: false } as never,
    })

    // 4d. 偽造贈品行 → fail closed
    const forged = await computeOrderPricing(payload, {
      items: [
        { productId: p1.id, quantity: 1 },
        { productId: p2.id, quantity: 1, isGift: true, giftRuleRef: 999999 },
      ],
      couponCodes: [],
      user: null,
      channel: 'web',
    })
    check('偽造贈品行 → 擋下（fail closed）', !forged.ok && forged.errors.some((e) => e.startsWith('invalid_gift_line')))
  } finally {
    // 5. 還原安全狀態
    await payload.update({
      collection: 'promotion-rules' as never,
      id: rule.id,
      data: { status: 'draft' } as never,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'marketing-campaigns',
      id: campaign.id,
      data: { status: 'draft', commerce: { ...campaign.commerce, enabled: true, killSwitch: true } } as never,
      overrideAccess: true,
    })
    await payload.updateGlobal({
      slug: 'promotion-settings' as never,
      data: { killSwitch: false, storefrontEnabled: false } as never,
    })
    for (const pid of createdProductIds) {
      await payload.delete({ collection: 'products', id: pid, overrideAccess: true }).catch(() => {})
    }
    log('已還原 draft + killSwitch + storefront off；測試商品已清除')
  }

  log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
  clearInterval(keepAlive)
  process.exit(failures === 0 ? 0 : 1)
}

await main().catch((err) => {
  console.error('[e2e] FATAL', err)
  process.exit(1)
})
