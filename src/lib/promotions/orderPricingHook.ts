/**
 * Orders × Promotion Engine 整合 hooks（CHIC Commerce OS P0-B）
 *
 * beforeChangeServerPricing（create）：
 * - 伺服器重算全部金額（computeOrderPricing 唯一權威），client 金額只拿來「比對」：
 *   總額不一致 → 擋單（409 語意），前台重新報價。不做靜默改價。
 * - 非 admin 強制 customer = 登入者、status=pending、paymentStatus=unpaid
 *   （堵住盤點發現的 total=0 / paymentStatus=paid 偽造洞）。
 * - 活動預算 last-slice：條件式原子 UPDATE 預留（rowsAffected=0 → 擋單）。
 * - `payloadAPI === 'local'`（server 端程式建單：seed / 訂閱續扣等）跳過強制，
 *   與 PointsTransactions 的 local-API 閘門同一精神。
 * - promotion-settings.serverPricingEnforcement=false → 完全跳過（緊急回退開關）。
 *
 * afterChangeWritePromotionRecords（create）：
 * - 寫 promotion-applications（idempotencyKey = orderId:ruleKey，UNIQUE 防重放）
 * - 寫 promotion_applied / promotion_rejected 行為事件（分析用；失敗不擋單）
 *
 * afterChangeReversePromotions（cancelled / refunded）：
 * - applications 標 reversed + 活動 budgetSpent 原子回沖（不低於 0）
 */
import { APIError } from 'payload'
// `sql` 只是 drizzle 的 template tag（兩個 adapter 都是同一份 re-export），
// 方言差異在 SQL 文字本身，不在這個 import。
import { sql } from '@payloadcms/db-sqlite'
import { affectedRows, getDrizzle } from '../db/dialectSafeSql'
import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'

import { computeOrderPricing, type RawCartItem } from './pricing'
import { loadPromotionSettings } from './snapshots'

const relId = (v: unknown): number | string | null => {
  if (v == null) return null
  if (typeof v === 'object') return ((v as Record<string, unknown>).id as number | string) ?? null
  return v as number | string
}

interface OrderItemInput {
  product?: unknown
  productName?: string
  variant?: string
  sku?: string
  quantity?: number
  unitPrice?: number
  subtotal?: number
  isGift?: boolean
  isAddOn?: boolean
  bundleRef?: unknown
  giftRuleRef?: unknown
  addOnRuleRef?: unknown
}

export const beforeChangeServerPricing: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || !data) return data
  // server 端本地建單（seed / 系統流程）不強制 — 呼叫端自己就是權威
  if (req.payloadAPI === 'local') return data

  const settings = await loadPromotionSettings(req.payload)
  const isAdminUser = (req.user as Record<string, unknown> | null | undefined)?.role === 'admin'

  if (!settings.serverPricingEnforcement || isAdminUser) {
    data.promotion = { ...(data.promotion ?? {}), serverEnforced: false }
    return data
  }

  const rawItems = (Array.isArray(data.items) ? data.items : []) as OrderItemInput[]
  const items: RawCartItem[] = rawItems.map((i) => ({
    productId: relId(i.product) as number | string,
    sku: i.sku ?? null,
    variantText: i.variant ?? null,
    quantity: Number(i.quantity) || 0,
    isGift: Boolean(i.isGift),
    giftRuleRef: relId(i.giftRuleRef),
    isAddOn: Boolean(i.isAddOn),
    addOnRuleRef: relId(i.addOnRuleRef),
    bundleRef: relId(i.bundleRef),
  }))

  const appliedCoupons = Array.isArray(data.appliedCoupons) ? (data.appliedCoupons as Array<Record<string, unknown>>) : []
  const couponCodes = [
    ...appliedCoupons.map((c) => String(c?.couponCode ?? '')),
    ...(typeof data.couponCode === 'string' ? [data.couponCode] : []),
  ].filter(Boolean)

  const result = await computeOrderPricing(req.payload, {
    items,
    couponCodes,
    user: (req.user as unknown as Record<string, unknown>) ?? null,
    channel: 'web',
    shippingMethodId: relId((data.shippingMethod as Record<string, unknown> | undefined)?.method),
    paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : null,
  })

  if (!result.ok) {
    throw new APIError(`購物車內容驗證失敗（${result.errors.join('、')}），請回到購物車重新確認`, 400)
  }

  // 總額比對：不一致代表前台顯示已過期或被竄改 → 擋單重報價（不靜默改價）
  const clientTotal = Number(data.total)
  if (!Number.isFinite(clientTotal) || clientTotal !== result.breakdown.total) {
    throw new APIError('價格已更新（活動 / 優惠變動），請重新整理結帳頁確認金額後再送出', 409)
  }

  // ── 活動預算 last-slice 原子預留（先保留後建單；建單失敗的少數情況偏商家安全）──
  const evaluation = result.evaluation
  if (evaluation) {
    const byCampaign = new Map<string, number>()
    for (const app of evaluation.applications) {
      if (app.source !== 'campaign_rule' || app.campaignId == null) continue
      const key = String(app.campaignId)
      byCampaign.set(key, (byCampaign.get(key) ?? 0) + app.discountAmount + app.shippingDiscountAmount)
    }
    for (const [campaignId, amount] of byCampaign) {
      if (amount <= 0) continue
      const drizzle = getDrizzle(req.payload)
      const res = await drizzle.run(
        sql`UPDATE marketing_campaigns
            SET commerce_budget_spent = COALESCE(commerce_budget_spent, 0) + ${amount}
            WHERE id = ${Number(campaignId)}
              AND (commerce_budget_cap IS NULL OR COALESCE(commerce_budget_spent, 0) + ${amount} <= commerce_budget_cap)`,
      )
      if (affectedRows(res) === 0) {
        throw new APIError('活動預算已用完，優惠內容已更新，請重新整理結帳頁', 409)
      }
    }
  }

  // ── 以伺服器結果覆寫全部金額欄位 ──
  const b = result.breakdown
  data.items = result.lines.map((l) => ({
    product: l.productId,
    productName: l.productName,
    variant: l.variantLabel ?? undefined,
    sku: l.sku ?? undefined,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    subtotal: l.lineSubtotal,
    isGift: l.isGift || undefined,
    isAddOn: l.isAddOn || undefined,
    bundleRef: l.bundleRef ?? undefined,
    giftRuleRef: l.giftRuleRef ?? undefined,
    addOnRuleRef: l.addOnRuleRef ?? undefined,
  }))
  data.subtotal = b.itemsSubtotal
  data.subtotalBeforeDiscount = b.itemsSubtotal
  data.discountAmount = b.promotionDiscount + b.couponDiscount + b.memberDiscount
  const reasonParts: string[] = []
  if (b.promotionDiscount > 0) reasonParts.push(`活動折抵 ${b.promotionDiscount}`)
  if (b.couponDiscount > 0) reasonParts.push(`優惠券 ${b.couponDiscount}`)
  if (b.memberDiscount > 0) reasonParts.push(`會員折扣 ${b.memberDiscount}`)
  if (reasonParts.length > 0) data.discountReason = reasonParts.join('；')
  data.shippingFee = b.shippingFee
  data.codFee = b.codFee
  data.total = b.total

  // 券快照改用 server 金額（後續 CouponRedemptions afterChange 直接吃這份）
  const couponApps = (evaluation?.applications ?? []).filter((a) => a.source === 'coupon')
  data.appliedCoupons = couponApps.map((a) => ({
    coupon: a.couponId,
    couponCode: a.couponCode,
    discountAmount: a.discountAmount > 0 ? a.discountAmount : a.shippingDiscountAmount,
  }))
  data.coupon = couponApps[0]?.couponId ?? null
  data.couponCode = couponApps[0]?.couponCode ?? undefined

  // 促銷快照（不可變記錄）
  data.promotion = {
    quoteId: result.quote.quoteId,
    pricingVersion: result.quote.pricingVersion,
    serverEnforced: true,
    quoteHash: result.quote.quoteHash,
    discountTotal: b.promotionDiscount,
    shippingDiscountTotal: evaluation?.shippingDiscountTotal ?? 0,
    appliedPromotionSnapshots: evaluation?.applications ?? [],
    rewardIntents: evaluation?.rewardIntents ?? [],
  }

  // ── 身份與狀態強制（非 admin）──
  if (req.user?.id != null) data.customer = req.user.id
  data.status = 'pending'
  data.paymentStatus = 'unpaid'

  return data
}

export const afterChangeWritePromotionRecords: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  const promo = (doc as Record<string, unknown>).promotion as Record<string, unknown> | undefined
  if (!promo?.serverEnforced) return doc
  const snapshots = Array.isArray(promo.appliedPromotionSnapshots)
    ? (promo.appliedPromotionSnapshots as Array<Record<string, unknown>>)
    : []
  const customerId = relId((doc as Record<string, unknown>).customer)
  for (const app of snapshots) {
    try {
      await req.payload.create({
        collection: 'promotion-applications' as never,
        data: {
          order: (doc as Record<string, unknown>).id,
          user: customerId,
          campaign: app.campaignId ?? null,
          rule: app.ruleDocId ?? null,
          ruleKey: String(app.ruleKey ?? ''),
          version: Number(app.version) || 1,
          source: app.source === 'coupon' ? 'coupon' : 'campaign_rule',
          couponCode: (app.couponCode as string) ?? undefined,
          effectType: String(app.effectType ?? ''),
          status: 'applied',
          discountAmount: Number(app.discountAmount) || 0,
          shippingDiscountAmount: Number(app.shippingDiscountAmount) || 0,
          allocations: app.allocations ?? [],
          idempotencyKey: `${(doc as Record<string, unknown>).id}:${app.ruleKey}`,
        } as never,
        overrideAccess: true,
      })
    } catch (err) {
      // UNIQUE 衝突 = 重放，靜默略過；其他錯誤 log 不擋單（財務快照已在 orders.promotion）
      const msg = err instanceof Error ? err.message : String(err)
      if (!/UNIQUE|unique/i.test(msg)) {
        console.error('[promotion] application write failed', msg)
      }
    }
    // 行為事件（分析用；behavior_events 表不存在或寫入失敗都不影響訂單）
    try {
      await req.payload.create({
        collection: 'behavior-events',
        data: {
          eventType: 'promotion_applied',
          sessionId: `order:${(doc as Record<string, unknown>).orderNumber ?? (doc as Record<string, unknown>).id}`,
          user: customerId,
          pagePath: '/checkout',
          surface: 'checkout',
          campaign: app.campaignId ?? null,
          ruleKey: String(app.ruleKey ?? ''),
          value: Number(app.discountAmount) || 0,
          meta: { orderId: (doc as Record<string, unknown>).id, source: app.source },
        } as never,
        overrideAccess: true,
      })
    } catch {
      /* 靜默 */
    }
  }
  return doc
}

export const afterChangeReversePromotions: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const status = (doc as Record<string, unknown>).status
  const prevStatus = (previousDoc as Record<string, unknown> | undefined)?.status
  const terminal = status === 'cancelled' || status === 'refunded'
  const wasTerminal = prevStatus === 'cancelled' || prevStatus === 'refunded'
  if (!terminal || wasTerminal) return doc
  try {
    const apps = await req.payload.find({
      collection: 'promotion-applications' as never,
      where: {
        and: [{ order: { equals: (doc as Record<string, unknown>).id } }, { status: { equals: 'applied' } }],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    const byCampaign = new Map<string, number>()
    for (const raw of apps.docs as Array<Record<string, unknown>>) {
      await req.payload.update({
        collection: 'promotion-applications' as never,
        id: raw.id as never,
        data: {
          status: 'reversed',
          reversedAt: new Date().toISOString(),
          reversalReason: `order_${status}`,
        } as never,
        overrideAccess: true,
      })
      const campaignId = relId(raw.campaign)
      if (raw.source === 'campaign_rule' && campaignId != null) {
        const amount = (Number(raw.discountAmount) || 0) + (Number(raw.shippingDiscountAmount) || 0)
        byCampaign.set(String(campaignId), (byCampaign.get(String(campaignId)) ?? 0) + amount)
      }
    }
    for (const [campaignId, amount] of byCampaign) {
      if (amount <= 0) continue
      const drizzle = getDrizzle(req.payload)
      // 不用 MAX()/GREATEST()（方言不同），用 WHERE 擋掉會變負數的情形。
      await drizzle.run(
        sql`UPDATE marketing_campaigns
            SET commerce_budget_spent = COALESCE(commerce_budget_spent, 0) - ${amount}
            WHERE id = ${Number(campaignId)}
              AND COALESCE(commerce_budget_spent, 0) >= ${amount}`,
      )
    }
  } catch (err) {
    console.error('[promotion] reversal failed', err instanceof Error ? err.message : err)
  }
  return doc
}
