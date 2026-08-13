/**
 * Promotion Evaluator — 無 I/O、deterministic 純函式（CHIC Commerce OS P0-B）
 *
 * 不變量：
 * - 同一組 snapshot 輸入 + 同版本規則 → 永遠同輸出（無 Date.now / 無隨機 / 排序皆有 tiebreaker）。
 * - 所有金額 TWD 整數；折扣一律無條件捨去（floor，對商家有利）；allocation 用最大餘數法，
 *   保證 Σ(line allocations) === discountAmount。
 * - 任何行的累計折抵不會超過該行剩餘價值（不產生負數行）。
 * - 護欄資料不足（缺成本 / 預算未知）→ fail closed：整條規則不套用並記 reason code。
 * - client 傳入的折扣金額在這裡不存在：輸入只有伺服器讀出的價格 / 成本 / 規則 snapshot。
 *
 * 計算順序（doc §7.3）：item_promo → order_promo → coupon → shipping。
 * 同 phase 內 priority 小者先；再同則 ruleKey 字典序。
 * 百分比單件效果（任N件X折 / 第N件折）以「原始單價」為基數（對客透明），
 * 但受該行剩餘價值封頂；訂單級百分比以「eligible 剩餘小計」為基數（折上折）。
 */

import type {
  AppliedPromotion,
  CartLineSnapshot,
  EvaluationInput,
  EvaluationResult,
  LineAllocation,
  ProgressHint,
  PromotionCondition,
  PromotionEffect,
  PromotionRuleSnapshot,
  PromotionScope,
  ReasonCode,
  RejectedPromotion,
  RewardIntent,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// 內部狀態
// ─────────────────────────────────────────────────────────────────────────────

interface LineState {
  line: CartLineSnapshot
  /** 原始行小計 */
  originalValue: number
  /** 剩餘可折價值（原始 − 已分攤折抵） */
  remaining: number
}

const PHASE_ORDER: Record<string, number> = {
  item_promo: 1,
  member_tier: 2,
  order_promo: 3,
  coupon: 4,
  shipping: 5,
}

// ─────────────────────────────────────────────────────────────────────────────
// 公用小工具
// ─────────────────────────────────────────────────────────────────────────────

const toKey = (v: number | string | null | undefined): string => String(v ?? '')

/** 最大餘數法比例分攤：Σ結果 = min(total, Σcapacity)，且每項 ≤ capacity */
export function allocateProportional(
  total: number,
  targets: Array<{ lineId: string; weight: number; capacity: number }>,
): LineAllocation[] {
  const capacitySum = targets.reduce((s, t) => s + t.capacity, 0)
  let toAllocate = Math.max(0, Math.min(total, capacitySum))
  if (toAllocate === 0) return targets.map((t) => ({ lineId: t.lineId, amount: 0 }))

  const result = new Map<string, number>(targets.map((t) => [t.lineId, 0]))
  // 迭代分攤：容量封頂後把溢出的再分給還有容量的行（最多 targets.length 輪收斂）
  let remainingTargets = targets.map((t) => ({ ...t }))
  while (toAllocate > 0 && remainingTargets.length > 0) {
    const weightSum = remainingTargets.reduce((s, t) => s + t.weight, 0)
    const shares = remainingTargets.map((t) => {
      const exact = weightSum > 0 ? (toAllocate * t.weight) / weightSum : toAllocate / remainingTargets.length
      return { t, base: Math.floor(exact), frac: exact - Math.floor(exact) }
    })
    let assigned = shares.reduce((s, x) => s + x.base, 0)
    // 最大餘數法補齊差額（frac 大者先；tie 用 lineId 字典序）
    const byFrac = [...shares].sort((a, b) => b.frac - a.frac || a.t.lineId.localeCompare(b.t.lineId))
    let leftover = toAllocate - assigned
    for (const s of byFrac) {
      if (leftover <= 0) break
      s.base += 1
      leftover -= 1
    }
    // 套 capacity 上限
    let consumed = 0
    const next: typeof remainingTargets = []
    for (const s of shares) {
      const cap = s.t.capacity
      const give = Math.min(s.base, cap)
      result.set(s.t.lineId, (result.get(s.t.lineId) ?? 0) + give)
      consumed += give
      const capLeft = cap - give
      if (capLeft > 0) next.push({ lineId: s.t.lineId, weight: s.t.weight, capacity: capLeft })
    }
    toAllocate -= consumed
    if (consumed === 0) break // 防禦：無法再分（理論上不會發生）
    remainingTargets = next
  }
  return targets.map((t) => ({ lineId: t.lineId, amount: result.get(t.lineId) ?? 0 }))
}

/** 展開成單件清單（依 line 的剩餘均攤容量無關；單件基數 = 原始單價） */
interface Unit {
  lineId: string
  unitPrice: number
}

function expandUnits(lines: LineState[]): Unit[] {
  const units: Unit[] = []
  for (const ls of lines) {
    for (let i = 0; i < ls.line.quantity; i++) {
      units.push({ lineId: ls.line.lineId, unitPrice: ls.line.unitPrice })
    }
  }
  return units
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope / 條件
// ─────────────────────────────────────────────────────────────────────────────

function lineMatchesScope(line: CartLineSnapshot, scope: PromotionScope): boolean {
  if ((scope.excludeGiftLines ?? true) && line.isGiftLine) return false
  if ((scope.excludeAddOnLines ?? true) && line.isAddOnLine) return false
  if ((scope.excludeBundleLines ?? true) && line.bundleId != null) return false
  if (line.unitPrice <= 0) return false

  const pid = toKey(line.productId)
  const cats = new Set(line.categoryIds.map(toKey))
  const tags = new Set(line.tags)

  if (scope.excludeProducts?.some((p) => toKey(p) === pid)) return false
  if (scope.excludeCategories?.some((c) => cats.has(toKey(c)))) return false
  if (scope.excludeTags?.some((t) => tags.has(t))) return false

  const hasInclude =
    (scope.includeProducts?.length ?? 0) > 0 ||
    (scope.includeCategories?.length ?? 0) > 0 ||
    (scope.includeTags?.length ?? 0) > 0
  if (!hasInclude) return true
  if (scope.includeProducts?.some((p) => toKey(p) === pid)) return true
  if (scope.includeCategories?.some((c) => cats.has(toKey(c)))) return true
  if (scope.includeTags?.some((t) => tags.has(t))) return true
  return false
}

interface ConditionContext {
  eligibleQuantity: number
  eligibleSubtotal: number
  orderSubtotal: number
  member: EvaluationInput['member']
  channel: EvaluationInput['channel']
}

function checkConditions(conditions: PromotionCondition[], ctx: ConditionContext): boolean {
  for (const c of conditions) {
    switch (c.type) {
      case 'eligible_item_quantity_gte':
        if (ctx.eligibleQuantity < c.value) return false
        break
      case 'eligible_subtotal_gte':
        if (ctx.eligibleSubtotal < c.value) return false
        break
      case 'order_subtotal_gte':
        if (ctx.orderSubtotal < c.value) return false
        break
      case 'member_tier_in':
        if (!ctx.member?.tierSlug || !c.values.includes(ctx.member.tierSlug)) return false
        break
      case 'member_tier_not_in':
        if (ctx.member?.tierSlug && c.values.includes(ctx.member.tierSlug)) return false
        break
      case 'member_segment_in':
        if (!ctx.member || !c.values.some((v) => ctx.member!.segmentSlugs.includes(v))) return false
        break
      case 'member_segment_not_in':
        if (ctx.member && c.values.some((v) => ctx.member!.segmentSlugs.includes(v))) return false
        break
      case 'is_member':
        if (Boolean(ctx.member?.userId) !== c.value) return false
        break
      case 'first_purchase':
        if (Boolean(ctx.member?.isFirstPurchase) !== c.value) return false
        break
      case 'channel_in':
        if (!c.values.includes(ctx.channel)) return false
        break
      default: {
        // 未知條件型別 → 視為不成立（fail closed）
        return false
      }
    }
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// 效果計算
// ─────────────────────────────────────────────────────────────────────────────

interface EffectOutcome {
  discount: number
  allocations: LineAllocation[]
  groupsApplied: number
}

/** 依 lineId 聚合單件折扣 → allocation（受 remaining 封頂由呼叫端保證基數） */
function unitsToAllocations(discounted: Array<{ lineId: string; amount: number }>): LineAllocation[] {
  const map = new Map<string, number>()
  for (const d of discounted) map.set(d.lineId, (map.get(d.lineId) ?? 0) + d.amount)
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([lineId, amount]) => ({ lineId, amount }))
}

/** 把 allocation 依各行 remaining 封頂（超出部分捨棄 → 折扣同步縮小） */
function capAllocationsByRemaining(
  allocations: LineAllocation[],
  stateByLine: Map<string, LineState>,
): { allocations: LineAllocation[]; total: number } {
  let total = 0
  const capped = allocations.map((a) => {
    const st = stateByLine.get(a.lineId)
    const amount = Math.max(0, Math.min(a.amount, st ? st.remaining : 0))
    total += amount
    return { lineId: a.lineId, amount }
  })
  return { allocations: capped, total }
}

function computeEffect(
  effect: PromotionEffect,
  eligible: LineState[],
  stateByLine: Map<string, LineState>,
): EffectOutcome | null {
  const eligibleRemaining = eligible.reduce((s, l) => s + l.remaining, 0)
  const targets = eligible.map((l) => ({ lineId: l.line.lineId, weight: l.remaining, capacity: l.remaining }))

  switch (effect.type) {
    case 'fixed_discount_per_group': {
      if (effect.groupSize <= 0 || effect.amount <= 0) return null
      const unitCount = eligible.reduce((s, l) => s + l.line.quantity, 0)
      const fullGroups = Math.floor(unitCount / effect.groupSize)
      if (fullGroups < 1) return null
      const groups = effect.repeatMode === 'once_per_order' ? 1 : fullGroups
      const discount = Math.min(groups * effect.amount, eligibleRemaining)
      if (discount <= 0) return null
      return { discount, allocations: allocateProportional(discount, targets), groupsApplied: groups }
    }
    case 'percent_discount_per_group': {
      if (effect.groupSize <= 0 || effect.percentOff <= 0 || effect.percentOff > 100) return null
      const units = expandUnits(eligible)
      units.sort((a, b) =>
        effect.unitSelection === 'most_expensive_first'
          ? b.unitPrice - a.unitPrice || a.lineId.localeCompare(b.lineId)
          : a.unitPrice - b.unitPrice || a.lineId.localeCompare(b.lineId),
      )
      const fullGroups = Math.floor(units.length / effect.groupSize)
      if (fullGroups < 1) return null
      const groups = effect.repeatMode === 'once_per_order' ? 1 : fullGroups
      const chosen = units.slice(0, groups * effect.groupSize)
      const perUnit = chosen.map((u) => ({
        lineId: u.lineId,
        amount: Math.floor((u.unitPrice * effect.percentOff) / 100),
      }))
      const raw = unitsToAllocations(perUnit)
      const { allocations, total } = capAllocationsByRemaining(raw, stateByLine)
      if (total <= 0) return null
      return { discount: total, allocations, groupsApplied: groups }
    }
    case 'percent_discount_nth_unit': {
      if (effect.groupSize <= 1 || effect.percentOff <= 0 || effect.percentOff > 100) return null
      const units = expandUnits(eligible)
      // 高價在前湊組，每組折「組內最便宜」那件（台灣通行的第 2 件折規則）
      units.sort((a, b) => b.unitPrice - a.unitPrice || a.lineId.localeCompare(b.lineId))
      const fullGroups = Math.floor(units.length / effect.groupSize)
      if (fullGroups < 1) return null
      const groups = effect.repeatMode === 'once_per_order' ? 1 : fullGroups
      const perUnit: Array<{ lineId: string; amount: number }> = []
      for (let g = 0; g < groups; g++) {
        const group = units.slice(g * effect.groupSize, (g + 1) * effect.groupSize)
        const cheapest = group[group.length - 1]
        perUnit.push({
          lineId: cheapest.lineId,
          amount: Math.floor((cheapest.unitPrice * effect.percentOff) / 100),
        })
      }
      const raw = unitsToAllocations(perUnit)
      const { allocations, total } = capAllocationsByRemaining(raw, stateByLine)
      if (total <= 0) return null
      return { discount: total, allocations, groupsApplied: groups }
    }
    case 'order_fixed_discount': {
      if (effect.amount <= 0) return null
      const discount = Math.min(effect.amount, eligibleRemaining)
      if (discount <= 0) return null
      return { discount, allocations: allocateProportional(discount, targets), groupsApplied: 1 }
    }
    case 'order_percent_discount': {
      if (effect.percentOff <= 0 || effect.percentOff > 100) return null
      let discount = Math.floor((eligibleRemaining * effect.percentOff) / 100)
      if (effect.maxAmount != null) discount = Math.min(discount, effect.maxAmount)
      discount = Math.min(discount, eligibleRemaining)
      if (discount <= 0) return null
      return { discount, allocations: allocateProportional(discount, targets), groupsApplied: 1 }
    }
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 主函式
// ─────────────────────────────────────────────────────────────────────────────

export function evaluatePromotions(input: EvaluationInput): EvaluationResult {
  const applications: AppliedPromotion[] = []
  const rejections: RejectedPromotion[] = []
  const rewardIntents: RewardIntent[] = []
  const progress: ProgressHint[] = []
  const eligibleSubtotalByRule: Record<string, number> = {}

  const now = Date.parse(input.now)
  const stateByLine = new Map<string, LineState>(
    input.lines.map((line) => {
      const originalValue = line.unitPrice * line.quantity
      return [line.lineId, { line, originalValue, remaining: originalValue }]
    }),
  )
  const orderSubtotal = [...stateByLine.values()].reduce((s, l) => s + l.originalValue, 0)

  // 排序：phase → priority → ruleKey（全 deterministic）
  const sorted = [...input.rules].sort((a, b) => {
    const pa = PHASE_ORDER[a.benefitClass] ?? 99
    const pb = PHASE_ORDER[b.benefitClass] ?? 99
    return pa - pb || a.priority - b.priority || a.ruleKey.localeCompare(b.ruleKey)
  })

  const appliedExclusiveGroups = new Set<string>()
  const appliedRules: AppliedPromotion[] = []
  let shippingDiscountTotal = 0

  const reject = (rule: PromotionRuleSnapshot, codes: ReasonCode[]) => {
    rejections.push({
      ruleKey: rule.ruleKey,
      campaignId: rule.campaignId,
      slug: rule.slug,
      version: rule.version,
      source: rule.source,
      couponCode: rule.couponCode,
      reasonCodes: codes,
    })
  }

  const pushProgress = (rule: PromotionRuleSnapshot, eligible: LineState[], unlocked: boolean) => {
    if (rule.source !== 'campaign_rule') return
    const t = rule.then
    const eligibleQty = eligible.reduce((s, l) => s + l.line.quantity, 0)
    const eligibleSubtotal = eligible.reduce((s, l) => s + l.originalValue, 0)
    if (
      t.type === 'fixed_discount_per_group' ||
      t.type === 'percent_discount_per_group' ||
      t.type === 'percent_discount_nth_unit'
    ) {
      progress.push({
        ruleKey: rule.ruleKey,
        campaignId: rule.campaignId,
        slug: rule.slug,
        kind: 'quantity',
        current: Math.min(eligibleQty, t.groupSize),
        target: t.groupSize,
        remaining: Math.max(0, t.groupSize - eligibleQty),
        unlocked,
        effectType: t.type,
        effectAmount: t.type === 'fixed_discount_per_group' ? t.amount : undefined,
        effectPercentOff: t.type !== 'fixed_discount_per_group' ? t.percentOff : undefined,
      })
      return
    }
    const subtotalCond = rule.when.find(
      (c): c is Extract<PromotionCondition, { type: 'eligible_subtotal_gte' | 'order_subtotal_gte' }> =>
        c.type === 'eligible_subtotal_gte' || c.type === 'order_subtotal_gte',
    )
    if (subtotalCond) {
      const current = subtotalCond.type === 'order_subtotal_gte' ? orderSubtotal : eligibleSubtotal
      progress.push({
        ruleKey: rule.ruleKey,
        campaignId: rule.campaignId,
        slug: rule.slug,
        kind: 'subtotal',
        current: Math.min(current, subtotalCond.value),
        target: subtotalCond.value,
        remaining: Math.max(0, subtotalCond.value - current),
        unlocked,
        effectType: t.type,
        effectAmount: t.type === 'order_fixed_discount' ? t.amount : undefined,
        effectPercentOff: t.type === 'order_percent_discount' ? t.percentOff : undefined,
      })
    }
  }

  for (const rule of sorted) {
    // 0. 結構驗證
    if (!rule.ruleKey || !rule.then || !Array.isArray(rule.when) || rule.version < 1) {
      reject(rule, ['invalid_rule'])
      continue
    }
    // 1. 排程（server 權威時間）
    if (rule.startAt && now < Date.parse(rule.startAt)) {
      reject(rule, ['not_started'])
      continue
    }
    if (rule.endAt && now >= Date.parse(rule.endAt)) {
      reject(rule, ['ended'])
      continue
    }
    // 2. 會員黑名單
    if (input.member?.blocked) {
      reject(rule, ['member_blocked'])
      continue
    }
    // 3. Scope
    const eligible = [...stateByLine.values()]
      .filter((ls) => lineMatchesScope(ls.line, rule.scope))
      .sort((a, b) => a.line.lineId.localeCompare(b.line.lineId))
    const eligibleQuantity = eligible.reduce((s, l) => s + l.line.quantity, 0)
    const eligibleSubtotal = eligible.reduce((s, l) => s + l.originalValue, 0)
    eligibleSubtotalByRule[rule.ruleKey] = eligibleSubtotal

    const isLineEffect =
      rule.then.type !== 'free_shipping' &&
      rule.then.type !== 'gift_item' &&
      rule.then.type !== 'points_multiplier' &&
      rule.then.type !== 'grant_reward'
    if (isLineEffect && eligible.length === 0) {
      reject(rule, ['no_eligible_lines'])
      pushProgress(rule, eligible, false)
      continue
    }
    // 4. 條件
    const condOk = checkConditions(rule.when, {
      eligibleQuantity,
      eligibleSubtotal,
      orderSubtotal,
      member: input.member,
      channel: input.channel,
    })
    if (!condOk) {
      reject(rule, ['condition_not_met'])
      pushProgress(rule, eligible, false)
      continue
    }
    // 5. 使用上限
    const perUserUsed = input.usage.perUserApplied[rule.ruleKey] ?? 0
    if (rule.guardrails.perUserLimit != null && perUserUsed >= rule.guardrails.perUserLimit) {
      reject(rule, ['per_user_limit_reached'])
      pushProgress(rule, eligible, false)
      continue
    }
    const totalUsed = input.usage.totalApplied[rule.ruleKey] ?? 0
    if (rule.guardrails.totalUsageLimit != null && totalUsed >= rule.guardrails.totalUsageLimit) {
      reject(rule, ['total_usage_limit_reached'])
      pushProgress(rule, eligible, false)
      continue
    }
    // 6. 疊加：exclusiveGroup
    if (rule.stacking.exclusiveGroup && appliedExclusiveGroups.has(rule.stacking.exclusiveGroup)) {
      reject(rule, ['exclusive_group_conflict'])
      pushProgress(rule, eligible, false)
      continue
    }
    // 7. 疊加：stackableWith 雙向檢查（'all' = 不限制）
    const stackConflict = appliedRules.some((applied) => {
      const bAllows =
        rule.stacking.stackableWith === 'all' || rule.stacking.stackableWith.includes(applied.benefitClass)
      const aRule = input.rules.find((r) => r.ruleKey === applied.ruleKey)
      const aAllows =
        !aRule || aRule.stacking.stackableWith === 'all' || aRule.stacking.stackableWith.includes(rule.benefitClass)
      return !(bAllows && aAllows)
    })
    if (stackConflict) {
      reject(rule, ['stacking_conflict'])
      pushProgress(rule, eligible, false)
      continue
    }

    // 8. 效果
    let discountAmount = 0
    let shippingDiscountAmount = 0
    let allocations: LineAllocation[] = []
    let groupsApplied = 0

    if (rule.then.type === 'free_shipping') {
      shippingDiscountAmount = Math.max(0, input.shippingFee - shippingDiscountTotal)
      if (shippingDiscountAmount <= 0) {
        reject(rule, ['zero_discount'])
        continue
      }
      groupsApplied = 1
    } else if (
      rule.then.type === 'gift_item' ||
      rule.then.type === 'points_multiplier' ||
      rule.then.type === 'grant_reward'
    ) {
      groupsApplied = 1
    } else {
      const outcome = computeEffect(rule.then, eligible, stateByLine)
      if (!outcome) {
        reject(rule, ['zero_discount'])
        pushProgress(rule, eligible, false)
        continue
      }
      discountAmount = outcome.discount
      allocations = outcome.allocations
      groupsApplied = outcome.groupsApplied

      // 8a. maxBenefitPerOrder 封頂（等比縮，再走一次 capacity 分攤）
      const cap = rule.stacking.maxBenefitPerOrder
      if (cap != null && discountAmount > cap) {
        discountAmount = cap
        allocations = allocateProportional(
          discountAmount,
          eligible.map((l) => ({ lineId: l.line.lineId, weight: l.remaining, capacity: l.remaining })),
        )
      }

      // 8b. 活動預算（fail closed：campaign_rule 一定要有 budgetRemaining 條目）
      if (rule.source === 'campaign_rule') {
        const budgetKey = toKey(rule.campaignId)
        if (!(budgetKey in input.usage.budgetRemaining)) {
          reject(rule, ['budget_unknown'])
          pushProgress(rule, eligible, false)
          continue
        }
        const remainingBudget = input.usage.budgetRemaining[budgetKey]
        if (remainingBudget != null && discountAmount > remainingBudget) {
          reject(rule, ['budget_exhausted'])
          pushProgress(rule, eligible, false)
          continue
        }
      }

      // 8c. 毛利底線（fail closed：缺任一 eligible 行成本 → 整條不套用）
      const floor = rule.guardrails.minimumGrossMarginPct
      if (floor != null) {
        const missingCost = eligible.some((l) => l.line.unitCost == null)
        if (missingCost) {
          reject(rule, ['missing_cost_data'])
          pushProgress(rule, eligible, false)
          continue
        }
        const allocByLine = new Map(allocations.map((a) => [a.lineId, a.amount]))
        let valueAfter = 0
        let costSum = 0
        for (const l of eligible) {
          valueAfter += l.remaining - (allocByLine.get(l.line.lineId) ?? 0)
          costSum += (l.line.unitCost ?? 0) * l.line.quantity
        }
        const marginOk = valueAfter > 0 && ((valueAfter - costSum) / valueAfter) * 100 >= floor
        if (!marginOk) {
          reject(rule, ['margin_floor_violation'])
          pushProgress(rule, eligible, false)
          continue
        }
      }

      if (discountAmount <= 0) {
        reject(rule, ['zero_discount'])
        pushProgress(rule, eligible, false)
        continue
      }
    }

    // 9. 落地：更新行剩餘價值
    for (const a of allocations) {
      const st = stateByLine.get(a.lineId)
      if (st) st.remaining = Math.max(0, st.remaining - a.amount)
    }
    shippingDiscountTotal += shippingDiscountAmount
    if (rule.stacking.exclusiveGroup) appliedExclusiveGroups.add(rule.stacking.exclusiveGroup)

    if (rule.then.type === 'gift_item') {
      rewardIntents.push({
        ruleKey: rule.ruleKey,
        campaignId: rule.campaignId,
        type: 'gift_item',
        productId: rule.then.productId,
        quantity: rule.then.quantity,
      })
    } else if (rule.then.type === 'points_multiplier') {
      rewardIntents.push({
        ruleKey: rule.ruleKey,
        campaignId: rule.campaignId,
        type: 'points_multiplier',
        multiplier: rule.then.multiplier,
      })
    } else if (rule.then.type === 'grant_reward') {
      rewardIntents.push({
        ruleKey: rule.ruleKey,
        campaignId: rule.campaignId,
        type: 'grant_reward',
        rewardKey: rule.then.rewardKey,
        quantity: rule.then.quantity,
      })
    }

    const application: AppliedPromotion = {
      ruleKey: rule.ruleKey,
      ruleDocId: rule.ruleDocId,
      campaignId: rule.campaignId,
      slug: rule.slug,
      version: rule.version,
      source: rule.source,
      couponId: rule.couponId,
      couponCode: rule.couponCode,
      benefitClass: rule.benefitClass,
      effectType: rule.then.type,
      discountAmount,
      shippingDiscountAmount,
      allocations: allocations.filter((a) => a.amount > 0),
      groupsApplied,
      reasonCodes: ['applied'],
    }
    applications.push(application)
    appliedRules.push(application)
    pushProgress(rule, eligible, true)
  }

  return {
    applications,
    rejections,
    rewardIntents,
    progress,
    discountTotal: applications.reduce((s, a) => s + a.discountAmount, 0),
    shippingDiscountTotal,
    eligibleSubtotalByRule,
  }
}
