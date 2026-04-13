/**
 * 會員行為分析引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 全方位會員行為分析
 *
 * 包含：
 *  1. RFM 分析（含信用分數加權）
 *  2. 自動標籤引擎
 *  3. LTV 預測
 *  4. 流失預測
 *  5. 購買偏好分析
 *  6. 360° 會員全景
 *  7. 儀表板總覽
 *
 * ⚠️ 前台介面一律只顯示 TIER_FRONT_NAMES
 *    絕對不可出現 bronze / silver / gold 等金屬分級名稱
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { TIER_FRONT_NAMES } from './tierEngine'
import { getCreditStatus } from './creditScoreEngine'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

/** RFM 分數（含信用分數加權） */
export interface RFMScore {
  userId: string
  recency: number      // 1-5（距上次購買天數，越近越高分）
  frequency: number    // 1-5（購買次數，越多越高）
  monetary: number     // 1-5（總消費金額，越高越高）
  creditWeight: number // 0.5-1.5 乘數（依信用分數）
  totalScore: number   // 加權綜合分
  segment: string      // 客群名稱（繁體中文）
}

/** 自動標籤建議 */
export interface AutoTagSuggestion {
  tag: string
  confidence: number  // 0-100
  reason: string
}

/** LTV 預測 */
export interface LTVPrediction {
  userId: string
  historicalLTV: number       // 歷史實際 LTV
  predictedLTV12m: number     // 預測未來 12 個月 LTV
  predictedLTVLifetime: number
  confidence: number
  factors: { name: string; impact: number }[]
}

/** 流失預測 */
export interface ChurnPrediction {
  userId: string
  churnScore: number  // 0-100（越高越可能流失）
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: { name: string; weight: number; value: number }[]
  recommendedActions: string[]
}

/** 購買偏好檔案 */
export interface PreferenceProfile {
  userId: string
  topCategories: { category: string; count: number; percentage: number }[]
  topSizes: { size: string; count: number }[]
  topColors: { color: string; count: number }[]
  avgOrderValue: number
  purchaseFrequencyDays: number  // 平均購買間隔天數
  preferredPaymentMethod: string
  preferredShippingMethod: string
  priceRange: { min: number; max: number; avg: number }
}

/** 360° 會員全景 */
export interface Member360View {
  // 基本資料
  userId: string
  name: string
  email: string
  tierFrontName: string  // 前台顯示稱號（絕不暴露 tier code）
  joinDate: string

  // 分數
  creditScore: number
  creditStatus: string
  churnScore: number
  churnRisk: string
  rfm: RFMScore
  ltv: LTVPrediction

  // 行為
  preferences: PreferenceProfile
  tags: string[]
  autoTagSuggestions: AutoTagSuggestion[]

  // 時間軸
  recentOrders: Array<{ id: string; date: string; total: number; status: string }>
  recentReturns: Array<{ id: string; date: string; amount: number; reason: string }>
  creditHistory: Array<{ date: string; change: number; reason: string; score: number }>

  // 統計
  totalOrders: number
  totalReturns: number
  returnRate: number
  lifetimeSpend: number
  annualSpend: number
  pointsBalance: number
}

/** 儀表板總覽 */
export interface AnalyticsDashboard {
  overview: {
    totalMembers: number
    avgLTV: number
    avgChurnScore: number
    avgCreditScore: number
    overallReturnRate: number
  }
  segmentDistribution: Array<{ segment: string; count: number; percentage: number }>
  churnDistribution: Array<{ risk: string; count: number }>
  ltvDistribution: Array<{ range: string; count: number }>
  topTags: Array<{ tag: string; count: number }>
  monthlyTrends: Array<{ month: string; newMembers: number; churnedMembers: number; avgSpend: number }>
}

// ══════════════════════════════════════════════════════════
// Internal helpers
// ══════════════════════════════════════════════════════════

/** 安全取值：Payload 回傳的文件用 Record<string, unknown> 存取 */
function safeNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  return fallback
}

function safeStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  return fallback
}

/** 計算兩個日期之間的天數 */
function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)))
}

/** 信用狀態中文對照 */
const CREDIT_STATUS_LABELS: Record<string, string> = {
  excellent: '優質好客人',
  normal: '一般',
  watchlist: '觀察名單',
  warning: '警示名單',
  blacklist: '黑名單',
  suspended: '停權',
}

/** 退貨原因中文對照 */
const RETURN_REASON_LABELS: Record<string, string> = {
  defective: '商品瑕疵',
  wrong_size: '尺寸不合',
  color_mismatch: '顏色與圖片不符',
  wrong_item: '收到錯誤商品',
  not_wanted: '不喜歡 / 不需要',
  other: '其他',
}

/** 訂單狀態中文對照 */
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  processing: '處理中',
  shipped: '已出貨',
  delivered: '已送達',
  cancelled: '已取消',
  refunded: '已退款',
}

/** 付款方式中文對照 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  ecpay: '綠界科技',
  newebpay: '藍新支付',
  linepay: 'LINE Pay',
}

/** 物流方式中文對照 */
const SHIPPING_METHOD_LABELS: Record<string, string> = {
  '711': '7-ELEVEN 超商取貨',
  family: '全家超商取貨',
  hilife: '萊爾富取貨',
  ok: 'OK 超商取貨',
  tcat: '黑貓宅急便',
  home: '宅配到府',
}

/** 信用分數 → creditWeight 乘數 */
function creditToWeight(creditScore: number): number {
  if (creditScore >= 90) return 1.5
  if (creditScore >= 70) return 1.2
  if (creditScore >= 50) return 1.0
  if (creditScore >= 30) return 0.8
  return 0.5
}

/** 信用狀態 → LTV 乘數 */
function creditStatusToLTVMultiplier(status: string): number {
  const map: Record<string, number> = {
    excellent: 1.3,
    normal: 1.0,
    watchlist: 0.7,
    warning: 0.4,
    blacklist: 0.1,
    suspended: 0.0,
  }
  return map[status] ?? 1.0
}

/** 等級 → 留存乘數 */
function tierToRetentionMultiplier(tierCode: string): number {
  const map: Record<string, number> = {
    diamond: 1.5,
    platinum: 1.35,
    gold: 1.2,
    silver: 1.1,
    bronze: 1.0,
    ordinary: 0.8,
  }
  return map[tierCode] ?? 0.8
}

/**
 * 將原始值映射到 1-5 分
 * @param value 原始值
 * @param boundaries 四個邊界值 [b1, b2, b3, b4]，由低到高
 * @param invert 若為 true 則數值越低分數越高（用於 recency）
 */
function scoreToQuintile(value: number, boundaries: [number, number, number, number], invert = false): number {
  const [b1, b2, b3, b4] = boundaries
  let score: number
  if (value <= b1) score = 1
  else if (value <= b2) score = 2
  else if (value <= b3) score = 3
  else if (value <= b4) score = 4
  else score = 5

  return invert ? 6 - score : score
}

/**
 * 根據 RFM 數值判斷客群名稱
 */
function determineSegment(r: number, f: number, m: number, creditScore: number): string {
  // 退貨高風險客（信用分數 < 50）
  if (creditScore < 50) return '退貨高風險客'
  // 冠軍客群
  if (r >= 4 && f >= 4 && m >= 4) return '冠軍客群'
  // 忠實客群
  if (f >= 4) return '忠實客群'
  // 價格敏感客（高頻但低消費）
  if (f >= 3 && m <= 2) return '價格敏感客'
  // 潛力忠誠客
  if (r >= 4 && f >= 2 && f <= 3) return '潛力忠誠客'
  // 優質新客
  if (r >= 4 && f === 1) return '優質新客'
  // 流失高風險客
  if (r <= 2 && f >= 3) return '流失高風險客'
  // 沉睡客
  if (r === 1 && f === 1) return '沉睡客'
  // 一般客群
  return '一般客群'
}

// ══════════════════════════════════════════════════════════
// 1. RFM Analysis
// ══════════════════════════════════════════════════════════

/**
 * 計算單一會員的 RFM 分數
 *
 * R（Recency）：距上次購買天數，越近 → 分數越高
 * F（Frequency）：購買次數，越多 → 分數越高
 * M（Monetary）：總消費金額，越高 → 分數越高
 * Credit Weight：依信用分數給予 0.5-1.5 乘數
 *
 * @param userId - 會員 ID
 * @returns RFM 分數物件
 */
export async function calculateRFM(userId: string): Promise<RFMScore> {
  try {
    const payload = await getPayload({ config })

    // 取得使用者資料
    const user = await payload.findByID({ collection: 'users', id: userId })
    const userData = user as unknown as Record<string, unknown>
    const creditScore = safeNum(userData.creditScore, 100)

    // 取得該會員的有效訂單（不含取消與退款）
    const ordersResult = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
        status: { not_in: ['cancelled', 'refunded'] },
      } satisfies Where,
      sort: '-createdAt',
      limit: 1000,
    })

    const orders = ordersResult.docs
    const now = new Date()

    // Recency: 距上次購買天數
    let daysSinceLastPurchase = 365 // 預設 365 天
    if (orders.length > 0) {
      const lastOrder = orders[0] as unknown as Record<string, unknown>
      const lastDate = new Date(safeStr(lastOrder.createdAt))
      daysSinceLastPurchase = daysBetween(now, lastDate)
    }

    // Frequency: 購買次數
    const purchaseCount = ordersResult.totalDocs

    // Monetary: 總消費金額
    let totalSpend = 0
    for (const order of orders) {
      const o = order as unknown as Record<string, unknown>
      totalSpend += safeNum(o.total)
    }

    // 用 Users 欄位作為 fallback
    if (totalSpend === 0) {
      totalSpend = safeNum(userData.lifetimeSpend) || safeNum(userData.totalSpent)
    }

    // RFM 打分（Recency 用 invert: 天數越少分數越高）
    const recency = scoreToQuintile(daysSinceLastPurchase, [7, 30, 90, 180], true)
    const frequency = scoreToQuintile(purchaseCount, [1, 3, 8, 20])
    const monetary = scoreToQuintile(totalSpend, [1000, 5000, 15000, 50000])

    const creditWeight = creditToWeight(creditScore)
    const rawScore = (recency * 0.3 + frequency * 0.35 + monetary * 0.35)
    const totalScore = Math.round(rawScore * creditWeight * 100) / 100

    const segment = determineSegment(recency, frequency, monetary, creditScore)

    return {
      userId,
      recency,
      frequency,
      monetary,
      creditWeight,
      totalScore,
      segment,
    }
  } catch (error) {
    console.error(`[BehaviorAnalytics] calculateRFM 失敗 (userId: ${userId}):`, error)
    return {
      userId,
      recency: 1,
      frequency: 1,
      monetary: 1,
      creditWeight: 1.0,
      totalScore: 1.0,
      segment: '一般客群',
    }
  }
}

/**
 * 批量計算所有會員的 RFM 分數
 *
 * @returns 全部會員的 RFM 分數陣列
 */
export async function calculateAllRFM(): Promise<RFMScore[]> {
  try {
    const payload = await getPayload({ config })

    const usersResult = await payload.find({
      collection: 'users',
      where: {
        role: { equals: 'customer' },
      } satisfies Where,
      limit: 10000,
    })

    const results: RFMScore[] = []
    for (const user of usersResult.docs) {
      const u = user as unknown as Record<string, unknown>
      const id = safeStr(u.id)
      if (!id) continue
      const rfm = await calculateRFM(id)
      results.push(rfm)
    }

    return results
  } catch (error) {
    console.error('[BehaviorAnalytics] calculateAllRFM 失敗:', error)
    return []
  }
}

// ══════════════════════════════════════════════════════════
// 2. Auto-tagging Engine
// ══════════════════════════════════════════════════════════

/**
 * 為會員自動生成標籤建議
 *
 * 根據以下維度分析：
 * - 購買歷史（類別、品項數、頻率）
 * - 退貨率
 * - 信用分數
 * - 尺寸偏好
 * - 消費金額
 *
 * @param userId - 會員 ID
 * @returns 自動標籤建議陣列
 */
export async function generateAutoTags(userId: string): Promise<AutoTagSuggestion[]> {
  try {
    const payload = await getPayload({ config })
    const tags: AutoTagSuggestion[] = []

    // 取得使用者資料
    const user = await payload.findByID({ collection: 'users', id: userId })
    const userData = user as unknown as Record<string, unknown>
    const creditScore = safeNum(userData.creditScore, 100)
    const totalSpent = safeNum(userData.lifetimeSpend) || safeNum(userData.totalSpent)
    const preferredCategory = safeStr(userData.preferredCategory)
    const preferredSize = safeStr(userData.preferredSize)

    // 取得訂單
    const ordersResult = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
        status: { not_in: ['cancelled', 'refunded'] },
      } satisfies Where,
      limit: 500,
    })
    const orders = ordersResult.docs
    const orderCount = ordersResult.totalDocs

    // 取得退貨紀錄
    const returnsResult = await payload.find({
      collection: 'returns',
      where: {
        customer: { equals: userId },
        status: { not_equals: 'rejected' },
      } satisfies Where,
      limit: 500,
    })
    const returnCount = returnsResult.totalDocs
    const returnRate = orderCount > 0 ? returnCount / orderCount : 0

    // ── 客群標籤（六大客群） ──
    const rfm = await calculateRFM(userId)

    if (rfm.segment === '冠軍客群') {
      tags.push({ tag: '冠軍客群', confidence: 95, reason: 'RFM 三維均高分，為最有價值會員' })
    }
    if (rfm.segment === '忠實客群') {
      tags.push({ tag: '忠實客群', confidence: 90, reason: '購買頻率極高，品牌忠誠度高' })
    }
    if (rfm.segment === '潛力忠誠客') {
      tags.push({ tag: '潛力忠誠客', confidence: 85, reason: '近期活躍且有複購行為，有潛力轉為忠實客' })
    }
    if (rfm.segment === '優質新客') {
      tags.push({ tag: '優質新客', confidence: 80, reason: '近期首購，需把握轉化時機' })
    }
    if (rfm.segment === '流失高風險客') {
      tags.push({ tag: '流失高風險客', confidence: 88, reason: '曾為活躍客戶但近期無購買行為' })
    }
    if (rfm.segment === '沉睡客') {
      tags.push({ tag: '沉睡客', confidence: 85, reason: '長期未購買且過去購買頻率低' })
    }

    // ── 消費型態標籤 ──
    if (totalSpent >= 50000) {
      tags.push({ tag: '高消費客群', confidence: 95, reason: `累計消費 NT$${totalSpent.toLocaleString()}` })
    } else if (totalSpent >= 15000) {
      tags.push({ tag: '中高消費客群', confidence: 90, reason: `累計消費 NT$${totalSpent.toLocaleString()}` })
    }

    // 平均客單價分析
    if (orders.length > 0) {
      const avgOrder = totalSpent / orders.length
      if (avgOrder >= 3000) {
        tags.push({ tag: '高客單價', confidence: 85, reason: `平均每筆訂單 NT$${Math.round(avgOrder).toLocaleString()}` })
      }
      if (avgOrder < 800 && orderCount >= 3) {
        tags.push({ tag: '小額多次購買', confidence: 80, reason: `平均客單價僅 NT$${Math.round(avgOrder)}，偏好小額購買` })
      }
    }

    // ── 購買頻率標籤 ──
    if (orderCount >= 10) {
      tags.push({ tag: '高回購', confidence: 92, reason: `累計 ${orderCount} 筆訂單` })
    } else if (orderCount >= 5) {
      tags.push({ tag: '穩定回購', confidence: 80, reason: `累計 ${orderCount} 筆訂單` })
    }

    // ── 類別偏好標籤 ──
    if (preferredCategory) {
      tags.push({ tag: `${preferredCategory}愛好者`, confidence: 75, reason: `系統偵測到常購類別：${preferredCategory}` })
    }

    // 分析訂單內的商品類別
    const categoryMap: Record<string, number> = {}
    const sizeMap: Record<string, number> = {}
    const colorMap: Record<string, number> = {}

    for (const order of orders) {
      const o = order as unknown as Record<string, unknown>
      const items = o.items as unknown as Array<Record<string, unknown>> | undefined
      if (!items) continue

      for (const item of items) {
        // 嘗試取得變體資訊
        const variant = safeStr(item.variant)
        if (variant) {
          const parts = variant.split(' / ')
          if (parts[0]) {
            colorMap[parts[0]] = (colorMap[parts[0]] ?? 0) + 1
          }
          if (parts[1]) {
            sizeMap[parts[1]] = (sizeMap[parts[1]] ?? 0) + 1
          }
        }

        // 商品名稱分析
        const productName = safeStr(item.productName)
        // 簡單分類：根據商品名稱中的關鍵字
        const categoryKeywords: Record<string, string[]> = {
          '洋裝': ['洋裝', '連身裙', '連衣裙', 'dress'],
          '上衣': ['上衣', '襯衫', 'T恤', '針織衫', 'top', 'blouse'],
          '下身': ['裙子', '短裙', '長裙', '褲', 'skirt', 'pants'],
          '外套': ['外套', '大衣', '夾克', 'coat', 'jacket'],
          '套裝': ['套裝', 'set'],
          '配件': ['包', '帽', '圍巾', '飾品', 'bag', 'accessory'],
        }

        for (const [cat, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some((kw) => productName.toLowerCase().includes(kw.toLowerCase()))) {
            categoryMap[cat] = (categoryMap[cat] ?? 0) + 1
          }
        }
      }
    }

    // 尺寸偏好標籤
    if (preferredSize) {
      tags.push({ tag: `常穿${preferredSize}碼`, confidence: 70, reason: `偏好尺碼：${preferredSize}` })
    }
    const topSize = Object.entries(sizeMap).sort((a, b) => b[1] - a[1])[0]
    if (topSize && !preferredSize) {
      tags.push({ tag: `常穿${topSize[0]}碼`, confidence: 65, reason: `購買紀錄中最常選擇 ${topSize[0]}` })
    }

    // 色系偏好標籤
    const topColor = Object.entries(colorMap).sort((a, b) => b[1] - a[1])[0]
    if (topColor && topColor[1] >= 2) {
      tags.push({ tag: `偏好${topColor[0]}色系`, confidence: 60, reason: `購買 ${topColor[0]} 色 ${topColor[1]} 次` })
    }

    // ── 退貨行為標籤 ──
    if (returnRate > 0.5) {
      tags.push({ tag: '高退貨率', confidence: 95, reason: `退貨率 ${(returnRate * 100).toFixed(0)}%` })
    } else if (returnRate > 0.3) {
      tags.push({ tag: '退貨偏高', confidence: 80, reason: `退貨率 ${(returnRate * 100).toFixed(0)}%` })
    }

    if (creditScore < 30) {
      tags.push({ tag: '退貨高風險客', confidence: 95, reason: `信用分數僅 ${creditScore}，退貨風險極高` })
    } else if (creditScore < 50) {
      tags.push({ tag: '信用觀察', confidence: 80, reason: `信用分數 ${creditScore}，需持續觀察` })
    }

    // ── 優質會員標籤 ──
    if (creditScore >= 95 && orderCount >= 5) {
      tags.push({ tag: '模範會員', confidence: 90, reason: '信用分數極高且有穩定回購紀錄' })
    }

    // 依 confidence 由高到低排序
    tags.sort((a, b) => b.confidence - a.confidence)

    return tags
  } catch (error) {
    console.error(`[BehaviorAnalytics] generateAutoTags 失敗 (userId: ${userId}):`, error)
    return [
      { tag: '一般會員', confidence: 50, reason: '分析資料不足，歸為一般會員' },
    ]
  }
}

// ══════════════════════════════════════════════════════════
// 3. LTV Prediction
// ══════════════════════════════════════════════════════════

/**
 * 預測會員的終身價值（Lifetime Value）
 *
 * 公式：
 *   predicted_12m = avgOrderValue * purchaseFrequencyPerMonth * 12 * retentionMultiplier * creditMultiplier
 *   predictedLifetime = predicted_12m * lifetimeMultiplier
 *
 * @param userId - 會員 ID
 * @returns LTV 預測結果
 */
export async function predictLTV(userId: string): Promise<LTVPrediction> {
  try {
    const payload = await getPayload({ config })

    // 取得使用者資料
    const user = await payload.findByID({ collection: 'users', id: userId })
    const userData = user as unknown as Record<string, unknown>
    const creditScore = safeNum(userData.creditScore, 100)
    const creditStatus = getCreditStatus(creditScore)
    const lifetimeSpend = safeNum(userData.lifetimeSpend) || safeNum(userData.totalSpent)
    const joinDate = new Date(safeStr(userData.createdAt) || Date.now())
    const memberTier = userData.memberTier

    // 取得等級碼
    let tierCode = 'ordinary'
    if (typeof memberTier === 'string') {
      tierCode = memberTier
    } else if (memberTier && typeof memberTier === 'object') {
      const tierData = memberTier as unknown as Record<string, unknown>
      tierCode = safeStr(tierData.slug) || safeStr(tierData.tierCode) || 'ordinary'
    }

    // 取得有效訂單
    const ordersResult = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
        status: { not_in: ['cancelled', 'refunded'] },
      } satisfies Where,
      sort: '-createdAt',
      limit: 1000,
    })

    const orders = ordersResult.docs
    const orderCount = ordersResult.totalDocs

    // 計算平均客單價
    let totalOrderValue = 0
    for (const order of orders) {
      const o = order as unknown as Record<string, unknown>
      totalOrderValue += safeNum(o.total)
    }
    const avgOrderValue = orderCount > 0 ? totalOrderValue / orderCount : 0

    // 計算每月購買頻率
    const now = new Date()
    const monthsSinceJoin = Math.max(1, daysBetween(now, joinDate) / 30)
    const purchaseFrequencyPerMonth = orderCount / monthsSinceJoin

    // 留存乘數
    const retentionMultiplier = tierToRetentionMultiplier(tierCode)

    // 信用乘數
    const creditMultiplier = creditStatusToLTVMultiplier(creditStatus)

    // 最近購買 recency 乘數（越近越高）
    let recencyMultiplier = 0.5
    if (orders.length > 0) {
      const lastOrder = orders[0] as unknown as Record<string, unknown>
      const lastDate = new Date(safeStr(lastOrder.createdAt))
      const daysSince = daysBetween(now, lastDate)
      if (daysSince <= 30) recencyMultiplier = 1.2
      else if (daysSince <= 90) recencyMultiplier = 1.0
      else if (daysSince <= 180) recencyMultiplier = 0.8
      else recencyMultiplier = 0.5
    }

    // 歷史 LTV
    const historicalLTV = lifetimeSpend || totalOrderValue

    // 預測 12 個月 LTV
    const predictedLTV12m = Math.round(
      avgOrderValue * purchaseFrequencyPerMonth * 12 * retentionMultiplier * creditMultiplier * recencyMultiplier,
    )

    // 預測終身 LTV（假設平均客戶壽命 5 年）
    const lifetimeMultiplier = Math.min(5, Math.max(1, monthsSinceJoin / 12)) // 依據已有的活躍年數推算
    const predictedLTVLifetime = Math.round(
      historicalLTV + predictedLTV12m * Math.max(1, 5 - (monthsSinceJoin / 12)),
    )

    // 信心指數：訂單越多越準確
    const confidence = Math.min(95, 30 + orderCount * 5 + (monthsSinceJoin > 6 ? 15 : 0))

    // 影響因子
    const factors: { name: string; impact: number }[] = [
      { name: '平均客單價', impact: Math.round(avgOrderValue) },
      { name: '月購買頻率', impact: Math.round(purchaseFrequencyPerMonth * 100) / 100 },
      { name: '等級留存乘數', impact: retentionMultiplier },
      { name: '信用乘數', impact: creditMultiplier },
      { name: '近期活躍乘數', impact: recencyMultiplier },
    ]

    return {
      userId,
      historicalLTV,
      predictedLTV12m: Math.max(0, predictedLTV12m),
      predictedLTVLifetime: Math.max(historicalLTV, predictedLTVLifetime),
      confidence: Math.round(confidence),
      factors,
    }
  } catch (error) {
    console.error(`[BehaviorAnalytics] predictLTV 失敗 (userId: ${userId}):`, error)
    return {
      userId,
      historicalLTV: 0,
      predictedLTV12m: 0,
      predictedLTVLifetime: 0,
      confidence: 0,
      factors: [],
    }
  }
}

// ══════════════════════════════════════════════════════════
// 4. Churn Score Prediction
// ══════════════════════════════════════════════════════════

/**
 * 預測會員流失風險
 *
 * 流失因子加權：
 * - daysSinceLastPurchase（40%）
 * - daysSinceLastLogin（20%）
 * - purchaseFrequencyTrend（15%）
 * - creditScoreTrend（10%）
 * - returnRate（10%）
 * - engagementScore（5%）
 *
 * @param userId - 會員 ID
 * @returns 流失預測結果
 */
export async function predictChurn(userId: string): Promise<ChurnPrediction> {
  try {
    const payload = await getPayload({ config })

    // 取得使用者資料
    const user = await payload.findByID({ collection: 'users', id: userId })
    const userData = user as unknown as Record<string, unknown>
    const creditScore = safeNum(userData.creditScore, 100)
    const lastOrderDate = userData.lastOrderDate
      ? new Date(safeStr(userData.lastOrderDate))
      : null
    const lastLoginDate = userData.lastLoginDate
      ? new Date(safeStr(userData.lastLoginDate))
      : null

    const now = new Date()

    // ── Factor 1: 距上次購買天數（40%） ──
    let daysSinceLastPurchase = 365
    if (lastOrderDate) {
      daysSinceLastPurchase = daysBetween(now, lastOrderDate)
    } else {
      // 嘗試從訂單中取得
      const recentOrder = await payload.find({
        collection: 'orders',
        where: {
          customer: { equals: userId },
          status: { not_in: ['cancelled', 'refunded'] },
        } satisfies Where,
        sort: '-createdAt',
        limit: 1,
      })
      if (recentOrder.docs.length > 0) {
        const o = recentOrder.docs[0] as unknown as Record<string, unknown>
        daysSinceLastPurchase = daysBetween(now, new Date(safeStr(o.createdAt)))
      }
    }
    // 正規化到 0-100：0 天=0，365+ 天=100
    const purchaseRecencyScore = Math.min(100, (daysSinceLastPurchase / 365) * 100)

    // ── Factor 2: 距上次登入天數（20%） ──
    let daysSinceLastLogin = 180
    if (lastLoginDate) {
      daysSinceLastLogin = daysBetween(now, lastLoginDate)
    }
    const loginRecencyScore = Math.min(100, (daysSinceLastLogin / 180) * 100)

    // ── Factor 3: 購買頻率趨勢（15%） ──
    // 比較近 90 天與前 90 天的購買數量
    const last90days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const last180days = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

    const recentOrders = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
        status: { not_in: ['cancelled', 'refunded'] },
        createdAt: { greater_than: last90days.toISOString() },
      } satisfies Where,
      limit: 0,
    })

    const previousOrders = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
        status: { not_in: ['cancelled', 'refunded'] },
        createdAt: {
          greater_than: last180days.toISOString(),
          less_than: last90days.toISOString(),
        },
      } satisfies Where,
      limit: 0,
    })

    let frequencyTrendScore = 50 // 預設中等
    const recentCount = recentOrders.totalDocs
    const previousCount = previousOrders.totalDocs
    if (previousCount > 0) {
      const ratio = recentCount / previousCount
      if (ratio >= 1.5) frequencyTrendScore = 0    // 大幅成長
      else if (ratio >= 1.0) frequencyTrendScore = 20 // 穩定或微增
      else if (ratio >= 0.5) frequencyTrendScore = 60 // 下降中
      else frequencyTrendScore = 90                   // 大幅下降
    } else if (recentCount === 0) {
      frequencyTrendScore = 80 // 前後期都無購買
    } else {
      frequencyTrendScore = 10 // 之前無購買但近期有（新客）
    }

    // ── Factor 4: 信用分數趨勢（10%） ──
    // 查看最近的信用分數變動
    const creditHistory = await payload.find({
      collection: 'credit-score-history',
      where: {
        user: { equals: userId },
      } satisfies Where,
      sort: '-createdAt',
      limit: 5,
    })

    let creditTrendScore = 30 // 預設穩定
    if (creditHistory.docs.length >= 2) {
      let totalChange = 0
      for (const entry of creditHistory.docs) {
        const e = entry as unknown as Record<string, unknown>
        totalChange += safeNum(e.change)
      }
      if (totalChange < -20) creditTrendScore = 90     // 信用大幅下降
      else if (totalChange < -5) creditTrendScore = 60  // 信用微降
      else if (totalChange >= 5) creditTrendScore = 10  // 信用上升
    }

    // ── Factor 5: 退貨率（10%） ──
    const returnsResult = await payload.find({
      collection: 'returns',
      where: {
        customer: { equals: userId },
        status: { not_equals: 'rejected' },
      } satisfies Where,
      limit: 0,
    })

    const allOrdersResult = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
      } satisfies Where,
      limit: 0,
    })

    const returnRate = allOrdersResult.totalDocs > 0
      ? returnsResult.totalDocs / allOrdersResult.totalDocs
      : 0
    const returnRateScore = Math.min(100, returnRate * 200) // 50% 退貨率 = 100 分

    // ── Factor 6: 互動分數（5%） ──
    // 簡化：根據信用分數、標籤數量來估算
    const userTags = userData.tags as unknown as Array<Record<string, unknown>> | undefined
    const tagCount = userTags?.length ?? 0
    const engagementScore = Math.max(0, 100 - (creditScore * 0.5 + Math.min(tagCount * 10, 30) + (recentCount > 0 ? 20 : 0)))

    // ── 加權計算流失分數 ──
    const churnScore = Math.round(
      purchaseRecencyScore * 0.40 +
      loginRecencyScore * 0.20 +
      frequencyTrendScore * 0.15 +
      creditTrendScore * 0.10 +
      returnRateScore * 0.10 +
      engagementScore * 0.05,
    )

    // 風險等級
    let riskLevel: 'low' | 'medium' | 'high' | 'critical'
    if (churnScore >= 80) riskLevel = 'critical'
    else if (churnScore >= 60) riskLevel = 'high'
    else if (churnScore >= 35) riskLevel = 'medium'
    else riskLevel = 'low'

    // 因子明細
    const factors: ChurnPrediction['factors'] = [
      { name: '距上次購買天數', weight: 0.40, value: Math.round(purchaseRecencyScore) },
      { name: '距上次登入天數', weight: 0.20, value: Math.round(loginRecencyScore) },
      { name: '購買頻率趨勢', weight: 0.15, value: Math.round(frequencyTrendScore) },
      { name: '信用分數趨勢', weight: 0.10, value: Math.round(creditTrendScore) },
      { name: '退貨率', weight: 0.10, value: Math.round(returnRateScore) },
      { name: '互動活躍度', weight: 0.05, value: Math.round(engagementScore) },
    ]

    // 建議行動
    const recommendedActions: string[] = []
    if (riskLevel === 'critical') {
      recommendedActions.push('立即發送專屬折扣碼挽回')
      recommendedActions.push('指派客服人員主動聯繫')
      recommendedActions.push('推送個人化商品推薦')
    } else if (riskLevel === 'high') {
      recommendedActions.push('發送「好久不見」關懷訊息')
      recommendedActions.push('提供限時購物金或免運優惠')
      recommendedActions.push('推送近期新品通知')
    } else if (riskLevel === 'medium') {
      recommendedActions.push('定期發送穿搭靈感電子報')
      recommendedActions.push('推送會員專屬活動資訊')
    } else {
      recommendedActions.push('持續提供優質體驗以維持忠誠度')
      recommendedActions.push('邀請參與會員推薦計畫')
    }

    return {
      userId,
      churnScore: Math.max(0, Math.min(100, churnScore)),
      riskLevel,
      factors,
      recommendedActions,
    }
  } catch (error) {
    console.error(`[BehaviorAnalytics] predictChurn 失敗 (userId: ${userId}):`, error)
    return {
      userId,
      churnScore: 50,
      riskLevel: 'medium',
      factors: [],
      recommendedActions: ['資料分析失敗，建議人工評估'],
    }
  }
}

// ══════════════════════════════════════════════════════════
// 5. Purchase Path & Preference Analysis
// ══════════════════════════════════════════════════════════

/**
 * 分析會員的購買偏好
 *
 * 包含：類別偏好、尺寸偏好、色系偏好、平均客單價、
 * 購買頻率、付款方式、物流方式、價格帶分析
 *
 * @param userId - 會員 ID
 * @returns 購買偏好檔案
 */
export async function analyzePreferences(userId: string): Promise<PreferenceProfile> {
  try {
    const payload = await getPayload({ config })

    // 取得有效訂單
    const ordersResult = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
        status: { not_in: ['cancelled', 'refunded'] },
      } satisfies Where,
      sort: '-createdAt',
      limit: 500,
    })

    const orders = ordersResult.docs

    // 初始化統計
    const categoryMap: Record<string, number> = {}
    const sizeMap: Record<string, number> = {}
    const colorMap: Record<string, number> = {}
    const paymentMethodMap: Record<string, number> = {}
    const shippingMethodMap: Record<string, number> = {}
    let totalItemCount = 0
    let totalSpend = 0
    let minPrice = Infinity
    let maxPrice = 0
    let priceSum = 0
    let priceCount = 0
    const orderDates: Date[] = []

    for (const order of orders) {
      const o = order as unknown as Record<string, unknown>
      const orderTotal = safeNum(o.total)
      totalSpend += orderTotal
      orderDates.push(new Date(safeStr(o.createdAt)))

      // 付款方式
      const pm = safeStr(o.paymentMethod)
      if (pm) {
        paymentMethodMap[pm] = (paymentMethodMap[pm] ?? 0) + 1
      }

      // 物流方式
      const sm = o.shippingMethod as unknown as Record<string, unknown> | undefined
      if (sm) {
        const carrier = safeStr(sm.carrier) || safeStr(sm.methodName)
        if (carrier) {
          shippingMethodMap[carrier] = (shippingMethodMap[carrier] ?? 0) + 1
        }
      }

      // 商品項目
      const items = o.items as unknown as Array<Record<string, unknown>> | undefined
      if (!items) continue

      for (const item of items) {
        totalItemCount += safeNum(item.quantity, 1)
        const unitPrice = safeNum(item.unitPrice)
        if (unitPrice > 0) {
          priceSum += unitPrice
          priceCount++
          if (unitPrice < minPrice) minPrice = unitPrice
          if (unitPrice > maxPrice) maxPrice = unitPrice
        }

        // 變體分析
        const variant = safeStr(item.variant)
        if (variant) {
          const parts = variant.split(' / ')
          if (parts[0]) {
            colorMap[parts[0]] = (colorMap[parts[0]] ?? 0) + safeNum(item.quantity, 1)
          }
          if (parts[1]) {
            sizeMap[parts[1]] = (sizeMap[parts[1]] ?? 0) + safeNum(item.quantity, 1)
          }
        }

        // 商品類別分析
        const productName = safeStr(item.productName)
        const categoryKeywords: Record<string, string[]> = {
          '洋裝': ['洋裝', '連身裙', '連衣裙'],
          '上衣': ['上衣', '襯衫', 'T恤', '針織衫', '背心'],
          '裙子': ['裙子', '短裙', '長裙', '百褶裙'],
          '褲裝': ['褲', '長褲', '短褲', '牛仔褲'],
          '外套': ['外套', '大衣', '夾克', '風衣'],
          '套裝': ['套裝'],
          '配件': ['包', '帽', '圍巾', '飾品', '耳環', '項鏈'],
        }

        for (const [cat, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some((kw) => productName.includes(kw))) {
            categoryMap[cat] = (categoryMap[cat] ?? 0) + safeNum(item.quantity, 1)
            break
          }
        }
      }
    }

    // 排序並格式化類別
    const sortedCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalItemCount > 0 ? Math.round((count / totalItemCount) * 100) : 0,
      }))

    // 排序尺寸
    const sortedSizes = Object.entries(sizeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([size, count]) => ({ size, count }))

    // 排序色系
    const sortedColors = Object.entries(colorMap)
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => ({ color, count }))

    // 平均客單價
    const avgOrderValue = orders.length > 0 ? Math.round(totalSpend / orders.length) : 0

    // 平均購買間隔天數
    let purchaseFrequencyDays = 0
    if (orderDates.length >= 2) {
      orderDates.sort((a, b) => a.getTime() - b.getTime())
      let totalGap = 0
      for (let i = 1; i < orderDates.length; i++) {
        totalGap += daysBetween(orderDates[i]!, orderDates[i - 1]!)
      }
      purchaseFrequencyDays = Math.round(totalGap / (orderDates.length - 1))
    }

    // 偏好付款方式
    const topPayment = Object.entries(paymentMethodMap).sort((a, b) => b[1] - a[1])[0]
    const preferredPaymentMethod = topPayment
      ? PAYMENT_METHOD_LABELS[topPayment[0]] ?? topPayment[0]
      : '無資料'

    // 偏好物流方式
    const topShipping = Object.entries(shippingMethodMap).sort((a, b) => b[1] - a[1])[0]
    const preferredShippingMethod = topShipping
      ? SHIPPING_METHOD_LABELS[topShipping[0]] ?? topShipping[0]
      : '無資料'

    return {
      userId,
      topCategories: sortedCategories.slice(0, 5),
      topSizes: sortedSizes.slice(0, 5),
      topColors: sortedColors.slice(0, 5),
      avgOrderValue,
      purchaseFrequencyDays,
      preferredPaymentMethod,
      preferredShippingMethod,
      priceRange: {
        min: minPrice === Infinity ? 0 : Math.round(minPrice),
        max: Math.round(maxPrice),
        avg: priceCount > 0 ? Math.round(priceSum / priceCount) : 0,
      },
    }
  } catch (error) {
    console.error(`[BehaviorAnalytics] analyzePreferences 失敗 (userId: ${userId}):`, error)
    return {
      userId,
      topCategories: [],
      topSizes: [],
      topColors: [],
      avgOrderValue: 0,
      purchaseFrequencyDays: 0,
      preferredPaymentMethod: '無資料',
      preferredShippingMethod: '無資料',
      priceRange: { min: 0, max: 0, avg: 0 },
    }
  }
}

// ══════════════════════════════════════════════════════════
// 6. 360° Member View
// ══════════════════════════════════════════════════════════

/**
 * 取得會員 360° 全景資料
 *
 * 匯整所有分析結果為單一視圖，供後台 CRM 頁面使用。
 * 包含基本資料、分數、行為、時間軸、統計。
 *
 * @param userId - 會員 ID
 * @returns 360° 會員全景
 */
export async function getMember360View(userId: string): Promise<Member360View> {
  try {
    const payload = await getPayload({ config })

    // 取得使用者資料
    const user = await payload.findByID({ collection: 'users', id: userId })
    const userData = user as unknown as Record<string, unknown>

    // 等級前台名稱
    let tierCode = 'ordinary'
    const memberTier = userData.memberTier
    if (typeof memberTier === 'string') {
      tierCode = memberTier
    } else if (memberTier && typeof memberTier === 'object') {
      const tierData = memberTier as unknown as Record<string, unknown>
      tierCode = safeStr(tierData.slug) || safeStr(tierData.tierCode) || 'ordinary'
    }
    const tierFrontName = TIER_FRONT_NAMES[tierCode] ?? '會員'

    // 信用分數
    const creditScore = safeNum(userData.creditScore, 100)
    const creditStatus = getCreditStatus(creditScore)
    const creditStatusLabel = CREDIT_STATUS_LABELS[creditStatus] ?? creditStatus

    // 現有標籤
    const userTags = userData.tags as unknown as Array<Record<string, unknown>> | undefined
    const existingTags = (userTags ?? []).map((t) => safeStr(t.tag)).filter(Boolean)

    // ── 並行取得分析結果 ──
    const [rfm, ltv, churn, preferences, autoTagSuggestions] = await Promise.all([
      calculateRFM(userId),
      predictLTV(userId),
      predictChurn(userId),
      analyzePreferences(userId),
      generateAutoTags(userId),
    ])

    // ── 取得最近訂單 ──
    const recentOrdersResult = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
      } satisfies Where,
      sort: '-createdAt',
      limit: 10,
    })

    const recentOrders = recentOrdersResult.docs.map((order) => {
      const o = order as unknown as Record<string, unknown>
      return {
        id: safeStr(o.id),
        date: safeStr(o.createdAt),
        total: safeNum(o.total),
        status: ORDER_STATUS_LABELS[safeStr(o.status)] ?? safeStr(o.status),
      }
    })

    // ── 取得最近退貨 ──
    const recentReturnsResult = await payload.find({
      collection: 'returns',
      where: {
        customer: { equals: userId },
      } satisfies Where,
      sort: '-createdAt',
      limit: 10,
    })

    const recentReturns = recentReturnsResult.docs.map((ret) => {
      const r = ret as unknown as Record<string, unknown>
      const items = r.items as unknown as Array<Record<string, unknown>> | undefined
      const firstItem = items?.[0]
      const reason = firstItem ? safeStr(firstItem.reason) : ''
      return {
        id: safeStr(r.id),
        date: safeStr(r.createdAt),
        amount: safeNum(r.refundAmount),
        reason: RETURN_REASON_LABELS[reason] ?? reason,
      }
    })

    // ── 取得信用分數歷史 ──
    const creditHistoryResult = await payload.find({
      collection: 'credit-score-history',
      where: {
        user: { equals: userId },
      } satisfies Where,
      sort: '-createdAt',
      limit: 20,
    })

    const creditHistory = creditHistoryResult.docs.map((entry) => {
      const e = entry as unknown as Record<string, unknown>
      return {
        date: safeStr(e.createdAt),
        change: safeNum(e.change),
        reason: safeStr(e.description) || safeStr(e.reason),
        score: safeNum(e.newScore),
      }
    })

    // ── 統計 ──
    const allOrdersResult = await payload.find({
      collection: 'orders',
      where: {
        customer: { equals: userId },
        status: { not_in: ['cancelled', 'refunded'] },
      } satisfies Where,
      limit: 0,
    })

    const allReturnsResult = await payload.find({
      collection: 'returns',
      where: {
        customer: { equals: userId },
        status: { not_equals: 'rejected' },
      } satisfies Where,
      limit: 0,
    })

    const totalOrders = allOrdersResult.totalDocs
    const totalReturns = allReturnsResult.totalDocs
    const returnRate = totalOrders > 0 ? Math.round((totalReturns / totalOrders) * 100) / 100 : 0

    return {
      userId,
      name: safeStr(userData.name),
      email: safeStr(userData.email),
      tierFrontName,
      joinDate: safeStr(userData.createdAt),

      creditScore,
      creditStatus: creditStatusLabel,
      churnScore: churn.churnScore,
      churnRisk: churn.riskLevel,
      rfm,
      ltv,

      preferences,
      tags: existingTags,
      autoTagSuggestions,

      recentOrders,
      recentReturns,
      creditHistory,

      totalOrders,
      totalReturns,
      returnRate,
      lifetimeSpend: safeNum(userData.lifetimeSpend) || safeNum(userData.totalSpent),
      annualSpend: safeNum(userData.annualSpend),
      pointsBalance: safeNum(userData.points),
    }
  } catch (error) {
    console.error(`[BehaviorAnalytics] getMember360View 失敗 (userId: ${userId}):`, error)

    // 回傳空殼預設值
    const emptyRFM: RFMScore = {
      userId,
      recency: 1,
      frequency: 1,
      monetary: 1,
      creditWeight: 1.0,
      totalScore: 1.0,
      segment: '一般客群',
    }

    const emptyLTV: LTVPrediction = {
      userId,
      historicalLTV: 0,
      predictedLTV12m: 0,
      predictedLTVLifetime: 0,
      confidence: 0,
      factors: [],
    }

    return {
      userId,
      name: '',
      email: '',
      tierFrontName: '會員',
      joinDate: '',
      creditScore: 100,
      creditStatus: '優質好客人',
      churnScore: 50,
      churnRisk: 'medium',
      rfm: emptyRFM,
      ltv: emptyLTV,
      preferences: {
        userId,
        topCategories: [],
        topSizes: [],
        topColors: [],
        avgOrderValue: 0,
        purchaseFrequencyDays: 0,
        preferredPaymentMethod: '無資料',
        preferredShippingMethod: '無資料',
        priceRange: { min: 0, max: 0, avg: 0 },
      },
      tags: [],
      autoTagSuggestions: [],
      recentOrders: [],
      recentReturns: [],
      creditHistory: [],
      totalOrders: 0,
      totalReturns: 0,
      returnRate: 0,
      lifetimeSpend: 0,
      annualSpend: 0,
      pointsBalance: 0,
    }
  }
}

// ══════════════════════════════════════════════════════════
// 7. Aggregate Analytics for Dashboard
// ══════════════════════════════════════════════════════════

/**
 * 取得 CRM 儀表板總覽資料
 *
 * 匯整全站會員的分佈、趨勢、關鍵指標。
 * 用於後台管理員儀表板。
 *
 * @returns 儀表板總覽資料
 */
export async function getAnalyticsDashboard(): Promise<AnalyticsDashboard> {
  try {
    const payload = await getPayload({ config })

    // ── 取得所有客戶會員 ──
    const allUsersResult = await payload.find({
      collection: 'users',
      where: {
        role: { equals: 'customer' },
      } satisfies Where,
      limit: 10000,
    })

    const allUsers = allUsersResult.docs
    const totalMembers = allUsersResult.totalDocs

    if (totalMembers === 0) {
      return buildEmptyDashboard()
    }

    // ── 計算概覽指標 ──
    let totalCreditScore = 0
    let totalLifetimeSpend = 0
    const tagCountMap: Record<string, number> = {}

    for (const user of allUsers) {
      const u = user as unknown as Record<string, unknown>
      totalCreditScore += safeNum(u.creditScore, 100)
      totalLifetimeSpend += safeNum(u.lifetimeSpend) || safeNum(u.totalSpent)

      // 標籤統計
      const tags = u.tags as unknown as Array<Record<string, unknown>> | undefined
      if (tags) {
        for (const t of tags) {
          const tag = safeStr(t.tag)
          if (tag) {
            tagCountMap[tag] = (tagCountMap[tag] ?? 0) + 1
          }
        }
      }
    }

    const avgCreditScore = Math.round(totalCreditScore / totalMembers)

    // ── 全站退貨率 ──
    const totalOrdersResult = await payload.find({
      collection: 'orders',
      where: {
        status: { not_in: ['cancelled', 'refunded'] },
      } satisfies Where,
      limit: 0,
    })

    const totalReturnsResult = await payload.find({
      collection: 'returns',
      where: {
        status: { not_equals: 'rejected' },
      } satisfies Where,
      limit: 0,
    })

    const overallReturnRate = totalOrdersResult.totalDocs > 0
      ? Math.round((totalReturnsResult.totalDocs / totalOrdersResult.totalDocs) * 100) / 100
      : 0

    // ── RFM 客群分佈（取樣分析） ──
    // 為了效能，最多取 500 位客戶做 RFM 分析
    const sampleSize = Math.min(totalMembers, 500)
    const sampleUsers = allUsers.slice(0, sampleSize)
    const segmentMap: Record<string, number> = {}
    const churnDistMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    const ltvBuckets: Record<string, number> = {
      'NT$0-5,000': 0,
      'NT$5,001-20,000': 0,
      'NT$20,001-50,000': 0,
      'NT$50,001-100,000': 0,
      'NT$100,000+': 0,
    }
    let totalLTV = 0
    let totalChurnScore = 0

    for (const user of sampleUsers) {
      const u = user as unknown as Record<string, unknown>
      const id = safeStr(u.id)
      if (!id) continue

      try {
        // RFM
        const rfm = await calculateRFM(id)
        segmentMap[rfm.segment] = (segmentMap[rfm.segment] ?? 0) + 1

        // Churn
        const churn = await predictChurn(id)
        churnDistMap[churn.riskLevel] = (churnDistMap[churn.riskLevel] ?? 0) + 1
        totalChurnScore += churn.churnScore

        // LTV
        const ltv = await predictLTV(id)
        totalLTV += ltv.predictedLTV12m

        if (ltv.predictedLTV12m <= 5000) ltvBuckets['NT$0-5,000']!++
        else if (ltv.predictedLTV12m <= 20000) ltvBuckets['NT$5,001-20,000']!++
        else if (ltv.predictedLTV12m <= 50000) ltvBuckets['NT$20,001-50,000']!++
        else if (ltv.predictedLTV12m <= 100000) ltvBuckets['NT$50,001-100,000']!++
        else ltvBuckets['NT$100,000+']!++
      } catch {
        // 單一會員分析失敗不影響整體
        continue
      }
    }

    const avgLTV = sampleSize > 0 ? Math.round(totalLTV / sampleSize) : 0
    const avgChurnScore = sampleSize > 0 ? Math.round(totalChurnScore / sampleSize) : 0

    // 客群分佈
    const segmentDistribution = Object.entries(segmentMap)
      .map(([segment, count]) => ({
        segment,
        count,
        percentage: Math.round((count / sampleSize) * 100),
      }))
      .sort((a, b) => b.count - a.count)

    // 流失分佈
    const churnDistribution = Object.entries(churnDistMap).map(([risk, count]) => ({
      risk,
      count,
    }))

    // LTV 分佈
    const ltvDistribution = Object.entries(ltvBuckets).map(([range, count]) => ({
      range,
      count,
    }))

    // 熱門標籤
    const topTags = Object.entries(tagCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count }))

    // ── 月度趨勢（最近 6 個月） ──
    const monthlyTrends: AnalyticsDashboard['monthlyTrends'] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

      try {
        // 新會員
        const newMembersResult = await payload.find({
          collection: 'users',
          where: {
            role: { equals: 'customer' },
            createdAt: {
              greater_than: monthStart.toISOString(),
              less_than: monthEnd.toISOString(),
            },
          } satisfies Where,
          limit: 0,
        })

        // 該月訂單（計算平均消費）
        const monthOrdersResult = await payload.find({
          collection: 'orders',
          where: {
            status: { not_in: ['cancelled', 'refunded'] },
            createdAt: {
              greater_than: monthStart.toISOString(),
              less_than: monthEnd.toISOString(),
            },
          } satisfies Where,
          limit: 500,
        })

        let monthTotalSpend = 0
        for (const order of monthOrdersResult.docs) {
          const o = order as unknown as Record<string, unknown>
          monthTotalSpend += safeNum(o.total)
        }
        const avgSpend = monthOrdersResult.totalDocs > 0
          ? Math.round(monthTotalSpend / monthOrdersResult.totalDocs)
          : 0

        // 流失會員估計：該月超過 90 天未購買的會員數量
        const churnThreshold = new Date(monthEnd.getTime() - 90 * 24 * 60 * 60 * 1000)
        const churnedResult = await payload.find({
          collection: 'users',
          where: {
            role: { equals: 'customer' },
            lastOrderDate: {
              less_than: churnThreshold.toISOString(),
            },
            createdAt: {
              less_than: churnThreshold.toISOString(),
            },
          } satisfies Where,
          limit: 0,
        })

        // 簡化：流失數按比例分配到月份
        const churnedEstimate = Math.round(churnedResult.totalDocs / 6)

        monthlyTrends.push({
          month: monthLabel,
          newMembers: newMembersResult.totalDocs,
          churnedMembers: churnedEstimate,
          avgSpend,
        })
      } catch {
        monthlyTrends.push({
          month: monthLabel,
          newMembers: 0,
          churnedMembers: 0,
          avgSpend: 0,
        })
      }
    }

    return {
      overview: {
        totalMembers,
        avgLTV,
        avgChurnScore,
        avgCreditScore,
        overallReturnRate,
      },
      segmentDistribution,
      churnDistribution,
      ltvDistribution,
      topTags,
      monthlyTrends,
    }
  } catch (error) {
    console.error('[BehaviorAnalytics] getAnalyticsDashboard 失敗:', error)
    return buildEmptyDashboard()
  }
}

/**
 * 建立空白儀表板資料（資料庫無資料時的 fallback）
 */
function buildEmptyDashboard(): AnalyticsDashboard {
  return {
    overview: {
      totalMembers: 0,
      avgLTV: 0,
      avgChurnScore: 0,
      avgCreditScore: 0,
      overallReturnRate: 0,
    },
    segmentDistribution: [
      { segment: '冠軍客群', count: 0, percentage: 0 },
      { segment: '忠實客群', count: 0, percentage: 0 },
      { segment: '潛力忠誠客', count: 0, percentage: 0 },
      { segment: '優質新客', count: 0, percentage: 0 },
      { segment: '流失高風險客', count: 0, percentage: 0 },
      { segment: '沉睡客', count: 0, percentage: 0 },
      { segment: '價格敏感客', count: 0, percentage: 0 },
      { segment: '退貨高風險客', count: 0, percentage: 0 },
    ],
    churnDistribution: [
      { risk: 'low', count: 0 },
      { risk: 'medium', count: 0 },
      { risk: 'high', count: 0 },
      { risk: 'critical', count: 0 },
    ],
    ltvDistribution: [
      { range: 'NT$0-5,000', count: 0 },
      { range: 'NT$5,001-20,000', count: 0 },
      { range: 'NT$20,001-50,000', count: 0 },
      { range: 'NT$50,001-100,000', count: 0 },
      { range: 'NT$100,000+', count: 0 },
    ],
    topTags: [],
    monthlyTrends: [],
  }
}
