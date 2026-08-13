/**
 * Promotion Engine — server snapshot 載入器（CHIC Commerce OS P0-B）
 *
 * 把 DB 裡的活動 / 規則 / 會員 / 用量讀成 evaluator 的純輸入 snapshot。
 * 這裡是唯一碰 I/O 的層；evaluator 本身無 I/O。
 * fail closed 原則：settings 讀不到 → 視同 killSwitch；規則轉換失敗 → 略過該規則。
 */
import type { Payload } from 'payload'

import type {
  MemberSnapshot,
  PromotionCondition,
  PromotionEffect,
  PromotionRuleSnapshot,
  UsageSnapshot,
} from './types'

export const PRICING_VERSION = 'pe-v1'

export interface PromotionEngineSettings {
  killSwitch: boolean
  storefrontEnabled: boolean
  serverPricingEnforcement: boolean
  quoteTtlSeconds: number
  defaultMarginFloorPct: number | null
}

export interface CampaignLite {
  id: number | string
  campaignName: string
  campaignSlug: string
  status: string
  startAt: string | null
  endAt: string | null
  timezone: string | null
  surfaces: string[]
  headline: string | null
  badgeText: string | null
  ctaText: string | null
  ctaHref: string | null
  budgetCap: number | null
  budgetSpent: number
}

export interface ActiveCommerceRules {
  campaigns: CampaignLite[]
  rules: PromotionRuleSnapshot[]
  /** campaignId(string) → 剩餘預算；null = 未設上限（僅 preview 情境會出現） */
  budgetRemaining: Record<string, number | null>
}

const relId = (v: unknown): number | string | null => {
  if (v == null) return null
  if (typeof v === 'object') return ((v as Record<string, unknown>).id as number | string) ?? null
  return v as number | string
}

const relIds = (v: unknown): Array<number | string> =>
  Array.isArray(v) ? (v.map(relId).filter((x) => x != null) as Array<number | string>) : []

const tagRows = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map((row) => (typeof row === 'object' && row ? String((row as Record<string, unknown>).tag ?? '') : ''))
        .filter(Boolean)
    : []

// ─────────────────────────────────────────────────────────────────────────────

export async function loadPromotionSettings(payload: Payload): Promise<PromotionEngineSettings> {
  try {
    const g = (await payload.findGlobal({ slug: 'promotion-settings' as never })) as Record<string, unknown>
    return {
      killSwitch: Boolean(g?.killSwitch),
      storefrontEnabled: Boolean(g?.storefrontEnabled),
      serverPricingEnforcement: g?.serverPricingEnforcement !== false,
      quoteTtlSeconds: typeof g?.quoteTtlSeconds === 'number' && g.quoteTtlSeconds >= 60 ? g.quoteTtlSeconds : 300,
      defaultMarginFloorPct: typeof g?.defaultMarginFloorPct === 'number' ? g.defaultMarginFloorPct : null,
    }
  } catch {
    // 讀不到設定 → fail closed：不給折扣，但計價強制保持開啟（安全預設）
    return {
      killSwitch: true,
      storefrontEnabled: false,
      serverPricingEnforcement: true,
      quoteTtlSeconds: 300,
      defaultMarginFloorPct: null,
    }
  }
}

/** membership-tiers id → slug 對照（tiersIn 條件、coupon tierRequired 用） */
export async function loadTierSlugMap(payload: Payload): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const res = await payload.find({
      collection: 'membership-tiers',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const t of res.docs as unknown as Array<Record<string, unknown>>) {
      if (t.id != null && typeof t.slug === 'string') map.set(String(t.id), t.slug)
    }
  } catch {
    // 對照載入失敗 → tiersIn 條件會因空 slugs 而不成立（fail closed）
  }
  return map
}

/** 規則 doc（後台授權 UI）→ evaluator snapshot。轉換失敗回 null（fail closed）。 */
export function ruleDocToSnapshot(
  rule: Record<string, unknown>,
  campaign: CampaignLite,
  tierSlugById: Map<string, string>,
  defaultMarginFloorPct: number | null,
): PromotionRuleSnapshot | null {
  try {
    const effectGroup = (rule.effect ?? {}) as Record<string, unknown>
    const conditions = (rule.conditions ?? {}) as Record<string, unknown>
    const scope = (rule.scope ?? {}) as Record<string, unknown>
    const stacking = (rule.stacking ?? {}) as Record<string, unknown>
    const guardrails = (rule.guardrails ?? {}) as Record<string, unknown>
    const version = typeof rule.version === 'number' ? rule.version : 1
    const slug = String(rule.slug ?? '')
    if (!slug) return null

    // 效果
    const effectType = String(effectGroup.effectType ?? '')
    const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
    let then: PromotionEffect | null = null
    switch (effectType) {
      case 'fixed_discount_per_group':
        then = {
          type: 'fixed_discount_per_group',
          groupSize: num(effectGroup.groupSize) ?? 0,
          amount: num(effectGroup.amount) ?? 0,
          repeatMode: effectGroup.repeatMode === 'every_full_group' ? 'every_full_group' : 'once_per_order',
          allocation: 'proportional_to_eligible_lines',
        }
        break
      case 'percent_discount_per_group':
        then = {
          type: 'percent_discount_per_group',
          groupSize: num(effectGroup.groupSize) ?? 0,
          percentOff: num(effectGroup.percentOff) ?? 0,
          repeatMode: effectGroup.repeatMode === 'every_full_group' ? 'every_full_group' : 'once_per_order',
          unitSelection: effectGroup.unitSelection === 'most_expensive_first' ? 'most_expensive_first' : 'cheapest_first',
        }
        break
      case 'percent_discount_nth_unit':
        then = {
          type: 'percent_discount_nth_unit',
          groupSize: num(effectGroup.groupSize) ?? 0,
          percentOff: num(effectGroup.percentOff) ?? 0,
          repeatMode: effectGroup.repeatMode === 'every_full_group' ? 'every_full_group' : 'once_per_order',
        }
        break
      case 'order_fixed_discount':
        then = {
          type: 'order_fixed_discount',
          amount: num(effectGroup.amount) ?? 0,
          allocation: 'proportional_to_eligible_lines',
        }
        break
      case 'order_percent_discount':
        then = {
          type: 'order_percent_discount',
          percentOff: num(effectGroup.percentOff) ?? 0,
          maxAmount: num(effectGroup.maxAmount),
          allocation: 'proportional_to_eligible_lines',
        }
        break
      case 'free_shipping':
        then = { type: 'free_shipping' }
        break
      case 'gift_item': {
        const giftProduct = relId(effectGroup.giftProduct)
        if (giftProduct == null) return null
        then = { type: 'gift_item', productId: giftProduct, quantity: num(effectGroup.giftQuantity) ?? 1 }
        break
      }
      case 'points_multiplier':
        then = { type: 'points_multiplier', multiplier: num(effectGroup.multiplier) ?? 1 }
        break
      case 'grant_reward':
        then = { type: 'grant_reward', rewardKey: String(effectGroup.rewardKey ?? ''), quantity: 1 }
        break
      default:
        return null
    }

    // 條件
    const when: PromotionCondition[] = []
    if (typeof conditions.minQuantity === 'number' && conditions.minQuantity >= 1) {
      when.push({ type: 'eligible_item_quantity_gte', value: conditions.minQuantity })
    }
    if (typeof conditions.minEligibleSubtotal === 'number' && conditions.minEligibleSubtotal >= 1) {
      when.push({ type: 'eligible_subtotal_gte', value: conditions.minEligibleSubtotal })
    }
    if (typeof conditions.minOrderSubtotal === 'number' && conditions.minOrderSubtotal >= 1) {
      when.push({ type: 'order_subtotal_gte', value: conditions.minOrderSubtotal })
    }
    const tierIds = relIds(conditions.tiersIn)
    if (tierIds.length > 0) {
      const slugs = tierIds.map((id) => tierSlugById.get(String(id)) ?? `__unknown_${id}`)
      when.push({ type: 'member_tier_in', values: slugs })
    }
    if (Array.isArray(conditions.segmentsNotIn) && conditions.segmentsNotIn.length > 0) {
      when.push({ type: 'member_segment_not_in', values: conditions.segmentsNotIn.map(String) })
    }
    if (conditions.membersOnly) when.push({ type: 'is_member', value: true })
    if (conditions.firstPurchaseOnly) when.push({ type: 'first_purchase', value: true })
    if (Array.isArray(conditions.channels) && conditions.channels.length > 0) {
      when.push({ type: 'channel_in', values: conditions.channels.map(String) as Array<'web' | 'app' | 'line'> })
    }

    const stackableWithAll = stacking.stackableWithAll !== false
    return {
      ruleKey: `${campaign.id}:${slug}:v${version}`,
      ruleDocId: (rule.id as number | string) ?? null,
      campaignId: campaign.id,
      slug,
      version,
      source: 'campaign_rule',
      benefitClass:
        rule.benefitClass === 'order_promo' || rule.benefitClass === 'shipping'
          ? (rule.benefitClass as 'order_promo' | 'shipping')
          : 'item_promo',
      priority: typeof rule.priority === 'number' ? rule.priority : 100,
      scope: {
        includeProducts: relIds(scope.includeProducts),
        excludeProducts: relIds(scope.excludeProducts),
        includeCategories: relIds(scope.includeCategories),
        excludeCategories: relIds(scope.excludeCategories),
        includeTags: tagRows(scope.includeTags),
        excludeTags: tagRows(scope.excludeTags),
      },
      when,
      then,
      stacking: {
        exclusiveGroup: typeof stacking.exclusiveGroup === 'string' && stacking.exclusiveGroup ? stacking.exclusiveGroup : undefined,
        stackableWith: stackableWithAll
          ? 'all'
          : (Array.isArray(stacking.stackableWith) ? (stacking.stackableWith.map(String) as never) : []),
        maxBenefitPerOrder: typeof stacking.maxBenefitPerOrder === 'number' ? stacking.maxBenefitPerOrder : undefined,
      },
      guardrails: {
        minimumGrossMarginPct:
          typeof guardrails.minimumGrossMarginPct === 'number'
            ? guardrails.minimumGrossMarginPct
            : (defaultMarginFloorPct ?? undefined),
        perUserLimit: typeof guardrails.perUserLimit === 'number' ? guardrails.perUserLimit : undefined,
        totalUsageLimit: typeof guardrails.totalUsageLimit === 'number' ? guardrails.totalUsageLimit : undefined,
      },
      startAt: campaign.startAt,
      endAt: campaign.endAt,
    }
  } catch {
    return null
  }
}

function campaignToLite(doc: Record<string, unknown>): CampaignLite | null {
  const commerce = (doc.commerce ?? {}) as Record<string, unknown>
  const schedule = (doc.schedule ?? {}) as Record<string, unknown>
  if (doc.id == null) return null
  return {
    id: doc.id as number | string,
    campaignName: String(doc.campaignName ?? ''),
    campaignSlug: String(doc.campaignSlug ?? ''),
    status: String(doc.status ?? 'draft'),
    startAt: typeof schedule.startDate === 'string' ? schedule.startDate : null,
    endAt: typeof schedule.endDate === 'string' ? schedule.endDate : null,
    timezone: typeof schedule.timezone === 'string' ? schedule.timezone : null,
    surfaces: Array.isArray(commerce.surfaces) ? commerce.surfaces.map(String) : [],
    headline: typeof commerce.headline === 'string' ? commerce.headline : null,
    badgeText: typeof commerce.badgeText === 'string' ? commerce.badgeText : null,
    ctaText: typeof commerce.ctaText === 'string' ? commerce.ctaText : null,
    ctaHref: typeof commerce.ctaHref === 'string' ? commerce.ctaHref : null,
    budgetCap: typeof commerce.budgetCap === 'number' ? commerce.budgetCap : null,
    budgetSpent: typeof commerce.budgetSpent === 'number' ? commerce.budgetSpent : 0,
  }
}

/**
 * 載入可套用的商務活動與其 active 規則 snapshot。
 * - global killSwitch → 空集合
 * - campaign killSwitch / paused / ended → 排除
 * - 排程窗仍由 evaluator 按 server now 判定（snapshot 帶 startAt/endAt）
 */
export async function loadActiveCommerceRules(
  payload: Payload,
  opts: { settings: PromotionEngineSettings; statuses?: string[] },
): Promise<ActiveCommerceRules> {
  const empty: ActiveCommerceRules = { campaigns: [], rules: [], budgetRemaining: {} }
  if (opts.settings.killSwitch) return empty
  const statuses = opts.statuses ?? ['active', 'scheduled']

  let campaignDocs: Array<Record<string, unknown>> = []
  try {
    const res = await payload.find({
      collection: 'marketing-campaigns',
      where: {
        and: [
          { 'commerce.enabled': { equals: true } },
          { 'commerce.killSwitch': { not_equals: true } },
          { status: { in: statuses } },
        ],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    campaignDocs = res.docs as unknown as Array<Record<string, unknown>>
  } catch {
    return empty
  }
  const campaigns = campaignDocs.map(campaignToLite).filter((c): c is CampaignLite => c != null)
  if (campaigns.length === 0) return empty

  const tierSlugById = await loadTierSlugMap(payload)
  const byId = new Map(campaigns.map((c) => [String(c.id), c]))
  const rules: PromotionRuleSnapshot[] = []
  try {
    const res = await payload.find({
      collection: 'promotion-rules' as never,
      where: {
        and: [{ campaign: { in: campaigns.map((c) => c.id) } }, { status: { equals: 'active' } }],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of res.docs as Array<Record<string, unknown>>) {
      const campaign = byId.get(String(relId(doc.campaign)))
      if (!campaign) continue
      const snap = ruleDocToSnapshot(doc, campaign, tierSlugById, opts.settings.defaultMarginFloorPct)
      if (snap) rules.push(snap)
    }
  } catch {
    return empty
  }

  const budgetRemaining: Record<string, number | null> = {}
  for (const c of campaigns) {
    budgetRemaining[String(c.id)] =
      c.budgetCap != null ? Math.max(0, c.budgetCap - (c.budgetSpent ?? 0)) : null
  }
  return { campaigns, rules, budgetRemaining }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function buildMemberSnapshot(
  payload: Payload,
  user: Record<string, unknown> | null,
): Promise<MemberSnapshot | null> {
  if (!user || user.id == null) return null
  const rawTier = user.memberTier
  const tierSlug =
    typeof rawTier === 'string'
      ? rawTier
      : ((rawTier as Record<string, unknown> | null | undefined)?.slug as string | undefined) ?? null
  let segmentSlugs: string[] = []
  let blocked = false
  try {
    const seg = await payload.find({
      collection: 'member-segments',
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const current = (seg.docs[0] as unknown as Record<string, unknown> | undefined)?.currentSegment
    if (typeof current === 'string' && current) {
      segmentSlugs = [current]
      blocked = current === 'BLK1'
    }
  } catch {
    // 分群讀取失敗 → 不阻擋（分群條件會自然不成立）
  }
  return {
    userId: user.id as number | string,
    tierSlug,
    segmentSlugs,
    isFirstPurchase: (typeof user.orderCount === 'number' ? user.orderCount : 0) === 0,
    blocked,
  }
}

/** 只對真的設了上限的規則查用量（省查詢）；coupon 的用量由 adapter 提供後合併 */
export async function buildUsageSnapshot(
  payload: Payload,
  opts: {
    rules: PromotionRuleSnapshot[]
    userId: number | string | null
    budgetRemaining: Record<string, number | null>
  },
): Promise<UsageSnapshot> {
  const perUserApplied: Record<string, number> = {}
  const totalApplied: Record<string, number> = {}
  for (const rule of opts.rules) {
    try {
      if (rule.guardrails.perUserLimit != null && opts.userId != null) {
        const res = await payload.count({
          collection: 'promotion-applications' as never,
          where: {
            and: [
              { user: { equals: opts.userId } },
              { ruleKey: { equals: rule.ruleKey } },
              { status: { equals: 'applied' } },
            ],
          },
          overrideAccess: true,
        })
        perUserApplied[rule.ruleKey] = res.totalDocs
      }
      if (rule.guardrails.totalUsageLimit != null) {
        const res = await payload.count({
          collection: 'promotion-applications' as never,
          where: { and: [{ ruleKey: { equals: rule.ruleKey } }, { status: { equals: 'applied' } }] },
          overrideAccess: true,
        })
        totalApplied[rule.ruleKey] = res.totalDocs
      }
    } catch {
      // 查詢失敗 → 視為已達上限（fail closed）
      if (rule.guardrails.perUserLimit != null) perUserApplied[rule.ruleKey] = Number.MAX_SAFE_INTEGER
      if (rule.guardrails.totalUsageLimit != null) totalApplied[rule.ruleKey] = Number.MAX_SAFE_INTEGER
    }
  }
  return { perUserApplied, totalApplied, budgetRemaining: opts.budgetRemaining }
}
