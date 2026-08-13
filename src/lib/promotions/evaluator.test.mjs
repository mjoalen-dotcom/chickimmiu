import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'

/**
 * Promotion Evaluator 測試矩陣（CHIC Commerce OS P0-B）。
 * 跑法：node --test src/lib/promotions/evaluator.test.mjs
 *
 * 覆蓋 doc §11.1：0/1/2/3 件、排除品、贈品/加價購/Bundle 行、封頂、rounding、
 * 毛利底線、預算、每人/總量上限、exclusiveGroup、stackableWith、排程邊界、
 * 免運、第 N 件折、折上折順序、deterministic、無效規則隔離。
 *
 * evaluator.ts 內有 extensionless 相對 import → 註冊 resolve hook 補 `.ts` 重試
 * （與 readRewardAward.test.mjs 同一手法）。
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw err
    }
  },
})

const { evaluatePromotions, allocateProportional } = await import('./evaluator.ts')

const NOW = '2026-08-13T12:00:00.000Z'

function line(partial) {
  return {
    productId: partial.lineId.replace(/^L/, 'P'),
    unitPrice: 1000,
    quantity: 1,
    categoryIds: [],
    tags: [],
    ...partial,
  }
}

/** 72H 主打規則：任選 2 件現折 NT$1,000 */
function mix2Rule(partial = {}) {
  return {
    ruleKey: 'c72:mix2-fixed1000:v1',
    ruleDocId: 101,
    campaignId: 'c72',
    slug: 'mix2-fixed1000',
    version: 1,
    source: 'campaign_rule',
    benefitClass: 'item_promo',
    priority: 300,
    scope: { excludeTags: ['final-sale'] },
    when: [{ type: 'eligible_item_quantity_gte', value: 2 }],
    then: {
      type: 'fixed_discount_per_group',
      groupSize: 2,
      amount: 1000,
      repeatMode: 'once_per_order',
      allocation: 'proportional_to_eligible_lines',
    },
    stacking: { exclusiveGroup: 'mix-match-main', stackableWith: 'all' },
    guardrails: {},
    startAt: '2026-08-13T00:00:00.000Z',
    endAt: '2026-08-16T00:00:00.000Z',
    ...partial,
  }
}

function input(partial = {}) {
  return {
    now: NOW,
    channel: 'web',
    lines: [],
    member: { userId: 'u1', tierSlug: 'silver', segmentSlugs: [] },
    shippingFee: 60,
    rules: [],
    usage: { perUserApplied: {}, totalApplied: {}, budgetRemaining: { c72: null } },
    ...partial,
  }
}

// ── allocateProportional ────────────────────────────────────────────────────

test('allocate：比例分攤總和恰等於折扣（3000/2000 → 600/400）', () => {
  const r = allocateProportional(1000, [
    { lineId: 'a', weight: 3000, capacity: 3000 },
    { lineId: 'b', weight: 2000, capacity: 2000 },
  ])
  assert.deepEqual(r, [
    { lineId: 'a', amount: 600 },
    { lineId: 'b', amount: 400 },
  ])
})

test('allocate：rounding — 999 分三份總和仍 = 999', () => {
  const r = allocateProportional(999, [
    { lineId: 'a', weight: 1000, capacity: 1000 },
    { lineId: 'b', weight: 1000, capacity: 1000 },
    { lineId: 'c', weight: 1000, capacity: 1000 },
  ])
  assert.equal(r.reduce((s, x) => s + x.amount, 0), 999)
  for (const x of r) assert.ok(x.amount === 333 || x.amount === 334)
})

test('allocate：capacity 封頂後溢出轉分其他行', () => {
  const r = allocateProportional(1000, [
    { lineId: 'a', weight: 900, capacity: 100 },
    { lineId: 'b', weight: 100, capacity: 950 },
  ])
  assert.equal(r.reduce((s, x) => s + x.amount, 0), 1000)
  assert.equal(r.find((x) => x.lineId === 'a').amount, 100)
  assert.equal(r.find((x) => x.lineId === 'b').amount, 900)
})

test('allocate：總容量不足時分到容量上限為止', () => {
  const r = allocateProportional(1000, [{ lineId: 'a', weight: 800, capacity: 800 }])
  assert.equal(r[0].amount, 800)
})

// ── 任選 2 件折 1000（72H 主場景）───────────────────────────────────────────

test('mix2：0 件 eligible → no_eligible_lines', () => {
  const res = evaluatePromotions(input({ rules: [mix2Rule()], lines: [] }))
  assert.equal(res.applications.length, 0)
  assert.equal(res.rejections[0]?.reasonCodes[0], 'no_eligible_lines')
})

test('mix2：1 件 → condition_not_met，progress 1/2 未解鎖', () => {
  const res = evaluatePromotions(
    input({ rules: [mix2Rule()], lines: [line({ lineId: 'L1', unitPrice: 1500 })] }),
  )
  assert.equal(res.applications.length, 0)
  assert.equal(res.rejections[0]?.reasonCodes[0], 'condition_not_met')
  const p = res.progress[0]
  assert.ok(p)
  assert.equal(p.current, 1)
  assert.equal(p.target, 2)
  assert.equal(p.remaining, 1)
  assert.equal(p.unlocked, false)
})

test('mix2：2 件 → 折 1000，比例分攤加總 = 1000，UNLOCKED', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [line({ lineId: 'L1', unitPrice: 1800 }), line({ lineId: 'L2', unitPrice: 1200 })],
    }),
  )
  assert.equal(res.applications.length, 1)
  const app = res.applications[0]
  assert.equal(app.discountAmount, 1000)
  assert.equal(app.groupsApplied, 1)
  assert.equal(app.allocations.reduce((s, a) => s + a.amount, 0), 1000)
  assert.equal(app.allocations.find((a) => a.lineId === 'L1').amount, 600)
  assert.equal(app.allocations.find((a) => a.lineId === 'L2').amount, 400)
  assert.equal(res.progress[0]?.unlocked, true)
  assert.equal(res.discountTotal, 1000)
})

test('mix2：3 件 once_per_order → 仍只折 1000', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [
        line({ lineId: 'L1', unitPrice: 1800 }),
        line({ lineId: 'L2', unitPrice: 1200 }),
        line({ lineId: 'L3', unitPrice: 900 }),
      ],
    }),
  )
  assert.equal(res.applications[0]?.discountAmount, 1000)
  assert.equal(res.applications[0]?.groupsApplied, 1)
})

test('mix2：every_full_group — 5 件 → 2 組 → 2000', () => {
  const rule = mix2Rule({
    then: {
      type: 'fixed_discount_per_group',
      groupSize: 2,
      amount: 1000,
      repeatMode: 'every_full_group',
      allocation: 'proportional_to_eligible_lines',
    },
  })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [
        line({ lineId: 'L1', unitPrice: 1500, quantity: 3 }),
        line({ lineId: 'L2', unitPrice: 2000, quantity: 2 }),
      ],
    }),
  )
  assert.equal(res.applications[0]?.discountAmount, 2000)
  assert.equal(res.applications[0]?.groupsApplied, 2)
})

test('mix2：同款 quantity 2 也算 2 件', () => {
  const res = evaluatePromotions(
    input({ rules: [mix2Rule()], lines: [line({ lineId: 'L1', unitPrice: 990, quantity: 2 })] }),
  )
  assert.equal(res.applications.length, 1)
  assert.equal(res.applications[0].discountAmount, 1000)
})

test('mix2：折扣被 eligible 小計封頂（共 800 → 折 800 不負數）', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [line({ lineId: 'L1', unitPrice: 500 }), line({ lineId: 'L2', unitPrice: 300 })],
    }),
  )
  assert.equal(res.applications[0]?.discountAmount, 800)
})

test('mix2：final-sale 排除品不算件數', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2', tags: ['final-sale'] })],
    }),
  )
  assert.equal(res.applications.length, 0)
  assert.equal(res.rejections[0]?.reasonCodes[0], 'condition_not_met')
})

test('mix2：贈品/加價購/Bundle 行預設不參與（零元贈品不可湊件）', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [
        line({ lineId: 'L1' }),
        line({ lineId: 'G1', unitPrice: 0, isGiftLine: true }),
        line({ lineId: 'A1', unitPrice: 199, isAddOnLine: true }),
        line({ lineId: 'B1', unitPrice: 999, bundleId: 7 }),
      ],
    }),
  )
  assert.equal(res.applications.length, 0)
})

test('mix2：includeCategories 白名單外不參與', () => {
  const rule = mix2Rule({ scope: { includeCategories: [5] } })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [line({ lineId: 'L1', categoryIds: [5] }), line({ lineId: 'L2', categoryIds: [9] })],
    }),
  )
  assert.equal(res.applications.length, 0)
})

// ── 排程邊界 ────────────────────────────────────────────────────────────────

test('排程：開始前 → not_started', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule({ startAt: '2026-08-14T00:00:00.000Z' })],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'not_started')
})

test('排程：endAt 恰為 now → ended（結束即失效）', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule({ endAt: NOW })],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'ended')
})

test('排程：結束前 1ms 仍套用', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule({ endAt: '2026-08-13T12:00:00.001Z' })],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
    }),
  )
  assert.equal(res.applications.length, 1)
})

// ── 護欄（fail closed）──────────────────────────────────────────────────────

test('護欄：折後毛利 < floor → margin_floor_violation', () => {
  const rule = mix2Rule({ guardrails: { minimumGrossMarginPct: 30 } })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [line({ lineId: 'L1', unitCost: 700 }), line({ lineId: 'L2', unitCost: 700 })],
    }),
  )
  assert.equal(res.applications.length, 0)
  assert.equal(res.rejections[0]?.reasonCodes[0], 'margin_floor_violation')
})

test('護欄：折後毛利 ≥ floor → 套用', () => {
  const rule = mix2Rule({ guardrails: { minimumGrossMarginPct: 30 } })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [
        line({ lineId: 'L1', unitPrice: 3000, unitCost: 500 }),
        line({ lineId: 'L2', unitPrice: 3000, unitCost: 500 }),
      ],
    }),
  )
  assert.equal(res.applications.length, 1)
})

test('護欄：設 margin floor 但缺成本 → missing_cost_data（fail closed）', () => {
  const rule = mix2Rule({ guardrails: { minimumGrossMarginPct: 30 } })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [line({ lineId: 'L1', unitCost: 100 }), line({ lineId: 'L2', unitCost: null })],
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'missing_cost_data')
})

test('護欄：預算剩 500 < 折 1000 → budget_exhausted', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
      usage: { perUserApplied: {}, totalApplied: {}, budgetRemaining: { c72: 500 } },
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'budget_exhausted')
})

test('護欄：campaign_rule 缺 budgetRemaining 條目 → budget_unknown（fail closed）', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
      usage: { perUserApplied: {}, totalApplied: {}, budgetRemaining: {} },
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'budget_unknown')
})

test('護欄：每人上限已達 → per_user_limit_reached', () => {
  const rule = mix2Rule({ guardrails: { perUserLimit: 1 } })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
      usage: {
        perUserApplied: { 'c72:mix2-fixed1000:v1': 1 },
        totalApplied: {},
        budgetRemaining: { c72: null },
      },
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'per_user_limit_reached')
})

test('護欄：全活動總量達上限 → total_usage_limit_reached', () => {
  const rule = mix2Rule({ guardrails: { totalUsageLimit: 100 } })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
      usage: {
        perUserApplied: {},
        totalApplied: { 'c72:mix2-fixed1000:v1': 100 },
        budgetRemaining: { c72: null },
      },
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'total_usage_limit_reached')
})

test('護欄：blocked 會員 → member_blocked', () => {
  const res = evaluatePromotions(
    input({
      rules: [mix2Rule()],
      lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })],
      member: { userId: 'u1', segmentSlugs: ['blocked'], blocked: true },
    }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'member_blocked')
})

test('護欄：maxBenefitPerOrder — 3 組 3000 封頂到 1000', () => {
  const rule = mix2Rule({
    then: {
      type: 'fixed_discount_per_group',
      groupSize: 2,
      amount: 1000,
      repeatMode: 'every_full_group',
      allocation: 'proportional_to_eligible_lines',
    },
    stacking: { stackableWith: 'all', maxBenefitPerOrder: 1000 },
  })
  const res = evaluatePromotions(
    input({ rules: [rule], lines: [line({ lineId: 'L1', unitPrice: 2000, quantity: 6 })] }),
  )
  assert.equal(res.applications[0]?.discountAmount, 1000)
})

// ── 疊加 ────────────────────────────────────────────────────────────────────

test('疊加：同 exclusiveGroup 只套 priority 小者', () => {
  const a = mix2Rule({ ruleKey: 'c72:a:v1', slug: 'a', priority: 100 })
  const b = mix2Rule({ ruleKey: 'c72:b:v1', slug: 'b', priority: 200 })
  const res = evaluatePromotions(
    input({ rules: [b, a], lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })] }),
  )
  assert.equal(res.applications.length, 1)
  assert.equal(res.applications[0].slug, 'a')
  assert.equal(res.rejections[0]?.reasonCodes[0], 'exclusive_group_conflict')
})

test('疊加：stackableWith 白名單雙向檢查擋異類', () => {
  const itemRule = mix2Rule()
  const orderRule = mix2Rule({
    ruleKey: 'c72:ord:v1',
    slug: 'ord',
    benefitClass: 'order_promo',
    when: [{ type: 'order_subtotal_gte', value: 1000 }],
    then: { type: 'order_fixed_discount', amount: 200, allocation: 'proportional_to_eligible_lines' },
    stacking: { stackableWith: ['shipping'] },
  })
  const res = evaluatePromotions(
    input({ rules: [itemRule, orderRule], lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })] }),
  )
  assert.equal(res.applications.length, 1)
  assert.equal(res.rejections[0]?.reasonCodes[0], 'stacking_conflict')
})

test('疊加：折上折順序 — item 折 1000 後訂單 9 折以剩餘為基數', () => {
  const itemRule = mix2Rule()
  const orderRule = mix2Rule({
    ruleKey: 'c72:ord10:v1',
    slug: 'ord10',
    benefitClass: 'order_promo',
    scope: {},
    when: [],
    then: { type: 'order_percent_discount', percentOff: 10, allocation: 'proportional_to_eligible_lines' },
    stacking: { stackableWith: 'all' },
  })
  const res = evaluatePromotions(
    input({
      rules: [orderRule, itemRule],
      lines: [line({ lineId: 'L1', unitPrice: 2000 }), line({ lineId: 'L2', unitPrice: 1000 })],
    }),
  )
  assert.equal(res.applications.length, 2)
  assert.equal(res.applications[0].slug, 'mix2-fixed1000')
  assert.equal(res.applications[1].slug, 'ord10')
  assert.equal(res.applications[1].discountAmount, 200)
  assert.equal(res.discountTotal, 1200)
})

// ── 其他效果 ────────────────────────────────────────────────────────────────

test('效果：第 2 件 6 折 — 折在較便宜那件', () => {
  const rule = mix2Rule({
    ruleKey: 'c72:2nd60:v1',
    slug: '2nd60',
    then: { type: 'percent_discount_nth_unit', groupSize: 2, percentOff: 40, repeatMode: 'once_per_order' },
  })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [line({ lineId: 'L1', unitPrice: 1000 }), line({ lineId: 'L2', unitPrice: 500 })],
    }),
  )
  assert.equal(res.applications[0]?.discountAmount, 200)
  assert.equal(res.applications[0]?.allocations[0]?.lineId, 'L2')
})

test('效果：第 3 件免費（percentOff 100, every_full_group）', () => {
  const rule = mix2Rule({
    ruleKey: 'c72:3rdfree:v1',
    slug: '3rdfree',
    when: [{ type: 'eligible_item_quantity_gte', value: 3 }],
    then: { type: 'percent_discount_nth_unit', groupSize: 3, percentOff: 100, repeatMode: 'every_full_group' },
  })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [
        line({ lineId: 'L1', unitPrice: 900, quantity: 2 }),
        line({ lineId: 'L2', unitPrice: 800, quantity: 2 }),
        line({ lineId: 'L3', unitPrice: 700, quantity: 2 }),
      ],
    }),
  )
  // 高價先湊組：[900,900,800] 折 800、[800,700,700] 折 700 → 1500
  assert.equal(res.applications[0]?.discountAmount, 1500)
  assert.equal(res.applications[0]?.groupsApplied, 2)
})

test('效果：任選 2 件 8 折（cheapest_first）— 3 件折最便宜 2 件', () => {
  const rule = mix2Rule({
    ruleKey: 'c72:mix80:v1',
    slug: 'mix80',
    then: {
      type: 'percent_discount_per_group',
      groupSize: 2,
      percentOff: 20,
      repeatMode: 'once_per_order',
      unitSelection: 'cheapest_first',
    },
  })
  const res = evaluatePromotions(
    input({
      rules: [rule],
      lines: [
        line({ lineId: 'L1', unitPrice: 2000 }),
        line({ lineId: 'L2', unitPrice: 1000 }),
        line({ lineId: 'L3', unitPrice: 600 }),
      ],
    }),
  )
  assert.equal(res.applications[0]?.discountAmount, 320)
})

test('效果：滿 3000 折 300 — 2999 未達標含 progress、3000 套用', () => {
  const rule = mix2Rule({
    ruleKey: 'c72:full3000:v1',
    slug: 'full3000',
    benefitClass: 'order_promo',
    scope: {},
    when: [{ type: 'eligible_subtotal_gte', value: 3000 }],
    then: { type: 'order_fixed_discount', amount: 300, allocation: 'proportional_to_eligible_lines' },
    stacking: { stackableWith: 'all' },
  })
  const below = evaluatePromotions(input({ rules: [rule], lines: [line({ lineId: 'L1', unitPrice: 2999 })] }))
  assert.equal(below.applications.length, 0)
  const p = below.progress[0]
  assert.ok(p)
  assert.equal(p.kind, 'subtotal')
  assert.equal(p.remaining, 1)
  const at = evaluatePromotions(input({ rules: [rule], lines: [line({ lineId: 'L1', unitPrice: 3000 })] }))
  assert.equal(at.applications[0]?.discountAmount, 300)
})

test('效果：免運抵扣 = 運費；第二條免運 → zero_discount', () => {
  const ship1 = mix2Rule({
    ruleKey: 'c72:ship1:v1',
    slug: 'ship1',
    benefitClass: 'shipping',
    scope: {},
    when: [],
    then: { type: 'free_shipping' },
    stacking: { stackableWith: 'all' },
  })
  const ship2 = { ...ship1, ruleKey: 'c72:ship2:v1', slug: 'ship2' }
  const res = evaluatePromotions(
    input({ rules: [ship1, ship2], lines: [line({ lineId: 'L1' })], shippingFee: 80 }),
  )
  assert.equal(res.shippingDiscountTotal, 80)
  assert.equal(res.applications.filter((a) => a.effectType === 'free_shipping').length, 1)
  assert.ok(res.rejections.some((r) => r.reasonCodes[0] === 'zero_discount'))
})

test('效果：贈品/點數倍率/grant_reward → reward intents 不折價', () => {
  const gift = mix2Rule({
    ruleKey: 'c72:gift:v1',
    slug: 'gift',
    benefitClass: 'order_promo',
    scope: {},
    when: [{ type: 'order_subtotal_gte', value: 1000 }],
    then: { type: 'gift_item', productId: 99, quantity: 1 },
    stacking: { stackableWith: 'all' },
  })
  const points = mix2Rule({
    ruleKey: 'c72:pts:v1',
    slug: 'pts',
    benefitClass: 'order_promo',
    scope: {},
    when: [],
    then: { type: 'points_multiplier', multiplier: 1.5 },
    stacking: { stackableWith: 'all' },
  })
  const key = mix2Rule({
    ruleKey: 'c72:key:v1',
    slug: 'key',
    benefitClass: 'order_promo',
    scope: {},
    when: [],
    then: { type: 'grant_reward', rewardKey: 'mystery-key', quantity: 1 },
    stacking: { stackableWith: 'all' },
  })
  const res = evaluatePromotions(
    input({ rules: [gift, points, key], lines: [line({ lineId: 'L1', unitPrice: 1200 })] }),
  )
  assert.equal(res.discountTotal, 0)
  assert.equal(res.rewardIntents.length, 3)
  assert.deepEqual(
    res.rewardIntents.map((r) => r.type).sort(),
    ['gift_item', 'grant_reward', 'points_multiplier'],
  )
})

test('效果：percent 折扣 floor 到 0 → zero_discount 不留 0 元 application', () => {
  const rule = mix2Rule({
    ruleKey: 'c72:tiny:v1',
    slug: 'tiny',
    when: [],
    then: { type: 'percent_discount_nth_unit', groupSize: 2, percentOff: 40, repeatMode: 'once_per_order' },
  })
  const res = evaluatePromotions(
    input({ rules: [rule], lines: [line({ lineId: 'L1', unitPrice: 1, quantity: 2 })] }),
  )
  assert.equal(res.applications.length, 0)
  assert.equal(res.rejections[0]?.reasonCodes[0], 'zero_discount')
})

// ── 會員 / 通路條件 ─────────────────────────────────────────────────────────

test('條件：member_tier_in 不符 → condition_not_met', () => {
  const rule = mix2Rule({ when: [{ type: 'member_tier_in', values: ['gold'] }] })
  const res = evaluatePromotions(
    input({ rules: [rule], lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })] }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'condition_not_met')
})

test('條件：訪客不通過 is_member true', () => {
  const rule = mix2Rule({ when: [{ type: 'is_member', value: true }] })
  const res = evaluatePromotions(
    input({ rules: [rule], member: null, lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })] }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'condition_not_met')
})

test('條件：channel_in 限 app → web 不套用', () => {
  const rule = mix2Rule({ when: [{ type: 'channel_in', values: ['app'] }] })
  const res = evaluatePromotions(
    input({ rules: [rule], lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })] }),
  )
  assert.equal(res.rejections[0]?.reasonCodes[0], 'condition_not_met')
})

// ── Determinism / 隔離 ──────────────────────────────────────────────────────

test('deterministic：同輸入跑兩次 deep equal', () => {
  const i = input({
    rules: [
      mix2Rule(),
      mix2Rule({
        ruleKey: 'c72:ord10:v1',
        slug: 'ord10',
        benefitClass: 'order_promo',
        scope: {},
        when: [],
        then: { type: 'order_percent_discount', percentOff: 10, allocation: 'proportional_to_eligible_lines' },
        stacking: { stackableWith: 'all' },
      }),
    ],
    lines: [
      line({ lineId: 'L1', unitPrice: 1999 }),
      line({ lineId: 'L2', unitPrice: 1499, quantity: 2 }),
      line({ lineId: 'L3', unitPrice: 333, tags: ['final-sale'] }),
    ],
  })
  assert.deepEqual(evaluatePromotions(i), evaluatePromotions(structuredClone(i)))
})

test('隔離：無效規則（version 0）→ invalid_rule 不中斷其他規則', () => {
  const bad = mix2Rule({ ruleKey: 'c72:bad:v0', slug: 'bad', version: 0 })
  const res = evaluatePromotions(
    input({ rules: [bad, mix2Rule()], lines: [line({ lineId: 'L1' }), line({ lineId: 'L2' })] }),
  )
  assert.equal(res.applications.length, 1)
  assert.ok(res.rejections.some((r) => r.reasonCodes[0] === 'invalid_rule'))
})
