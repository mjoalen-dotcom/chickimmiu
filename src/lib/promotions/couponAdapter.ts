/**
 * Coupon Adapter — 讓 Coupons 走同一個 Promotion Evaluator（CHIC Commerce OS P0-B）
 *
 * 不改 coupons schema、不複製折扣公式：把 coupon doc 轉成 PromotionRuleSnapshot，
 * 疊加/上限/排程/範圍全部交給 evaluator。既有 apply-coupon route 保留為 UX 預覽，
 * 建單時以本 adapter + evaluator 的結果為準。
 *
 * 疊加語意（沿用現行 apply-coupon 規則）：
 * - 多券並存的前提是「每一張都 stackable」→ 這裡先做 pairwise 過濾（提交順序優先）。
 * - 非 stackable 券：不與其他券並存，也不與活動促銷疊加（stackableWith 限
 *   member_tier / shipping），避免隱式累加。
 * - coupon.exclusiveGroup 相同者互斥（映射到 evaluator 的 exclusiveGroup）。
 */
import type { Payload } from 'payload'

import type { PromotionCondition, PromotionRuleSnapshot } from './types'

const relId = (v: unknown): number | string | null => {
  if (v == null) return null
  if (typeof v === 'object') return ((v as Record<string, unknown>).id as number | string) ?? null
  return v as number | string
}

export interface CouponResolution {
  snapshots: PromotionRuleSnapshot[]
  /** 併入 UsageSnapshot 的用量條目 */
  perUserApplied: Record<string, number>
  totalApplied: Record<string, number>
  /** 直接被拒（不進 evaluator）的券與原因 */
  rejected: Array<{ code: string; reason: string }>
}

function couponToSnapshot(
  coupon: Record<string, unknown>,
  orderIndex: number,
  tierSlugById: Map<string, string>,
): PromotionRuleSnapshot | null {
  const code = String(coupon.code ?? '').toUpperCase()
  if (!code) return null
  const conditions = (coupon.conditions ?? {}) as Record<string, unknown>
  const discountType = String(coupon.discountType ?? '')
  const discountValue = typeof coupon.discountValue === 'number' ? coupon.discountValue : 0
  const stackable = Boolean(coupon.stackable)

  let then: PromotionRuleSnapshot['then'] | null = null
  let benefitClass: PromotionRuleSnapshot['benefitClass'] = 'coupon'
  if (discountType === 'percentage') {
    then = {
      type: 'order_percent_discount',
      percentOff: discountValue,
      maxAmount: typeof coupon.maxDiscountAmount === 'number' ? coupon.maxDiscountAmount : undefined,
      allocation: 'proportional_to_eligible_lines',
    }
  } else if (discountType === 'fixed') {
    then = { type: 'order_fixed_discount', amount: discountValue, allocation: 'proportional_to_eligible_lines' }
  } else if (discountType === 'free_shipping') {
    then = { type: 'free_shipping' }
    benefitClass = 'shipping'
  } else {
    return null
  }

  const when: PromotionCondition[] = []
  if (typeof coupon.minOrderAmount === 'number' && coupon.minOrderAmount > 0) {
    when.push({ type: 'order_subtotal_gte', value: coupon.minOrderAmount })
  }
  const tierRequired = relId(conditions.tierRequired)
  if (tierRequired != null) {
    when.push({
      type: 'member_tier_in',
      values: [tierSlugById.get(String(tierRequired)) ?? `__unknown_${tierRequired}`],
    })
  }
  if (conditions.firstOrderOnly) when.push({ type: 'first_purchase', value: true })

  const usageLimitPerUser = typeof coupon.usageLimitPerUser === 'number' ? coupon.usageLimitPerUser : 1
  const usageLimit = typeof coupon.usageLimit === 'number' ? coupon.usageLimit : undefined

  return {
    ruleKey: `coupon:${code}:v1`,
    ruleDocId: null,
    campaignId: null,
    slug: `coupon-${code.toLowerCase()}`,
    version: 1,
    source: 'coupon',
    couponId: (coupon.id as number | string) ?? undefined,
    couponCode: code,
    benefitClass,
    // 券在 coupon phase 內按提交順序評估
    priority: 500 + orderIndex,
    scope: {
      includeProducts: Array.isArray(conditions.productInclude)
        ? (conditions.productInclude.map(relId).filter((x) => x != null) as Array<number | string>)
        : [],
      excludeProducts: Array.isArray(conditions.productExclude)
        ? (conditions.productExclude.map(relId).filter((x) => x != null) as Array<number | string>)
        : [],
    },
    when,
    then,
    stacking: {
      exclusiveGroup:
        typeof coupon.exclusiveGroup === 'string' && coupon.exclusiveGroup
          ? `coupon-x-${coupon.exclusiveGroup}`
          : stackable
            ? undefined
            : '__coupon_exclusive__',
      stackableWith: stackable ? 'all' : ['member_tier', 'shipping'],
    },
    guardrails: {
      perUserLimit: usageLimitPerUser > 0 ? usageLimitPerUser : undefined,
      totalUsageLimit: usageLimit != null && usageLimit > 0 ? usageLimit : undefined,
    },
    startAt: typeof coupon.startsAt === 'string' ? coupon.startsAt : null,
    endAt: typeof coupon.expiresAt === 'string' ? coupon.expiresAt : null,
  }
}

export async function resolveCoupons(
  payload: Payload,
  opts: { codes: string[]; userId: number | string | null; tierSlugById: Map<string, string> },
): Promise<CouponResolution> {
  const result: CouponResolution = { snapshots: [], perUserApplied: {}, totalApplied: {}, rejected: [] }
  const codes = [...new Set(opts.codes.map((c) => String(c ?? '').trim().toUpperCase()).filter(Boolean))].slice(0, 5)
  if (codes.length === 0) return result

  const kept: Array<{ doc: Record<string, unknown>; code: string }> = []
  for (const code of codes) {
    let doc: Record<string, unknown> | null = null
    try {
      const res = await payload.find({
        collection: 'coupons',
        where: { code: { equals: code } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      doc = (res.docs[0] as unknown as Record<string, unknown>) ?? null
    } catch {
      doc = null
    }
    if (!doc || doc.isActive === false) {
      result.rejected.push({ code, reason: 'invalid_or_inactive' })
      continue
    }
    // pairwise 疊加檢查（沿用 apply-coupon 現行語意）
    const stackable = Boolean(doc.stackable)
    if (kept.length > 0) {
      if (!stackable || kept.some((k) => !k.doc.stackable)) {
        result.rejected.push({ code, reason: 'stacking_conflict' })
        continue
      }
      const group = typeof doc.exclusiveGroup === 'string' ? doc.exclusiveGroup : ''
      if (group && kept.some((k) => (typeof k.doc.exclusiveGroup === 'string' ? k.doc.exclusiveGroup : '') === group)) {
        result.rejected.push({ code, reason: 'exclusive_group_conflict' })
        continue
      }
    }
    kept.push({ doc, code })
  }

  for (let i = 0; i < kept.length; i++) {
    const { doc, code } = kept[i]
    const snap = couponToSnapshot(doc, i, opts.tierSlugById)
    if (!snap) {
      result.rejected.push({ code, reason: 'invalid_rule' })
      continue
    }
    result.snapshots.push(snap)
    // 用量：總量直接用 usageCount；每人用 coupon-redemptions 計數（登入者才有）
    if (snap.guardrails.totalUsageLimit != null) {
      result.totalApplied[snap.ruleKey] = typeof doc.usageCount === 'number' ? doc.usageCount : 0
    }
    if (snap.guardrails.perUserLimit != null && opts.userId != null) {
      try {
        const res = await payload.count({
          collection: 'coupon-redemptions',
          where: { and: [{ coupon: { equals: doc.id } }, { user: { equals: opts.userId } }] },
          overrideAccess: true,
        })
        result.perUserApplied[snap.ruleKey] = res.totalDocs
      } catch {
        result.perUserApplied[snap.ruleKey] = Number.MAX_SAFE_INTEGER // fail closed
      }
    }
  }
  return result
}
