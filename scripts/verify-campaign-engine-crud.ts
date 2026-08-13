/**
 * Campaign Engine schema/hooks CRUD 煙霧測試（migration 後跑）
 * ─────────────────────────────────────────────────────────
 * 跑法：cross-env NODE_OPTIONS=--no-deprecation payload run scripts/verify-campaign-engine-crud.ts
 * 驗證：
 * 1. 建 commerce 活動草稿（未核准直接 active → 必須被 hook 擋）
 * 2. 建 promotion rule（含 scope rels / select hasMany / tags array）→ 讀回一致
 * 3. rule active 後改 DSL → 必須被擋；status → disabled 允許
 * 4. promotion-settings global 讀寫
 * 5. promotion-applications：server 建立、update 非 status 欄 → 擋、applied→reversed 允許、delete → 擋
 * 全部在測試後清理（活動/規則刪除；applications 不可刪 → 留 reversed 測試列並標記）
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const log = (...args: unknown[]) => console.error('[verify-ce]', ...args)
const keepAlive = setInterval(() => {}, 60_000)
let failures = 0
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) log(`✓ ${name}`)
  else {
    failures++
    log(`✗ ${name}`, extra ?? '')
  }
}

async function main() {
  const payload = await getPayload({ config: await config })
  const stamp = Date.now()

  // 1. 商務活動草稿
  const campaign = await payload.create({
    collection: 'marketing-campaigns',
    data: {
      campaignName: `[TEST] Campaign Engine 煙霧 ${stamp}`,
      campaignSlug: `test-ce-${stamp}`,
      campaignType: 'flash_sale',
      status: 'draft',
      schedule: {
        startDate: new Date(Date.now() - 3600_000).toISOString(),
        endDate: new Date(Date.now() + 72 * 3600_000).toISOString(),
        timezone: 'Asia/Taipei',
      },
      commerce: {
        enabled: true,
        surfaces: ['cart', 'checkout'],
        headline: '測試活動',
        badgeText: '任選2件折$1,000',
      },
    } as never,
    overrideAccess: true,
  })
  check('建立 commerce 活動草稿', Boolean(campaign.id))

  // 未核准 → active 必須被擋
  let blocked = false
  try {
    await payload.update({
      collection: 'marketing-campaigns',
      id: campaign.id,
      data: { status: 'active' } as never,
      overrideAccess: true,
    })
  } catch {
    blocked = true
  }
  check('未填預算/核准就 active → 被擋（fail closed）', blocked)

  // 2. 規則（含子表欄位）
  const rule = await payload.create({
    collection: 'promotion-rules' as never,
    data: {
      name: '[TEST] 任選2件折1000',
      slug: 'mix2-1000',
      campaign: campaign.id,
      status: 'draft',
      version: 1,
      benefitClass: 'item_promo',
      priority: 300,
      scope: { excludeTags: [{ tag: 'final-sale' }] },
      conditions: { minQuantity: 2, segmentsNotIn: ['BLK1'], channels: ['web', 'app'] },
      effect: {
        effectType: 'fixed_discount_per_group',
        groupSize: 2,
        amount: 1000,
        repeatMode: 'once_per_order',
      },
      stacking: { exclusiveGroup: 'mix-match-main', stackableWithAll: true },
      guardrails: { perUserLimit: 3 },
    } as never,
    overrideAccess: true,
  }) as Record<string, any>
  check('建立 promotion rule', Boolean(rule.id))

  const ruleBack = (await payload.findByID({
    collection: 'promotion-rules' as never,
    id: rule.id,
    depth: 0,
    overrideAccess: true,
  })) as Record<string, any>
  check(
    '規則讀回一致（tags array / select hasMany / effect）',
    ruleBack?.scope?.excludeTags?.[0]?.tag === 'final-sale' &&
      Array.isArray(ruleBack?.conditions?.channels) &&
      ruleBack.conditions.channels.length === 2 &&
      ruleBack?.effect?.amount === 1000 &&
      ruleBack?.conditions?.segmentsNotIn?.[0] === 'BLK1',
    JSON.stringify({ scope: ruleBack?.scope, ch: ruleBack?.conditions?.channels }),
  )

  // 3. active 鎖定
  await payload.update({
    collection: 'promotion-rules' as never,
    id: rule.id,
    data: { status: 'active' } as never,
    overrideAccess: true,
  })
  let dslBlocked = false
  try {
    await payload.update({
      collection: 'promotion-rules' as never,
      id: rule.id,
      data: { effect: { effectType: 'fixed_discount_per_group', groupSize: 2, amount: 500, repeatMode: 'once_per_order' } } as never,
      overrideAccess: true,
    })
  } catch {
    dslBlocked = true
  }
  check('active 規則改 DSL → 被擋（版本不可變）', dslBlocked)
  await payload.update({
    collection: 'promotion-rules' as never,
    id: rule.id,
    data: { status: 'disabled' } as never,
    overrideAccess: true,
  })
  check('active → disabled 允許', true)

  // 4. global
  const settings = await payload.findGlobal({ slug: 'promotion-settings' as never })
  check('promotion-settings global 可讀', settings != null)
  await payload.updateGlobal({
    slug: 'promotion-settings' as never,
    data: { storefrontEnabled: false, serverPricingEnforcement: true } as never,
  })
  check('promotion-settings global 可寫', true)

  // 5. applications 不可變性（order 為必填 rel → 借用既有訂單；無訂單則跳過本段）
  const anyOrder = await payload.find({ collection: 'orders', limit: 1, depth: 0, overrideAccess: true })
  const orderId = (anyOrder.docs[0] as Record<string, any> | undefined)?.id
  if (orderId == null) {
    log('⊙ dev DB 無訂單，applications 段跳過（prod 驗證時必有訂單）')
    await payload.delete({ collection: 'promotion-rules' as never, id: rule.id, overrideAccess: true })
    await payload.delete({ collection: 'marketing-campaigns', id: campaign.id, overrideAccess: true })
    log(failures === 0 ? 'ALL PASS (partial)' : `${failures} FAILURES`)
    clearInterval(keepAlive)
    process.exit(failures === 0 ? 0 : 1)
  }
  const app = (await payload.create({
    collection: 'promotion-applications' as never,
    data: {
      campaign: campaign.id,
      rule: rule.id,
      order: orderId,
      ruleKey: `${campaign.id}:mix2-1000:v1`,
      version: 1,
      source: 'campaign_rule',
      effectType: 'fixed_discount_per_group',
      status: 'applied',
      discountAmount: 1000,
      shippingDiscountAmount: 0,
      allocations: [{ lineId: 'test', amount: 1000 }],
      idempotencyKey: `test:${stamp}`,
    } as never,
    overrideAccess: true,
  })) as Record<string, any>
  check('建立 application（server 路徑）', Boolean(app.id))

  let dupBlocked = false
  try {
    await payload.create({
      collection: 'promotion-applications' as never,
      data: {
        campaign: campaign.id,
        order: orderId,
        ruleKey: 'dup',
        version: 1,
        source: 'campaign_rule',
        effectType: 'x',
        status: 'applied',
        discountAmount: 1,
        idempotencyKey: `test:${stamp}`,
      } as never,
      overrideAccess: true,
    })
  } catch {
    dupBlocked = true
  }
  check('重複 idempotencyKey → DB UNIQUE 擋下', dupBlocked)

  let mutBlocked = false
  try {
    await payload.update({
      collection: 'promotion-applications' as never,
      id: app.id,
      data: { discountAmount: 999999 } as never,
      overrideAccess: true,
    })
  } catch {
    mutBlocked = true
  }
  check('修改 application 金額 → 被擋（不可變）', mutBlocked)

  await payload.update({
    collection: 'promotion-applications' as never,
    id: app.id,
    data: { status: 'reversed', reversedAt: new Date().toISOString(), reversalReason: 'smoke-test' } as never,
    overrideAccess: true,
  })
  check('applied → reversed 允許（回沖路徑）', true)

  let delBlocked = false
  try {
    await payload.delete({ collection: 'promotion-applications' as never, id: app.id, overrideAccess: true })
  } catch {
    delBlocked = true
  }
  check('刪除 application → 被擋', delBlocked)

  // 清理（applications 刻意不可刪 → 留 reversed 測試列）
  await payload.delete({ collection: 'promotion-rules' as never, id: rule.id, overrideAccess: true })
  await payload.delete({ collection: 'marketing-campaigns', id: campaign.id, overrideAccess: true })
  log('cleanup done（測試 application 留存為 reversed，reason=smoke-test）')

  log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
  clearInterval(keepAlive)
  process.exit(failures === 0 ? 0 : 1)
}

await main().catch((err) => {
  console.error('[verify-ce] FATAL', err)
  process.exit(1)
})
