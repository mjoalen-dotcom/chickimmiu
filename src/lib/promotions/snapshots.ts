/**
 * Promotion Engine — server snapshot 載入器（CHIC Commerce OS P0-B）
 *
 * 把 DB 裡的活動 / 規則 / 會員 / 用量讀成 evaluator 的純輸入 snapshot。
 * 這裡是唯一碰 I/O 的層；evaluator 本身無 I/O。
 * fail closed 原則：settings 讀不到 → 視同 killSwitch；規則轉換失敗 → 略過該規則。
 */
import type { Payload } from 'payload'

import { estimatePrizeValueTwd } from '../games/abuseDetection'
import { MYSTERY_GIFT_POOL_TAG } from './types'
import type {
  MemberSnapshot,
  PromotionCondition,
  PromotionEffect,
  PromotionRuleSnapshot,
  UsageSnapshot,
  UserRewardType,
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
/**
 * 成本與換算率的查詢結果，由 loadActiveCommerceRules 批次查好後傳進來。
 * ruleDocToSnapshot 保持同步、無 I/O，避免對每條規則各打一次 DB。
 */
export interface RuleCostContext {
  /** productId(string) → 單位成本 NT$；查不到或無成本資料時為 null */
  giftCostByProductId: Map<string, number | null>
  /** 每消費 1 元發幾點 */
  pointsPerDollar: number | null
  /** 幾點折抵 1 元 */
  pointsToCurrencyRate: number | null
  /**
   * couponId(string) → 最大曝險面額 NT$。
   * 固定額券 = discountValue；百分比券 = maxDiscountAmount。
   * 百分比券沒設 maxDiscountAmount = 無限曝險 → null → fail closed。
   */
  couponFaceValueById: Map<string, number | null>
  /**
   * poolTag → 該獎池中最高的獎項價值 NT$（下單時的保守預留基準）。
   * 獎池中任一 active 獎品算不出價值 → null → fail closed。
   */
  maxPrizeValueByPoolTag: Map<string, number | null>
}

export function ruleDocToSnapshot(
  rule: Record<string, unknown>,
  campaign: CampaignLite,
  tierSlugById: Map<string, string>,
  defaultMarginFloorPct: number | null,
  costCtx?: RuleCostContext,
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
        // 成本由 loadActiveCommerceRules 批次查好。查不到 → null →
        // evaluator 的 resolveEffectCost 回 null → fail closed 拒絕這條規則。
        // 這是刻意的：算不出成本就不能判斷會花多少活動預算，寧可不送。
        const unitCostTwd = costCtx?.giftCostByProductId.get(String(giftProduct)) ?? null
        then = {
          type: 'gift_item',
          productId: giftProduct,
          quantity: num(effectGroup.giftQuantity) ?? 1,
          unitCostTwd,
        }
        break
      }
      case 'points_multiplier':
        then = {
          type: 'points_multiplier',
          multiplier: num(effectGroup.multiplier) ?? 1,
          pointsPerDollar: costCtx?.pointsPerDollar ?? null,
          pointsToCurrencyRate: costCtx?.pointsToCurrencyRate ?? null,
          // 下單時還不知道最終發點倍率（會員等級 1.5x × 訂閱 1.5x 都在付款後才定），
          // 用 2.5 保守高估先佔預算，付款後再依實際發點差額修正。
          costSafetyFactor: 2.5,
        }
        break
      case 'grant_reward':
        then = {
          type: 'grant_reward',
          rewardKey: String(effectGroup.rewardKey ?? ''),
          quantity: 1,
          ...(typeof effectGroup.rewardType === 'string' && effectGroup.rewardType
            ? { rewardType: effectGroup.rewardType as UserRewardType }
            : {}),
        }
        break
      case 'coupon_drop': {
        const dropCoupon = relId(effectGroup.dropCoupon)
        if (dropCoupon == null) return null
        then = {
          type: 'coupon_drop',
          couponId: dropCoupon,
          // 面額由 loadRuleCostContext 批次查好；null → evaluator fail closed。
          // PromotionRules.beforeValidate 已在存檔當下擋掉「百分比券沒設上限」，
          // 這裡的 null 是第二道防線（例如券在規則上線後被改成百分比）。
          faceValueTwd: costCtx?.couponFaceValueById.get(String(dropCoupon)) ?? null,
          quantity: num(effectGroup.dropQuantity) ?? 1,
        }
        break
      }
      case 'mystery_gift': {
        // poolTag 固定：這是「訂單神秘禮物」專屬獎池，與遊戲獎池分開，
        // 免得改動遊戲獎池時意外改到訂單發獎的機率。
        const poolTag = MYSTERY_GIFT_POOL_TAG
        const fallback = effectGroup.fallbackPrizeSlug
        then = {
          type: 'mystery_gift',
          poolTag,
          // Alan 拍板：獎池不含銘謝惠顧。靠程式硬過濾而不是靠 admin 記得不掛 none。
          excludePrizeTypes: ['none'],
          maxPrizeValueTwd: costCtx?.maxPrizeValueByPoolTag.get(poolTag) ?? null,
          fallbackPoolSlug: typeof fallback === 'string' && fallback ? fallback : null,
        }
        break
      }
      default:
        // 靜默 return null 是這個檔案最危險的一行：後台 select 加了新效果值、
        // PG enum 也加了，但這裡沒加 case 的話，規則存得進 DB、狀態顯示 active、
        // evaluator 卻永遠收不到，而且沒有任何錯誤訊息。加一行 warn 讓它至少可查。
        console.warn(`[promotions/snapshots] 未支援的效果型別「${effectType}」，規則已略過`)
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
    // 沉睡召回等「正面鎖定分群」：evaluator 早就支援 member_segment_in，
    // 但後台一直只開排除用的 segmentsNotIn，導致這個能力打不開。
    if (Array.isArray(conditions.segmentsIn) && conditions.segmentsIn.length > 0) {
      when.push({ type: 'member_segment_in', values: conditions.segmentsIn.map(String) })
    }
    // 買 A + B：必須同時湊齊指定商品（scope include 是 OR，做不到這件事）
    const requireAll = relIds(conditions.requireAllProducts)
    if (requireAll.length > 0) {
      when.push({ type: 'cart_contains_all_products', values: requireAll })
    }
    if (conditions.membersOnly) when.push({ type: 'is_member', value: true })
    if (conditions.firstPurchaseOnly) when.push({ type: 'first_purchase', value: true })
    if (conditions.repeatPurchaseOnly) when.push({ type: 'repeat_purchase', value: true })
    if (conditions.birthdayMonthOnly) when.push({ type: 'birthday_month', value: true })
    if (conditions.referralRequired || (Array.isArray(conditions.referralCodesIn) && conditions.referralCodesIn.length > 0)) {
      const codes = Array.isArray(conditions.referralCodesIn)
        ? conditions.referralCodesIn
            .map((c) => (typeof c === 'object' && c !== null ? (c as Record<string, unknown>).code : c))
            .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
            .map((c) => c.trim())
        : []
      when.push({ type: 'referral_attributed', ...(codes.length > 0 ? { values: codes } : {}) })
    }
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
/**
 * 批次載入成本換算所需的資料。
 *
 * 商品成本的 fallback 鏈很重要：pre 實測 products.cost 只有 55/1395 有值（4%），
 * 但 sourcing.costTWD 有 1219/1395（87%）。只讀 cost 的話 fail-closed 會擋掉
 * 96% 的商品，贈品類規則等於不能用。仍有 176 件完全沒有成本資料 —— 那些就該被擋，
 * 算不出成本就不知道會花掉多少活動預算。
 */
export async function loadRuleCostContext(
  payload: Payload,
  giftProductIds: string[],
  dropCouponIds: string[] = [],
  mysteryPoolTags: string[] = [],
): Promise<RuleCostContext> {
  const giftCostByProductId = new Map<string, number | null>()
  const couponFaceValueById = new Map<string, number | null>()
  const maxPrizeValueByPoolTag = new Map<string, number | null>()

  if (giftProductIds.length > 0) {
    try {
      const res = await payload.find({
        collection: 'products',
        where: { id: { in: giftProductIds } },
        limit: giftProductIds.length,
        depth: 0,
        overrideAccess: true,
      })
      for (const raw of res.docs as unknown as Array<Record<string, unknown>>) {
        const sourcing = raw.sourcing as Record<string, unknown> | undefined
        const candidates = [raw.cost, sourcing?.costTWD]
        let cost: number | null = null
        for (const c of candidates) {
          const n = Number(c)
          if (Number.isFinite(n) && n > 0) {
            cost = n
            break
          }
        }
        giftCostByProductId.set(String(raw.id), cost)
      }
    } catch (err) {
      // 查不到就全部留空 → 下游 fail closed，不要靜默當成 0 成本
      console.warn('[promotions/snapshots] 贈品成本查詢失敗，相關規則將 fail closed', err)
    }
  }

  let pointsPerDollar: number | null = null
  let pointsToCurrencyRate: number | null = null
  try {
    const g = (await payload.findGlobal({ slug: 'loyalty-settings' as never })) as Record<
      string,
      unknown
    >
    const pc = g?.pointsConfig as Record<string, unknown> | undefined
    const ppd = Number(pc?.pointsPerDollar)
    const rate = Number(pc?.pointsToCurrencyRate)
    if (Number.isFinite(ppd) && ppd > 0) pointsPerDollar = ppd
    if (Number.isFinite(rate) && rate > 0) pointsToCurrencyRate = rate
  } catch {
    // 讀不到設定 → 留 null → points_multiplier 規則 fail closed
  }

  // ── Coupon Drop：券的最大曝險面額 ────────────────────────────────────────
  if (dropCouponIds.length > 0) {
    try {
      const res = await payload.find({
        collection: 'coupons',
        where: { id: { in: dropCouponIds } },
        limit: dropCouponIds.length,
        depth: 0,
        overrideAccess: true,
      })
      for (const raw of res.docs as unknown as Array<Record<string, unknown>>) {
        couponFaceValueById.set(String(raw.id), couponFaceValueTwd(raw))
      }
    } catch (err) {
      console.warn('[promotions/snapshots] 券面額查詢失敗，coupon_drop 規則將 fail closed', err)
    }
  }

  // ── Mystery Gift：獎池最高獎項價值（下單時的保守預留基準）────────────────
  for (const tag of mysteryPoolTags) {
    maxPrizeValueByPoolTag.set(tag, await loadMaxPrizeValue(payload, tag))
  }

  return {
    giftCostByProductId,
    pointsPerDollar,
    pointsToCurrencyRate,
    couponFaceValueById,
    maxPrizeValueByPoolTag,
  }
}

/**
 * 券的最大曝險面額（NT$）。
 * 固定額券就是折抵金額本身；百分比券只有設了 maxDiscountAmount 才算得出上限，
 * 沒設 = 訂單越大賠越多，無法納入預算控管 → null（fail closed）。
 */
function couponFaceValueTwd(coupon: Record<string, unknown>): number | null {
  const type = String(coupon.discountType ?? '')
  if (type === 'fixed' || type === 'fixed_amount') {
    const v = Number(coupon.discountValue)
    return Number.isFinite(v) && v > 0 ? v : null
  }
  const cap = Number(coupon.maxDiscountAmount)
  return Number.isFinite(cap) && cap > 0 ? cap : null
}

/**
 * 查一個獎池中最高的獎項價值（NT$）。
 *
 * 價值優先序刻意與 /games/terms 機率公示頁一致（`estimatedValue ?? estimatePrizeValueTwd()`）——
 * 對外揭露的價值與內部扣預算的價值必須是同一個數字，否則稽核對不起來。
 *
 * 回傳 null 的條件：任一 active 獎品的 estimatedValue 為空、且 prizeType 不屬於
 * points/credit 這種可自動換算的型別。estimatePrizeValueTwd 的 coupon 分支
 *（`amount*100` 封頂 5000）與 free_shipping 固定 80 都是拍腦袋常數，
 * 拿來當預算扣款依據會嚴重失真，所以這類獎品一律要求 admin 填 estimatedValue。
 */
async function loadMaxPrizeValue(payload: Payload, poolTag: string): Promise<number | null> {
  try {
    const now = new Date().toISOString()
    const res = await payload.find({
      collection: 'prize-pools' as never,
      where: {
        and: [
          { active: { equals: true } },
          { eligibleGames: { contains: poolTag } },
          { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] },
          { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: now } }] },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    const docs = res.docs as unknown as Array<Record<string, unknown>>
    const usable = docs.filter((d) => String(d.prizeType ?? '') !== 'none')
    if (usable.length === 0) return null

    let max = 0
    for (const d of usable) {
      const prizeType = String(d.prizeType ?? '')
      const est = Number(d.estimatedValue)
      if (Number.isFinite(est) && est > 0) {
        max = Math.max(max, est)
        continue
      }
      // 沒填 estimatedValue：只有 points / credit 敢自動換算，其餘一律算不出
      if (prizeType === 'points' || prizeType === 'credit') {
        max = Math.max(max, estimatePrizeValueTwd(prizeType, Number(d.amount) || 0))
        continue
      }
      console.warn(
        `[promotions/snapshots] 獎池「${poolTag}」的獎品 ${String(d.slug ?? d.id)} 缺 estimatedValue（型別 ${prizeType}），mystery_gift 規則 fail closed`,
      )
      return null
    }
    return max > 0 ? max : null
  } catch (err) {
    console.warn(`[promotions/snapshots] 獎池「${poolTag}」查詢失敗，mystery_gift 規則將 fail closed`, err)
    return null
  }
}

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
    const ruleDocs = res.docs as Array<Record<string, unknown>>

    // ── 成本資料：一次批次查完，不對每條規則各打一次 DB ──────────────────
    const giftProductIds = new Set<string>()
    const dropCouponIds = new Set<string>()
    const mysteryPoolTags = new Set<string>()
    for (const doc of ruleDocs) {
      const eg = (doc.effect ?? {}) as Record<string, unknown>
      if (eg.effectType === 'gift_item') {
        const pid = relId(eg.giftProduct)
        if (pid != null) giftProductIds.add(String(pid))
      } else if (eg.effectType === 'coupon_drop') {
        const cid = relId(eg.dropCoupon)
        if (cid != null) dropCouponIds.add(String(cid))
      } else if (eg.effectType === 'mystery_gift') {
        mysteryPoolTags.add(MYSTERY_GIFT_POOL_TAG)
      }
    }
    const costCtx = await loadRuleCostContext(
      payload,
      [...giftProductIds],
      [...dropCouponIds],
      [...mysteryPoolTags],
    )

    for (const doc of ruleDocs) {
      const campaign = byId.get(String(relId(doc.campaign)))
      if (!campaign) continue
      const snap = ruleDocToSnapshot(
        doc,
        campaign,
        tierSlugById,
        opts.settings.defaultMarginFloorPct,
        costCtx,
      )
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
  // 生日月份：UTC 取月，與 memberAnalytics.parseBirthday / birthdayEngine 同一套算法
  let birthdayMonth: number | null = null
  if (typeof user.birthday === 'string' && user.birthday) {
    const d = new Date(user.birthday)
    if (!Number.isNaN(d.getTime())) birthdayMonth = d.getUTCMonth() + 1
  }
  const orderCount = typeof user.orderCount === 'number' ? user.orderCount : 0
  return {
    userId: user.id as number | string,
    tierSlug,
    segmentSlugs,
    isFirstPurchase: orderCount === 0,
    blocked,
    orderCount,
    birthdayMonth,
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
