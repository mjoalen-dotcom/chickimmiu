/**
 * AI 推薦引擎 — Server-side 推薦邏輯
 * ─────────────────────────────────────
 * 提供各頁面使用的推薦函式
 * 支援 upsell / cross-sell / 組合加購 / 離開挽留
 *
 * 權重公式：
 *   score = bodyMatch×35% + history×25% + tier×15%
 *         + stockHot×10% + ugc×10% + trend×5%
 *
 * 所有權重可從後台 RecommendationSettings Global 調整
 */

export interface RecommendedItem {
  id: string
  slug: string
  name: string
  price: number
  salePrice?: number
  image?: string
  category?: string
  matchScore: number      // 0-100
  reason: string          // 推薦原因
  type: 'cross_sell' | 'upsell' | 'addon' | 'bundle' | 'trending' | 'personalized'
  priceDiff?: number      // upsell 用：多付多少
  upgradeLabel?: string   // upsell 用：「多付 NT$200 升級更優質版型」
  bundleDiscount?: number // 組合折扣金額
}

export interface RecommendationContext {
  stage: 'product_page' | 'cart' | 'checkout' | 'thank_you' | 'exit_intent' | 'email'
  currentProductId?: string
  currentPrice?: number
  cartProductIds?: string[]
  cartTotal?: number
  userId?: string
}

// ── 推薦商品池 ──
// 之前是 hardcode demo（slug 全部 404），現在改為空陣列。
// 每個 recommendation 元件遇到空結果時都會 return null，所以不會顯示
// 壞掉的卡片或斷掉的連結。後續會由 Payload API 直接餵真實商品給元件，
// 屆時這個 helper 也可以整批刪除。
const PRODUCT_POOL: RecommendedItem[] = []

/**
 * 取得商品頁推薦
 * - Cross-sell：完美搭配（不同類別互補）
 * - Upsell：升級版（同類別更高價）
 */
export function getProductPageRecommendations(
  currentProductId?: string,
  currentPrice = 0,
): { crossSell: RecommendedItem[]; upsell: RecommendedItem[] } {
  const pool = PRODUCT_POOL.filter(p => p.id !== currentProductId)

  const crossSell = pool
    .filter(p => p.type === 'cross_sell' || p.type === 'addon')
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4)

  const upsell = pool
    .filter(p => p.price > currentPrice * 1.1 && p.price < currentPrice * 1.8)
    .map(p => ({
      ...p,
      type: 'upsell' as const,
      reason: '升級版推薦',
      priceDiff: Math.round((p.salePrice || p.price) - currentPrice),
      upgradeLabel: `多付 NT$${Math.round((p.salePrice || p.price) - currentPrice).toLocaleString()} 升級更優質版型`,
    }))
    .sort((a, b) => (a.priceDiff || 0) - (b.priceDiff || 0))
    .slice(0, 2)

  return { crossSell, upsell }
}

/**
 * 取得購物車推薦
 * - Bundle：組合加購（與購物車互補）
 * - Addon：小額加購品
 */
export function getCartRecommendations(
  cartProductIds: string[] = [],
  cartTotal = 0,
): { bundle: RecommendedItem[]; addon: RecommendedItem[] } {
  const pool = PRODUCT_POOL.filter(p => !cartProductIds.includes(p.id))

  const bundle = pool
    .filter(p => p.type === 'cross_sell' || p.type === 'upsell')
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4)
    .map(p => ({
      ...p,
      type: 'bundle' as const,
      reason: '搭配加購',
      bundleDiscount: Math.round(p.price * 0.1), // 組合優惠 10% off
    }))

  const addon = pool
    .filter(p => (p.salePrice || p.price) <= 800)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3)
    .map(p => ({ ...p, type: 'addon' as const, reason: '加購推薦' }))

  return { bundle, addon }
}

/**
 * 取得結帳頁最後加購
 */
export function getCheckoutRecommendations(
  cartProductIds: string[] = [],
  cartTotal = 0,
): RecommendedItem[] {
  const maxPrice = cartTotal * 0.3 // 不超過訂單 30%
  return PRODUCT_POOL
    .filter(p => !cartProductIds.includes(p.id) && (p.salePrice || p.price) <= maxPrice)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3)
    .map(p => ({ ...p, reason: '最後加購', type: 'addon' as const }))
}

/**
 * 取得感謝頁推薦
 */
export function getThankYouRecommendations(
  purchasedProductIds: string[] = [],
): RecommendedItem[] {
  return PRODUCT_POOL
    .filter(p => !purchasedProductIds.includes(p.id))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4)
    .map(p => ({ ...p, reason: '猜你也會喜歡', type: 'personalized' as const }))
}

/**
 * 取得離開意圖挽留推薦
 */
export function getExitIntentRecommendations(): RecommendedItem[] {
  return PRODUCT_POOL
    .filter(p => p.matchScore >= 80)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3)
    .map(p => ({ ...p, reason: '限時優惠', type: 'trending' as const }))
}
