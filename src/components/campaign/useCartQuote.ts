'use client'

/**
 * useCartQuote — 共用的伺服器報價 hook（CHIC Commerce OS P0-C）
 *
 * 購物車頁摘要、購物車進度條、抽屜可能同時掛載；用模組層 in-flight 去重 +
 * 短 TTL 快取，讓同一組購物車內容只打一次 /api/pricing/quote。
 * 金額一律以 server breakdown 為準（前台不再自算折扣與免運門檻）。
 */
import { useEffect, useRef, useState } from 'react'

import type { CartItem } from '@/stores/cartStore'

export interface QuoteBreakdown {
  itemsSubtotal: number
  promotionDiscount: number
  couponDiscount: number
  memberDiscount: number
  memberDiscountPercent: number
  shippingBaseFee: number
  shippingFee: number
  shippingFreeReason: 'threshold' | 'member' | 'promotion' | 'coupon' | null
  shippingEstimated: boolean
  freeShippingThreshold: number | null
  codFee: number
  total: number
}

export interface QuoteProgressHint {
  ruleKey: string
  campaignId: number | string | null
  slug: string
  kind: 'quantity' | 'subtotal'
  current: number
  target: number
  remaining: number
  unlocked: boolean
  effectType: string
  effectAmount?: number
  effectPercentOff?: number
}

export interface QuoteApplication {
  ruleKey: string
  slug: string
  source: string
  couponCode?: string
  effectType: string
  discountAmount: number
  shippingDiscountAmount: number
}

export interface CartQuote {
  ok: boolean
  breakdown: QuoteBreakdown | null
  progress: QuoteProgressHint[]
  applications: QuoteApplication[]
}

export interface QuoteOptions {
  couponCodes?: string[]
  shippingMethodId?: number | string | null
  paymentMethod?: string | null
}

const EMPTY: CartQuote = { ok: false, breakdown: null, progress: [], applications: [] }
const TTL_MS = 3_000
const DEBOUNCE_MS = 400

const cache = new Map<string, { quote: CartQuote; at: number }>()
const inflight = new Map<string, Promise<CartQuote>>()

export function serializeCartForQuote(items: CartItem[]) {
  return items.map((i) => ({
    productId: i.productId,
    sku: i.variant?.sku ?? null,
    variantText: i.variant ? `${i.variant.colorName} / ${i.variant.size}` : null,
    quantity: i.quantity,
    isGift: i.isGift || undefined,
    giftRuleRef: i.giftRuleRef || undefined,
    isAddOn: i.isAddOn || undefined,
    addOnRuleRef: i.addOnRuleRef || undefined,
    bundleRef: i.bundleRef || undefined,
  }))
}

async function requestQuote(key: string, body: unknown): Promise<CartQuote> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.quote
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async (): Promise<CartQuote> => {
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) return EMPTY
      const json = await res.json()
      if (!json?.ok || !json.breakdown) return EMPTY
      return {
        ok: true,
        breakdown: json.breakdown as QuoteBreakdown,
        progress: (json.progress ?? []) as QuoteProgressHint[],
        applications: (json.applications ?? []) as QuoteApplication[],
      }
    } catch {
      return EMPTY
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  const quote = await promise
  if (quote.ok) cache.set(key, { quote, at: Date.now() })
  return quote
}

export function useCartQuote(items: CartItem[], options: QuoteOptions = {}): CartQuote {
  const [quote, setQuote] = useState<CartQuote>(EMPTY)
  const seqRef = useRef(0)
  const body = {
    items: serializeCartForQuote(items),
    couponCodes: options.couponCodes ?? [],
    shippingMethodId: options.shippingMethodId ?? null,
    paymentMethod: options.paymentMethod ?? null,
  }
  const key = JSON.stringify(body)

  useEffect(() => {
    if (items.length === 0) {
      setQuote(EMPTY)
      return
    }
    const seq = ++seqRef.current
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < TTL_MS) {
      setQuote(cached.quote)
      return
    }
    const timer = setTimeout(async () => {
      const result = await requestQuote(key, JSON.parse(key))
      if (seq === seqRef.current) setQuote(result)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // key 已涵蓋 items 與 options 的完整內容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, items.length])

  return quote
}
