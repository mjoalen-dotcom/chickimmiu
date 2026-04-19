/**
 * 運送方式 Seed Data — 台灣常見 8 種
 * ──────────────────────────────────────────
 * 對應 schema: src/collections/ShippingMethods.ts
 *
 * 排序（sortOrder）：超商取貨優先 → 宅配 → 郵政 → 自取 → 國際
 * DHL 預設 isActive=false（尚未開通國際配送時保持隱藏）
 */

export type ShippingSeed = {
  name: string
  carrier: 'tcat' | 'hct' | '711' | 'family' | 'hilife' | 'ok' | 'post' | 'dhl' | 'fedex' | 'other'
  description: string
  baseFee: number
  freeShippingThreshold: number
  estimatedDays: string
  maxWeight?: number
  regions: Array<'taiwan' | 'offshore' | 'international'>
  isActive: boolean
  sortOrder: number
  trackingFlow: Array<{ step: string; description?: string; icon?: string }>
}

export const shippingMethods: ShippingSeed[] = [
  {
    name: '7-ELEVEN 超商取貨付款',
    carrier: '711',
    description: '全台 7-ELEVEN 門市取貨，可選擇取貨付款或線上付款',
    baseFee: 60,
    freeShippingThreshold: 1000,
    estimatedDays: '3-5 個工作天',
    maxWeight: 5,
    regions: ['taiwan'],
    isActive: true,
    sortOrder: 10,
    trackingFlow: [
      { step: '訂單成立', description: '感謝您的訂購，我們已收到訂單', icon: '📝' },
      { step: '理貨中', description: '商品正在打包中', icon: '📦' },
      { step: '配送中', description: '已交由 7-ELEVEN 配送', icon: '🚚' },
      { step: '送達門市', description: '商品已送達指定門市，請於 7 日內取貨', icon: '🏪' },
      { step: '完成取貨', description: '訂單已完成', icon: '✅' },
    ],
  },
  {
    name: '全家超商取貨付款',
    carrier: 'family',
    description: '全台 FamilyMart 門市取貨，可選擇取貨付款或線上付款',
    baseFee: 60,
    freeShippingThreshold: 1000,
    estimatedDays: '3-5 個工作天',
    maxWeight: 5,
    regions: ['taiwan'],
    isActive: true,
    sortOrder: 20,
    trackingFlow: [
      { step: '訂單成立', icon: '📝' },
      { step: '理貨中', description: '商品正在打包中', icon: '📦' },
      { step: '配送中', description: '已交由全家物流配送', icon: '🚚' },
      { step: '送達門市', description: '商品已送達指定門市，請於 7 日內取貨', icon: '🏪' },
      { step: '完成取貨', icon: '✅' },
    ],
  },
  {
    name: '萊爾富超商取貨',
    carrier: 'hilife',
    description: '全台萊爾富門市取貨',
    baseFee: 60,
    freeShippingThreshold: 1200,
    estimatedDays: '3-5 個工作天',
    maxWeight: 5,
    regions: ['taiwan'],
    isActive: true,
    sortOrder: 30,
    trackingFlow: [
      { step: '訂單成立', icon: '📝' },
      { step: '理貨中', icon: '📦' },
      { step: '配送中', icon: '🚚' },
      { step: '送達門市', description: '商品已送達指定門市，請於 7 日內取貨', icon: '🏪' },
      { step: '完成取貨', icon: '✅' },
    ],
  },
  {
    name: '新竹物流',
    carrier: 'hct',
    description: '新竹物流到府配送（台灣本島）',
    baseFee: 120,
    freeShippingThreshold: 1500,
    estimatedDays: '2-4 個工作天',
    maxWeight: 20,
    regions: ['taiwan'],
    isActive: true,
    sortOrder: 40,
    trackingFlow: [
      { step: '訂單成立', icon: '📝' },
      { step: '理貨中', icon: '📦' },
      { step: '已出貨', description: '已交由新竹物流', icon: '🚚' },
      { step: '配送中', icon: '🛵' },
      { step: '已送達', icon: '✅' },
    ],
  },
  {
    name: '黑貓宅急便',
    carrier: 'tcat',
    description: '黑貓宅急便到府配送（台灣本島 + 部分離島）',
    baseFee: 150,
    freeShippingThreshold: 1500,
    estimatedDays: '1-3 個工作天',
    maxWeight: 20,
    regions: ['taiwan', 'offshore'],
    isActive: true,
    sortOrder: 50,
    trackingFlow: [
      { step: '訂單成立', icon: '📝' },
      { step: '理貨中', icon: '📦' },
      { step: '已出貨', description: '已交由黑貓宅急便', icon: '🚚' },
      { step: '配送中', description: '配送員已取件，即將送達', icon: '🛵' },
      { step: '已送達', icon: '✅' },
    ],
  },
  {
    name: '中華郵政掛號',
    carrier: 'post',
    description: '中華郵政包裹掛號配送（台灣本島 + 離島）',
    baseFee: 80,
    freeShippingThreshold: 1000,
    estimatedDays: '3-5 個工作天',
    maxWeight: 10,
    regions: ['taiwan', 'offshore'],
    isActive: true,
    sortOrder: 60,
    trackingFlow: [
      { step: '訂單成立', icon: '📝' },
      { step: '理貨中', icon: '📦' },
      { step: '已交寄', description: '已交由中華郵政', icon: '📮' },
      { step: '配送中', icon: '🚚' },
      { step: '已送達', icon: '✅' },
    ],
  },
  {
    name: '門市自取（免運）',
    carrier: 'other',
    description: '備貨完成後通知您至品牌工作室/門市取貨，免運費',
    baseFee: 0,
    freeShippingThreshold: 0,
    estimatedDays: '備貨 1-2 天後通知取貨',
    regions: ['taiwan'],
    isActive: true,
    sortOrder: 70,
    trackingFlow: [
      { step: '訂單成立', icon: '📝' },
      { step: '備貨中', icon: '📦' },
      { step: '可取貨', description: '已通知您可前來取貨', icon: '🏬' },
      { step: '完成取貨', icon: '✅' },
    ],
  },
  {
    name: 'DHL 國際快遞',
    carrier: 'dhl',
    description: 'DHL 國際快遞（全球配送，含清關）',
    baseFee: 400,
    freeShippingThreshold: 0,
    estimatedDays: '5-7 個工作天',
    maxWeight: 30,
    regions: ['international'],
    isActive: false,
    sortOrder: 80,
    trackingFlow: [
      { step: '訂單成立', icon: '📝' },
      { step: '理貨中', icon: '📦' },
      { step: '已出貨', description: '已交由 DHL 國際快遞', icon: '✈️' },
      { step: '清關中', description: '目的國清關處理中', icon: '🛃' },
      { step: '配送中', icon: '🚚' },
      { step: '已送達', icon: '✅' },
    ],
  },
]
