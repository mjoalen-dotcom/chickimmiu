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

// ── Demo 推薦商品池（上線後由 Payload API 提供） ──
const IMG = (id: string) =>
  `https://shoplineimg.com/559df3efe37ec64e9f000092/${id}/1500x.webp?source_format=png`

const PRODUCT_POOL: RecommendedItem[] = [
  { id: 'p1', slug: 'dream-silk-ribbon-dress', name: 'Dream 拼接絲緞蝴蝶結洋裝', price: 2680, salePrice: 2480, image: IMG('69d3d8324c5226e1bcda99eb'), category: 'dress', matchScore: 95, reason: '身形相似買家最愛', type: 'cross_sell' },
  { id: 'p2', slug: 'estelle-pearl-dress', name: 'Estelle 小香珍珠洋裝', price: 3680, salePrice: 3380, image: IMG('69d3d83b4ef225a55ea202e5'), category: 'dress', matchScore: 90, reason: '升級版推薦', type: 'upsell' },
  { id: 'p3', slug: 'colette-waistline-lifting-dress', name: 'Colette 修身提腰氣質洋裝', price: 3080, salePrice: 2880, image: IMG('69d3d850293e6404cf30e5ce'), category: 'dress', matchScore: 88, reason: '經常一起購買', type: 'cross_sell' },
  { id: 'p4', slug: 'amelia-elegant-lace-lined-dress', name: 'Amelia 優雅疊紗包釦洋裝', price: 2780, salePrice: 2580, image: IMG('69ca4f60043ccd59ea96d5db'), category: 'dress', matchScore: 85, reason: '完美搭配', type: 'cross_sell' },
  { id: 'p5', slug: 'bertha-urban-gold-button-shirt', name: 'Bertha 都會金釦翻領襯衫', price: 1180, salePrice: 1080, image: IMG('69d3e0b795013e15481a46c5'), category: 'top', matchScore: 82, reason: '百搭上衣', type: 'cross_sell' },
  { id: 'p6', slug: 'irene-refined-pearl-button-blouse', name: 'Irene 名媛風珍珠釦上衣', price: 1380, salePrice: 1280, image: IMG('69ca53a3584149d3b5f646f9'), category: 'top', matchScore: 80, reason: '經常一起購買', type: 'cross_sell' },
  { id: 'p7', slug: 'ant-waist-sculpting-wide-leg-slacks', name: '螞蟻腰修身線條寬管西裝褲', price: 1580, image: IMG('69c14f3531bca7a037d363d1'), category: 'pants', matchScore: 78, reason: '熱銷搭配', type: 'cross_sell' },
  { id: 'p8', slug: 'myrca-fine-cropped-blazer', name: 'Myrca 精緻短版西裝外套', price: 2480, salePrice: 2280, image: IMG('69d3d8d557f177d12573967d'), category: 'outer', matchScore: 75, reason: '完美搭配外套', type: 'cross_sell' },
  { id: 'p9', slug: 'vintage-stone-necklace', name: '古著風洞石項鏈', price: 580, image: IMG('69c1070caaf4c85cd754a0da'), category: 'accessories', matchScore: 70, reason: '加購小物', type: 'addon' },
  { id: 'p10', slug: 'retro-oval-frame-glasses', name: '復古風橢圓造型眼鏡', price: 780, salePrice: 680, image: IMG('69ca47fb9253ac5f950cdc99'), category: 'accessories', matchScore: 68, reason: '加購配件', type: 'addon' },
  { id: 'p11', slug: 'bold-polished-open-ring', name: '粗獷鏡面開口戒', price: 480, image: IMG('69b80435883bd693aa0220bd'), category: 'accessories', matchScore: 65, reason: '小額加購', type: 'addon' },
  { id: 'p12', slug: 'miriam-elegant-high-waist-wide-leg-suit-set', name: 'Miriam 優雅高腰寬褲西裝套裝', price: 4780, salePrice: 4280, image: IMG('69ca5266dd7f90b1732e8a5d'), category: 'set', matchScore: 92, reason: '超值套裝升級', type: 'upsell' },
]

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
