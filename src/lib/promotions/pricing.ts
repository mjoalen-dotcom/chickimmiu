/**
 * computeOrderPricing — 唯一價格權威（CHIC Commerce OS P0-B）
 *
 * 被兩個入口共用（單一實作，禁止在別處複製折扣公式）：
 * 1. POST /api/pricing/quote — 前台顯示用報價
 * 2. Orders.beforeChange（create）— 建單前重算 + 擋掉不一致的 client 金額
 *
 * client 傳入的只有：商品 id / sku / 數量 / 券碼 / 行標記（gift/addOn/bundle）。
 * 所有價格從 DB 重讀；贈品行 / 加價購行 / Bundle 行在 server 重新驗證與定價：
 * - 贈品行不合法 → 硬錯誤（fail closed，0 元行是盜刷向量）
 * - 加價購行不合法 → 以原價重新計價（降級，不擋單）
 * - Bundle 群組不合法 → 硬錯誤（Bundle 是策展商品，價格必須一致）
 */
import { createHash, randomUUID } from 'node:crypto'
import type { Payload } from 'payload'

import { getActiveMembership } from '../subscription/activate'
import { evaluatePromotions } from './evaluator'
import type { CartLineSnapshot, EvaluationResult } from './types'
import { resolveCoupons } from './couponAdapter'
import {
  PRICING_VERSION,
  buildMemberSnapshot,
  buildUsageSnapshot,
  loadActiveCommerceRules,
  loadPromotionSettings,
  loadTierSlugMap,
  type ActiveCommerceRules,
  type PromotionEngineSettings,
} from './snapshots'

export interface RawCartItem {
  productId: number | string
  sku?: string | null
  /** client 顯示用的 variant 文字（僅回填顯示，不參與計價） */
  variantText?: string | null
  quantity: number
  isGift?: boolean
  giftRuleRef?: number | string | null
  isAddOn?: boolean
  addOnRuleRef?: number | string | null
  bundleRef?: number | string | null
}

export interface PricedLine {
  lineId: string
  productId: number | string
  productName: string
  sku: string | null
  variantLabel: string | null
  quantity: number
  /** 伺服器定價後單價（bundle 行可能非整數，lineSubtotal 才是權威） */
  unitPrice: number
  lineSubtotal: number
  isGift: boolean
  isAddOn: boolean
  bundleRef: number | string | null
  giftRuleRef: number | string | null
  addOnRuleRef: number | string | null
  snapshot: CartLineSnapshot
}

export interface PricingInput {
  items: RawCartItem[]
  couponCodes: string[]
  user: Record<string, unknown> | null
  channel: 'web' | 'app' | 'line'
  shippingMethodId?: number | string | null
  paymentMethod?: string | null
  /** preview 模式：允許 draft/paused 活動、跳過用量查詢（Campaign Studio 試算用） */
  previewCampaignId?: number | string | null
}

export interface PricingBreakdown {
  itemsSubtotal: number
  promotionDiscount: number
  couponDiscount: number
  memberDiscount: number
  memberDiscountPercent: number
  shippingBaseFee: number
  shippingFee: number
  shippingFreeReason: 'threshold' | 'member' | 'promotion' | 'coupon' | null
  /** true = 尚未選物流方式，運費以預設物流估算（購物車頁）；結帳選定後為 false */
  shippingEstimated: boolean
  /** 預估用的免運門檻（NT$）；null = 該物流無免運門檻 */
  freeShippingThreshold: number | null
  codFee: number
  total: number
}

export interface PricingResult {
  ok: boolean
  errors: string[]
  settings: PromotionEngineSettings
  lines: PricedLine[]
  breakdown: PricingBreakdown
  evaluation: EvaluationResult | null
  activeRules: ActiveCommerceRules
  quote: {
    quoteId: string
    pricingVersion: string
    serverNow: string
    expiresAt: string
    quoteHash: string
  }
}

const asNumber = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const relId = (v: unknown): number | string | null => {
  if (v == null) return null
  if (typeof v === 'object') return ((v as Record<string, unknown>).id as number | string) ?? null
  return v as number | string
}

/** 穩定 hash：同 breakdown + 行 + 規則 → 同 hash（竄改/漂移偵測） */
export function computeQuoteHash(parts: {
  pricingVersion: string
  lines: Array<{ lineId: string; unitPrice: number; quantity: number; lineSubtotal: number }>
  breakdown: PricingBreakdown
  appliedRuleKeys: string[]
}): string {
  const canonical = JSON.stringify({
    v: parts.pricingVersion,
    l: parts.lines.map((l) => [l.lineId, l.unitPrice, l.quantity, l.lineSubtotal]),
    b: [
      parts.breakdown.itemsSubtotal,
      parts.breakdown.promotionDiscount,
      parts.breakdown.couponDiscount,
      parts.breakdown.memberDiscount,
      parts.breakdown.shippingFee,
      parts.breakdown.codFee,
      parts.breakdown.total,
    ],
    r: [...parts.appliedRuleKeys].sort(),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

interface MaterializeOutcome {
  lines: PricedLine[]
  errors: string[]
}

/** 從 DB 重讀價格 / 成本 / 分類，重驗贈品、加價購與 Bundle 行 */
async function materializeCartLines(payload: Payload, items: RawCartItem[]): Promise<MaterializeOutcome> {
  const errors: string[] = []
  const cleaned = items
    .filter((i) => i && i.productId != null && asNumber(i.quantity) > 0)
    .slice(0, 60)
  if (cleaned.length === 0) return { lines: [], errors: ['empty_cart'] }

  const ids = [...new Set(cleaned.map((i) => String(i.productId)))]
  const productById = new Map<string, Record<string, unknown>>()
  try {
    const res = await payload.find({
      collection: 'products',
      where: { id: { in: ids } },
      limit: ids.length,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of res.docs as unknown as Array<Record<string, unknown>>) productById.set(String(doc.id), doc)
  } catch {
    return { lines: [], errors: ['products_load_failed'] }
  }

  const lines: PricedLine[] = []
  const usedLineIds = new Set<string>()
  for (const item of cleaned) {
    const product = productById.get(String(item.productId))
    if (!product) {
      errors.push(`product_not_found:${item.productId}`)
      continue
    }
    const price = asNumber(product.price)
    const salePrice = typeof product.salePrice === 'number' ? product.salePrice : null
    const serverUnitPrice = salePrice != null && salePrice < price ? salePrice : price

    // variant（成本覆寫 + 標籤）；找不到 sku 不擋（沿用現行寬鬆行為）
    let variantLabel: string | null = item.variantText ?? null
    let unitCost: number | null = typeof product.cost === 'number' ? product.cost : null
    if (item.sku && Array.isArray(product.variants)) {
      const variant = (product.variants as Array<Record<string, unknown>>).find((v) => v.sku === item.sku)
      if (variant) {
        variantLabel = [variant.colorName, variant.size].filter(Boolean).join(' / ') || variantLabel
        if (typeof variant.costOverride === 'number') unitCost = variant.costOverride
      }
    }

    const categoryIds = [relId(product.category), ...(Array.isArray(product.additionalCategories) ? product.additionalCategories.map(relId) : [])]
      .filter((x): x is number | string => x != null)
    const tags = Array.isArray(product.tags)
      ? (product.tags as Array<Record<string, unknown>>).map((t) => String(t?.tag ?? '')).filter(Boolean)
      : []

    let lineId = `${item.productId}:${item.sku ?? 'base'}${item.isGift ? ':gift' : ''}${item.isAddOn ? ':addon' : ''}${item.bundleRef != null ? `:b${item.bundleRef}` : ''}`
    while (usedLineIds.has(lineId)) lineId = `${lineId}+`
    usedLineIds.add(lineId)

    lines.push({
      lineId,
      productId: (product.id as number | string) ?? item.productId,
      productName: String(product.name ?? product.title ?? ''),
      sku: item.sku ?? null,
      variantLabel,
      quantity: Math.floor(asNumber(item.quantity)),
      unitPrice: serverUnitPrice,
      lineSubtotal: serverUnitPrice * Math.floor(asNumber(item.quantity)),
      isGift: Boolean(item.isGift),
      isAddOn: Boolean(item.isAddOn),
      bundleRef: item.bundleRef ?? null,
      giftRuleRef: item.giftRuleRef ?? null,
      addOnRuleRef: item.addOnRuleRef ?? null,
      snapshot: {
        lineId,
        productId: (product.id as number | string) ?? item.productId,
        variantKey: item.sku ?? null,
        unitPrice: serverUnitPrice,
        quantity: Math.floor(asNumber(item.quantity)),
        unitCost,
        categoryIds,
        tags,
        isGiftLine: Boolean(item.isGift),
        isAddOnLine: Boolean(item.isAddOn),
        bundleId: item.bundleRef ?? null,
      },
    })
  }

  // 一般行小計（贈品/加價購資格的判斷基準：排除贈品與加價購本身）
  const baseSubtotal = lines
    .filter((l) => !l.isGift && !l.isAddOn)
    .reduce((s, l) => s + l.lineSubtotal, 0)
  const nowIso = new Date().toISOString()
  const inWindow = (doc: Record<string, unknown>): boolean => {
    const startsAt = typeof doc.startsAt === 'string' ? Date.parse(doc.startsAt) : null
    const expiresAt = typeof doc.expiresAt === 'string' ? Date.parse(doc.expiresAt) : null
    const now = Date.parse(nowIso)
    if (startsAt != null && now < startsAt) return false
    if (expiresAt != null && now >= expiresAt) return false
    return true
  }

  // 贈品行：server 重驗（不合法 → 硬錯誤）
  for (const line of lines.filter((l) => l.isGift)) {
    let valid = false
    if (line.giftRuleRef != null) {
      try {
        const rule = (await payload.findByID({
          collection: 'gift-rules',
          id: line.giftRuleRef as never,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
        const giftProductId = relId(rule.giftProduct)
        const qtyCap = asNumber(rule.giftQuantity, 1)
        const triggerType = String(rule.triggerType ?? 'min_amount')
        const triggerOk =
          triggerType === 'min_amount'
            ? baseSubtotal >= asNumber(rule.minAmount)
            : Array.isArray(rule.triggerProducts) &&
              rule.triggerProducts
                .map(relId)
                .some((pid) => lines.some((l) => !l.isGift && String(l.productId) === String(pid)))
        valid =
          rule.isActive !== false &&
          inWindow(rule) &&
          String(giftProductId) === String(line.productId) &&
          line.quantity <= Math.max(1, qtyCap) &&
          triggerOk
      } catch {
        valid = false
      }
    }
    if (valid) {
      line.unitPrice = 0
      line.lineSubtotal = 0
      line.snapshot.unitPrice = 0
    } else {
      errors.push(`invalid_gift_line:${line.productId}`)
    }
  }

  // 加價購行：server 重驗（不合法 → 以原價計，不擋單）
  for (const line of lines.filter((l) => l.isAddOn)) {
    let addOnPrice: number | null = null
    if (line.addOnRuleRef != null) {
      try {
        const rule = (await payload.findByID({
          collection: 'add-on-products',
          id: line.addOnRuleRef as never,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
        const conditions = (rule.conditions ?? {}) as Record<string, unknown>
        const capPerOrder = asNumber(conditions.usageLimitPerOrder, 1)
        const ok =
          rule.isActive !== false &&
          inWindow(rule) &&
          String(relId(rule.product)) === String(line.productId) &&
          baseSubtotal >= asNumber(conditions.minCartSubtotal) &&
          line.quantity <= Math.max(1, capPerOrder)
        if (ok && typeof rule.addOnPrice === 'number') addOnPrice = rule.addOnPrice
      } catch {
        addOnPrice = null
      }
    }
    if (addOnPrice != null && addOnPrice < line.unitPrice) {
      line.unitPrice = addOnPrice
      line.lineSubtotal = addOnPrice * line.quantity
      line.snapshot.unitPrice = addOnPrice
    }
    // 不合法 → 保持原價（已是 server 價）
  }

  // Bundle 群組：server 重定價（群組小計 = bundlePrice；不合法 → 硬錯誤）
  const bundleGroups = new Map<string, PricedLine[]>()
  for (const line of lines) {
    if (line.bundleRef != null) {
      const key = String(line.bundleRef)
      bundleGroups.set(key, [...(bundleGroups.get(key) ?? []), line])
    }
  }
  for (const [bundleId, group] of bundleGroups) {
    try {
      const bundle = (await payload.findByID({
        collection: 'bundles',
        id: bundleId as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      if (bundle.isActive === false) throw new Error('inactive')
      const bundlePrice = asNumber(bundle.bundlePrice)
      if (bundlePrice <= 0) throw new Error('no_price')
      // 群組定價：第一行帶整組價，其餘 0（與前台 cartStore 慣例一致）
      group.sort((a, b) => a.lineId.localeCompare(b.lineId))
      for (let i = 0; i < group.length; i++) {
        const l = group[i]
        l.lineSubtotal = i === 0 ? bundlePrice : 0
        l.unitPrice = l.quantity > 0 ? l.lineSubtotal / l.quantity : 0
        l.snapshot.unitPrice = l.unitPrice
      }
    } catch {
      errors.push(`invalid_bundle:${bundleId}`)
    }
  }

  return { lines, errors }
}

export async function computeOrderPricing(payload: Payload, input: PricingInput): Promise<PricingResult> {
  const serverNow = new Date().toISOString()
  const settings = await loadPromotionSettings(payload)
  const { lines, errors } = await materializeCartLines(payload, input.items)

  const itemsSubtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0)

  // 活動規則（preview 模式額外納入指定活動，含 draft/paused）
  const activeRules = await loadActiveCommerceRules(payload, {
    settings,
    statuses: input.previewCampaignId != null ? ['active', 'scheduled', 'draft', 'review', 'approved', 'paused'] : undefined,
  })
  let rules = activeRules.rules
  let budgetRemaining = activeRules.budgetRemaining
  if (input.previewCampaignId != null) {
    rules = rules.filter((r) => String(r.campaignId) === String(input.previewCampaignId))
    budgetRemaining = Object.fromEntries(
      Object.entries(budgetRemaining).filter(([k]) => k === String(input.previewCampaignId)),
    )
  }

  // 券 adapter（同一 evaluator）
  const tierSlugById = await loadTierSlugMap(payload)
  const userId = (input.user?.id as number | string | undefined) ?? null
  const coupons = await resolveCoupons(payload, { codes: input.couponCodes, userId, tierSlugById })

  // 會員 / 用量 snapshot
  const member = await buildMemberSnapshot(payload, input.user)
  const usage = await buildUsageSnapshot(payload, { rules, userId, budgetRemaining })
  Object.assign(usage.perUserApplied, coupons.perUserApplied)
  Object.assign(usage.totalApplied, coupons.totalApplied)

  // 運費基準（server 重算；門檻免運以「商品小計」為基準，沿用現行語意）
  // 未指定物流方式（購物車頁）→ 用「最便宜的啟用物流」當預估基準，
  // 避免前台各自硬編碼門檻（既有 cart page 寫死 1000/60 的來源）。
  let shippingBaseFee = 0
  let thresholdFree: 'threshold' | 'member' | null = null
  let shippingEstimated = false
  let freeShippingThreshold: number | null = null
  let shippingMethodDoc: Record<string, unknown> | null = null
  if (input.shippingMethodId != null) {
    try {
      shippingMethodDoc = (await payload.findByID({
        collection: 'shipping-methods',
        id: input.shippingMethodId as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    } catch {
      shippingMethodDoc = null
    }
  } else {
    try {
      const methods = await payload.find({
        collection: 'shipping-methods',
        where: { isActive: { equals: true } },
        sort: 'baseFee',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      shippingMethodDoc = (methods.docs[0] as unknown as Record<string, unknown>) ?? null
      shippingEstimated = shippingMethodDoc != null
    } catch {
      shippingMethodDoc = null
    }
  }
  if (shippingMethodDoc) {
    shippingBaseFee = asNumber(shippingMethodDoc.baseFee)
    const freeAt = asNumber(shippingMethodDoc.freeShippingThreshold)
    if (freeAt > 0) freeShippingThreshold = freeAt
    if (freeAt > 0 && itemsSubtotal >= freeAt) thresholdFree = 'threshold'
  }
  // 訂閱會員免運門檻（null = 無權益、0 = 永遠免運、>0 = 滿額）
  let memberDiscountPercent = 0
  if (input.user) {
    try {
      const membership = await getActiveMembership(payload, input.user)
      const benefits = membership?.plan?.benefits
      if (benefits) {
        memberDiscountPercent = asNumber(benefits.discountPercent)
        const freeShippingThreshold = benefits.freeShippingThreshold
        if (
          typeof freeShippingThreshold === 'number' &&
          (freeShippingThreshold === 0 || itemsSubtotal >= freeShippingThreshold)
        ) {
          if (!thresholdFree) thresholdFree = 'member'
        }
      }
    } catch {
      memberDiscountPercent = 0
    }
  }

  // Evaluator（門檻已免運 → 運費 0 進 evaluator，免運券自然 zero_discount）
  const evaluation = evaluatePromotions({
    now: serverNow,
    channel: input.channel,
    lines: lines.map((l) => l.snapshot),
    member,
    shippingFee: thresholdFree ? 0 : shippingBaseFee,
    rules: [...rules, ...coupons.snapshots],
    usage,
  })

  const promotionDiscount = evaluation.applications
    .filter((a) => a.source === 'campaign_rule')
    .reduce((s, a) => s + a.discountAmount, 0)
  const couponDiscount = evaluation.applications
    .filter((a) => a.source === 'coupon')
    .reduce((s, a) => s + a.discountAmount, 0)

  // 會員折扣（evaluator 之外的既有權益；公式與現行前台一致：毛小計 × %，被剩餘封頂）
  const remainingAfterDiscounts = Math.max(0, itemsSubtotal - promotionDiscount - couponDiscount)
  const memberDiscount = Math.min(
    remainingAfterDiscounts,
    Math.floor((itemsSubtotal * memberDiscountPercent) / 100),
  )

  // 運費落地
  let shippingFee: number
  let shippingFreeReason: PricingBreakdown['shippingFreeReason'] = null
  if (thresholdFree) {
    shippingFee = 0
    shippingFreeReason = thresholdFree
  } else {
    shippingFee = Math.max(0, shippingBaseFee - evaluation.shippingDiscountTotal)
    if (evaluation.shippingDiscountTotal > 0) {
      const shipApp = evaluation.applications.find((a) => a.shippingDiscountAmount > 0)
      shippingFreeReason = shipApp?.source === 'coupon' ? 'coupon' : 'promotion'
    }
  }

  // COD 手續費（server 讀 global；沿用現行 payment-settings 語意）
  let codFee = 0
  if (input.paymentMethod === 'cash_cod') {
    try {
      const g = (await payload.findGlobal({ slug: 'global-settings' as never })) as Record<string, unknown>
      const payment = (g?.payment ?? {}) as Record<string, unknown>
      codFee = asNumber(payment.codDefaultFee, 60)
    } catch {
      codFee = 60
    }
  }

  const total = Math.max(0, itemsSubtotal - promotionDiscount - couponDiscount - memberDiscount + shippingFee + codFee)

  const breakdown: PricingBreakdown = {
    itemsSubtotal,
    promotionDiscount,
    couponDiscount,
    memberDiscount,
    memberDiscountPercent,
    shippingBaseFee,
    shippingFee,
    shippingFreeReason,
    shippingEstimated,
    freeShippingThreshold,
    codFee,
    total,
  }

  const quoteHash = computeQuoteHash({
    pricingVersion: PRICING_VERSION,
    lines: lines.map((l) => ({ lineId: l.lineId, unitPrice: l.unitPrice, quantity: l.quantity, lineSubtotal: l.lineSubtotal })),
    breakdown,
    appliedRuleKeys: evaluation.applications.map((a) => a.ruleKey),
  })

  return {
    ok: errors.length === 0,
    errors,
    settings,
    lines,
    breakdown,
    evaluation,
    activeRules,
    quote: {
      quoteId: randomUUID(),
      pricingVersion: PRICING_VERSION,
      serverNow,
      expiresAt: new Date(Date.parse(serverNow) + settings.quoteTtlSeconds * 1000).toISOString(),
      quoteHash,
    },
  }
}
