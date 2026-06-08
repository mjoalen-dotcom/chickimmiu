import type { Payload } from 'payload'
import { normalizeMediaUrl } from '@/lib/media-url'
import type { RecommendedItem, RecommendationContext } from '@/lib/recommendationEngine'

/**
 * Server 端推薦：用「真實 products」算推薦（取代原本 hardcode 的空 PRODUCT_POOL）。
 * 由 /api/recommendations route 呼叫；前台 5 個推薦元件 fetch 該 route。
 *
 * 評分（matchScore 0-100，顯示用）：以 totalSold 人氣相對排名縮放到 60–98。
 * 分類：cross_sell=不同分類互補、upsell=同分類更高價、addon=低價加購、
 *       bundle=人氣搭配、trending/personalized=人氣。
 */

type P = Record<string, unknown>

function firstImage(p: P): string | undefined {
  const images = p.images as { image?: { url?: string } | number }[] | undefined
  const img = images?.[0]?.image
  if (img && typeof img === 'object') return normalizeMediaUrl((img as { url?: string }).url)
  return undefined
}

function catId(p: P): string | undefined {
  const c = p.category
  if (c == null) return undefined
  if (typeof c === 'object') return String((c as { id: unknown }).id)
  return String(c)
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function scoreOf(totalSold: number, maxSold: number): number {
  if (maxSold <= 0) return 75
  return Math.max(60, Math.min(98, Math.round(60 + 38 * (totalSold / maxSold))))
}

function toItem(p: P, maxSold: number, type: RecommendedItem['type'], reason: string): RecommendedItem {
  const price = num(p.price)
  const sale = p.salePrice != null && num(p.salePrice) > 0 ? num(p.salePrice) : undefined
  return {
    id: String(p.id),
    slug: String(p.slug || ''),
    name: String(p.name || ''),
    price,
    salePrice: sale,
    image: firstImage(p),
    category: catId(p),
    matchScore: scoreOf(num(p.totalSold), maxSold),
    reason,
    type,
  }
}

async function fetchCandidates(payload: Payload): Promise<P[]> {
  const res = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    sort: '-totalSold',
    limit: 60,
    depth: 1,
  })
  return res.docs as unknown as P[]
}

export interface RecommendationResult {
  crossSell?: RecommendedItem[]
  upsell?: RecommendedItem[]
  bundle?: RecommendedItem[]
  addon?: RecommendedItem[]
  items?: RecommendedItem[]
}

export async function getServerRecommendations(
  payload: Payload,
  ctx: RecommendationContext,
): Promise<RecommendationResult> {
  const candidates = await fetchCandidates(payload)
  const maxSold = candidates.reduce((m, p) => Math.max(m, num(p.totalSold)), 0)
  const exclude = new Set<string>(
    [...(ctx.cartProductIds || []), ctx.currentProductId].filter(Boolean).map(String),
  )
  const avail = candidates.filter((p) => !exclude.has(String(p.id)))

  if (ctx.stage === 'product_page') {
    const currentPrice = ctx.currentPrice || 0
    let currentCat: string | undefined
    if (ctx.currentProductId) {
      const cur = (await payload
        .findByID({ collection: 'products', id: ctx.currentProductId, depth: 0 })
        .catch(() => null)) as P | null
      if (cur) currentCat = catId(cur)
    }
    const crossSell = avail
      .filter((p) => !currentCat || catId(p) !== currentCat)
      .slice(0, 4)
      .map((p) => toItem(p, maxSold, 'cross_sell', '完美搭配'))

    const upsell = avail
      .filter((p) => {
        if (currentCat && catId(p) !== currentCat) return false
        const ep = num(p.salePrice) > 0 ? num(p.salePrice) : num(p.price)
        return currentPrice > 0 && ep > currentPrice * 1.1 && ep < currentPrice * 1.8
      })
      .sort((a, b) => num(a.price) - num(b.price))
      .slice(0, 2)
      .map((p) => {
        const ep = num(p.salePrice) > 0 ? num(p.salePrice) : num(p.price)
        const diff = Math.round(ep - currentPrice)
        return {
          ...toItem(p, maxSold, 'upsell', '升級推薦'),
          priceDiff: diff,
          upgradeLabel: `多付 NT$${diff.toLocaleString()} 升級更優質版型`,
        }
      })
    return { crossSell, upsell }
  }

  if (ctx.stage === 'cart') {
    const bundle = avail
      .slice(0, 4)
      .map((p) => ({ ...toItem(p, maxSold, 'bundle', '搭配加購'), bundleDiscount: Math.round(num(p.price) * 0.1) }))
    const addon = avail
      .filter((p) => (num(p.salePrice) > 0 ? num(p.salePrice) : num(p.price)) <= 800)
      .slice(0, 3)
      .map((p) => toItem(p, maxSold, 'addon', '加購推薦'))
    return { bundle, addon }
  }

  if (ctx.stage === 'checkout') {
    const cap = (ctx.cartTotal || 0) * 0.3
    const items = avail
      .filter((p) => {
        const ep = num(p.salePrice) > 0 ? num(p.salePrice) : num(p.price)
        return cap <= 0 || ep <= cap
      })
      .slice(0, 3)
      .map((p) => toItem(p, maxSold, 'addon', '最後加購'))
    return { items }
  }

  if (ctx.stage === 'thank_you') {
    return { items: avail.slice(0, 4).map((p) => toItem(p, maxSold, 'personalized', '猜你也會喜歡')) }
  }

  // exit_intent / email
  return { items: avail.slice(0, 3).map((p) => toItem(p, maxSold, 'trending', '熱門精選')) }
}
