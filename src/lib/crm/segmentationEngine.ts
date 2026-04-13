/**
 * 會員分群引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 10 大會員分群核心計算邏輯
 *
 * 分群碼（後台）→ 前台稱號（繁體中文）
 * VIP1  → 璀璨忠誠女王    VIP2  → 金曦風格領袖
 * POT1  → 潛力優雅新星    REG1  → 穩定優雅會員
 * REG2  → 價格敏感優雅客  RISK1 → 流失高風險客
 * RISK2 → 退貨觀察客      NEW1  → 優雅初遇新客
 * SLP1  → 沉睡復活客      BLK1  → 高風險警示客
 *
 * 綜合分數公式：
 *   RFM × 40% + Credit × 25% + (LTV + invChurn) × 15% + Behavior × 10% + Tier × 10%
 *
 * ⚠️ 前台介面一律只顯示 segmentLabel
 *    絕對不可出現 VIP1 / BLK1 等分群碼
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { TIER_FRONT_NAMES, TIER_LEVELS } from './tierEngine'
import { getCreditStatus } from './creditScoreEngine'
import {
  calculateRFM,
  predictLTV,
  predictChurn,
  analyzePreferences,
  generateAutoTags,
} from './behaviorAnalytics'

// ══════════════════════════════════════════════════════════
// Types & Definitions
// ══════════════════════════════════════════════════════════

export interface SegmentDef {
  code: string
  label: string
  color: string
  description: string
}

export interface SegmentationConfig {
  rfmWeight: number
  creditWeight: number
  ltvChurnWeight: number
  behaviorWeight: number
  tierWeight: number
}

export const DEFAULT_SEGMENTATION_CONFIG: SegmentationConfig = {
  rfmWeight: 0.40,
  creditWeight: 0.25,
  ltvChurnWeight: 0.15,
  behaviorWeight: 0.10,
  tierWeight: 0.10,
}

/** 10 大會員分群定義 */
export const SEGMENT_DEFINITIONS: Record<string, SegmentDef> = {
  VIP1: { code: 'VIP1', label: '璀璨忠誠女王', color: '#9B59B6', description: '高 RFM + 高信用分數，頂級忠誠客戶' },
  VIP2: { code: 'VIP2', label: '金曦風格領袖', color: '#F1C40F', description: '高綜合分數，活躍優質會員' },
  POT1: { code: 'POT1', label: '潛力優雅新星', color: '#3498DB', description: '新加入但潛力高的會員' },
  REG1: { code: 'REG1', label: '穩定優雅會員', color: '#2ECC71', description: '穩定消費的一般會員' },
  REG2: { code: 'REG2', label: '價格敏感優雅客', color: '#1ABC9C', description: '消費頻率高但客單價偏低' },
  RISK1: { code: 'RISK1', label: '流失高風險客', color: '#E67E22', description: '流失分數高或長期未購買' },
  RISK2: { code: 'RISK2', label: '退貨觀察客', color: '#E74C3C', description: '信用分數偏低且退貨率高' },
  NEW1: { code: 'NEW1', label: '優雅初遇新客', color: '#00BCD4', description: '註冊未滿 30 天的新會員' },
  SLP1: { code: 'SLP1', label: '沉睡復活客', color: '#95A5A6', description: '超過 60 天未購買' },
  BLK1: { code: 'BLK1', label: '高風險警示客', color: '#34495E', description: '信用分數極低或已被黑名單' },
}

// ══════════════════════════════════════════════════════════
// Helper — 從後台 Global 讀取可調整的權重與門檻
// ══════════════════════════════════════════════════════════

interface SegmentThresholds {
  vip1MinScore: number
  vip1MinCredit: number
  vip2MinScore: number
  vip2MinCredit: number
  risk1ChurnThreshold: number
  risk1DaysThreshold: number
  slp1DaysThreshold: number
  newMaxAge: number
  pot1MinScore: number
  pot1MaxAge: number
  pot1MinCredit: number
  reg2MedianThreshold: number
  risk2CreditThreshold: number
  risk2ReturnRateThreshold: number
  blk1CreditThreshold: number
}

const DEFAULT_THRESHOLDS: SegmentThresholds = {
  vip1MinScore: 85,
  vip1MinCredit: 90,
  vip2MinScore: 70,
  vip2MinCredit: 80,
  risk1ChurnThreshold: 70,
  risk1DaysThreshold: 45,
  slp1DaysThreshold: 60,
  newMaxAge: 30,
  pot1MinScore: 55,
  pot1MaxAge: 90,
  pot1MinCredit: 75,
  reg2MedianThreshold: 1500,
  risk2CreditThreshold: 50,
  risk2ReturnRateThreshold: 25,
  blk1CreditThreshold: 30,
}

async function loadConfigFromGlobal(): Promise<{
  weights: SegmentationConfig
  thresholds: SegmentThresholds
}> {
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'segmentation-settings' }) as unknown as Record<string, unknown>

    const w = (settings.weights ?? {}) as unknown as Record<string, unknown>
    const t = (settings.segmentThresholds ?? {}) as unknown as Record<string, unknown>

    const weights: SegmentationConfig = {
      rfmWeight: typeof w.rfmWeight === 'number' ? w.rfmWeight / 100 : DEFAULT_SEGMENTATION_CONFIG.rfmWeight,
      creditWeight: typeof w.creditWeight === 'number' ? w.creditWeight / 100 : DEFAULT_SEGMENTATION_CONFIG.creditWeight,
      ltvChurnWeight: typeof w.ltvChurnWeight === 'number' ? w.ltvChurnWeight / 100 : DEFAULT_SEGMENTATION_CONFIG.ltvChurnWeight,
      behaviorWeight: typeof w.behaviorWeight === 'number' ? w.behaviorWeight / 100 : DEFAULT_SEGMENTATION_CONFIG.behaviorWeight,
      tierWeight: typeof w.tierWeight === 'number' ? w.tierWeight / 100 : DEFAULT_SEGMENTATION_CONFIG.tierWeight,
    }

    const thresholds: SegmentThresholds = {
      vip1MinScore: typeof t.vip1MinScore === 'number' ? t.vip1MinScore : DEFAULT_THRESHOLDS.vip1MinScore,
      vip1MinCredit: typeof t.vip1MinCredit === 'number' ? t.vip1MinCredit : DEFAULT_THRESHOLDS.vip1MinCredit,
      vip2MinScore: typeof t.vip2MinScore === 'number' ? t.vip2MinScore : DEFAULT_THRESHOLDS.vip2MinScore,
      vip2MinCredit: typeof t.vip2MinCredit === 'number' ? t.vip2MinCredit : DEFAULT_THRESHOLDS.vip2MinCredit,
      risk1ChurnThreshold: typeof t.risk1ChurnThreshold === 'number' ? t.risk1ChurnThreshold : DEFAULT_THRESHOLDS.risk1ChurnThreshold,
      risk1DaysThreshold: typeof t.risk1DaysThreshold === 'number' ? t.risk1DaysThreshold : DEFAULT_THRESHOLDS.risk1DaysThreshold,
      slp1DaysThreshold: typeof t.slp1DaysThreshold === 'number' ? t.slp1DaysThreshold : DEFAULT_THRESHOLDS.slp1DaysThreshold,
      newMaxAge: typeof t.newMaxAge === 'number' ? t.newMaxAge : DEFAULT_THRESHOLDS.newMaxAge,
      pot1MinScore: typeof t.pot1MinScore === 'number' ? t.pot1MinScore : DEFAULT_THRESHOLDS.pot1MinScore,
      pot1MaxAge: typeof t.pot1MaxAge === 'number' ? t.pot1MaxAge : DEFAULT_THRESHOLDS.pot1MaxAge,
      pot1MinCredit: typeof t.pot1MinCredit === 'number' ? t.pot1MinCredit : DEFAULT_THRESHOLDS.pot1MinCredit,
      reg2MedianThreshold: typeof t.reg2MedianThreshold === 'number' ? t.reg2MedianThreshold : DEFAULT_THRESHOLDS.reg2MedianThreshold,
      risk2CreditThreshold: typeof t.risk2CreditThreshold === 'number' ? t.risk2CreditThreshold : DEFAULT_THRESHOLDS.risk2CreditThreshold,
      risk2ReturnRateThreshold: typeof t.risk2ReturnRateThreshold === 'number' ? t.risk2ReturnRateThreshold : DEFAULT_THRESHOLDS.risk2ReturnRateThreshold,
      blk1CreditThreshold: typeof t.blk1CreditThreshold === 'number' ? t.blk1CreditThreshold : DEFAULT_THRESHOLDS.blk1CreditThreshold,
    }

    return { weights, thresholds }
  } catch {
    return { weights: DEFAULT_SEGMENTATION_CONFIG, thresholds: DEFAULT_THRESHOLDS }
  }
}

// ══════════════════════════════════════════════════════════
// Score Calculators
// ══════════════════════════════════════════════════════════

/** 將 RFM totalScore (3~15) 正規化為 0-100 */
function normalizeRFM(totalScore: number): number {
  return Math.round(Math.max(0, Math.min(100, ((totalScore - 3) / 12) * 100)))
}

/** 將 LTV 正規化為 0-100（以 NT$200,000 為滿分基準） */
function normalizeLTV(predictedLTV: number): number {
  return Math.round(Math.max(0, Math.min(100, (predictedLTV / 200000) * 100)))
}

/** 反轉流失分數：churnScore 越高 = 越可能流失 → 反轉為越高越好 */
function inverseChurn(churnScore: number): number {
  return Math.round(100 - churnScore)
}

/** 根據偏好檔案的豐富度計算行為分數 */
function calculateBehaviorScore(preferences: {
  topCategories: { count: number }[]
  avgOrderValue: number
  purchaseFrequencyDays: number
}): number {
  let score = 50 // 基礎分

  // 類別多樣性加分
  const categoryCount = preferences.topCategories.length
  score += Math.min(categoryCount * 5, 20)

  // 購買頻率加分（越短越好）
  if (preferences.purchaseFrequencyDays > 0 && preferences.purchaseFrequencyDays <= 14) score += 20
  else if (preferences.purchaseFrequencyDays <= 30) score += 10
  else if (preferences.purchaseFrequencyDays <= 60) score += 5

  // 客單價加分
  if (preferences.avgOrderValue >= 5000) score += 10
  else if (preferences.avgOrderValue >= 2000) score += 5

  return Math.max(0, Math.min(100, score))
}

/** 等級 + 訂閱分數 */
function calculateTierScore(tierCode: string, isSubscriber: boolean): number {
  const level = TIER_LEVELS[tierCode] ?? 0
  let score = Math.round((level / 5) * 80) // 最高 80 分
  if (isSubscriber) score += 20
  return Math.min(100, score)
}

// ══════════════════════════════════════════════════════════
// Core — 單人分群計算
// ══════════════════════════════════════════════════════════

export async function calculateMemberSegment(userId: string): Promise<{
  segment: string
  label: string
  color: string
  scores: { rfm: number; credit: number; ltv: number; churn: number; behavior: number; tier: number; composite: number }
  autoTags: Array<{ tag: string; confidence: number }>
}> {
  const payload = await getPayload({ config })
  const { weights, thresholds } = await loadConfigFromGlobal()

  // ── 載入會員資料 ──
  const user = await payload.findByID({ collection: 'users', id: userId })
  const userData = user as unknown as Record<string, unknown>

  const creditScore = typeof userData.creditScore === 'number' ? userData.creditScore : 60
  const tierCode = typeof userData.tier === 'string' ? userData.tier : 'ordinary'
  const isSubscriber = Boolean(userData.isSubscriber)
  const isBlacklisted = Boolean(userData.isBlacklisted)
  const createdAt = typeof userData.createdAt === 'string' ? new Date(userData.createdAt) : new Date()

  // ── 計算各維度分數 ──
  const [rfmResult, ltvResult, churnResult, preferencesResult, autoTagsResult] = await Promise.all([
    calculateRFM(userId).catch(() => ({ totalScore: 3 }) as { totalScore: number }),
    predictLTV(userId).catch(() => ({ predictedLTV12m: 0 }) as { predictedLTV12m: number }),
    predictChurn(userId).catch(() => ({ churnScore: 50 }) as { churnScore: number }),
    analyzePreferences(userId).catch(() => ({
      topCategories: [] as { category: string; count: number; percentage: number }[],
      avgOrderValue: 0,
      purchaseFrequencyDays: 0,
    })),
    generateAutoTags(userId).catch(() => [] as Array<{ tag: string; confidence: number }>),
  ])

  const rfmScore = normalizeRFM(rfmResult.totalScore)
  const ltvScore = normalizeLTV(ltvResult.predictedLTV12m)
  const churnScore = churnResult.churnScore
  const behaviorScore = calculateBehaviorScore(preferencesResult)
  const tierScore = calculateTierScore(tierCode, isSubscriber)

  // ── 綜合分數 ──
  const ltvChurnCombined = (ltvScore + inverseChurn(churnScore)) / 2
  const compositeScore = Math.round(
    rfmScore * weights.rfmWeight +
    creditScore * weights.creditWeight +
    ltvChurnCombined * weights.ltvChurnWeight +
    behaviorScore * weights.behaviorWeight +
    tierScore * weights.tierWeight,
  )

  // ── 輔助指標 ──
  const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  let daysSinceLastPurchase = 0
  try {
    const lastOrderQuery: Where = {
      customer: { equals: userId },
      status: { not_equals: 'cancelled' },
    }
    const lastOrder = await payload.find({
      collection: 'orders',
      where: lastOrderQuery satisfies Where,
      sort: '-createdAt',
      limit: 1,
    })
    if (lastOrder.docs.length > 0) {
      const orderData = lastOrder.docs[0] as unknown as Record<string, unknown>
      const orderDate = typeof orderData.createdAt === 'string' ? new Date(orderData.createdAt) : new Date()
      daysSinceLastPurchase = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
    } else {
      daysSinceLastPurchase = accountAgeDays
    }
  } catch {
    daysSinceLastPurchase = 999
  }

  let totalOrders = 0
  try {
    const orderCountQuery: Where = {
      customer: { equals: userId },
      status: { not_equals: 'cancelled' },
    }
    const orderResult = await payload.find({
      collection: 'orders',
      where: orderCountQuery satisfies Where,
      limit: 0,
    })
    totalOrders = orderResult.totalDocs
  } catch {
    totalOrders = 0
  }

  let returnRate = 0
  try {
    if (totalOrders > 0) {
      const returnQuery: Where = {
        customer: { equals: userId },
        status: { not_equals: 'rejected' },
      }
      const returnResult = await payload.find({
        collection: 'returns',
        where: returnQuery satisfies Where,
        limit: 0,
      })
      returnRate = (returnResult.totalDocs / totalOrders) * 100
    }
  } catch {
    returnRate = 0
  }

  // ── 分群判定（優先順序由高到低）──
  let segmentCode = 'REG1'

  // 1. BLK1：信用分數 < 30 或被黑名單
  if (creditScore < thresholds.blk1CreditThreshold || isBlacklisted) {
    segmentCode = 'BLK1'
  }
  // 2. RISK2：信用分數 < 50 且退貨率 > 25%
  else if (creditScore < thresholds.risk2CreditThreshold && returnRate > thresholds.risk2ReturnRateThreshold) {
    segmentCode = 'RISK2'
  }
  // 3. VIP1：綜合分 >= 85, 信用 >= 90, 等級 platinum 或 diamond
  else if (
    compositeScore >= thresholds.vip1MinScore &&
    creditScore >= thresholds.vip1MinCredit &&
    (tierCode === 'platinum' || tierCode === 'diamond')
  ) {
    segmentCode = 'VIP1'
  }
  // 4. VIP2：綜合分 >= 70, 信用 >= 80, 等級 gold/platinum/diamond
  else if (
    compositeScore >= thresholds.vip2MinScore &&
    creditScore >= thresholds.vip2MinCredit &&
    (tierCode === 'gold' || tierCode === 'platinum' || tierCode === 'diamond')
  ) {
    segmentCode = 'VIP2'
  }
  // 5. RISK1：流失分 >= 70 或超過 45 天未購
  else if (churnScore >= thresholds.risk1ChurnThreshold || daysSinceLastPurchase > thresholds.risk1DaysThreshold) {
    segmentCode = 'RISK1'
  }
  // 6. SLP1：超過 60 天未購
  else if (daysSinceLastPurchase > thresholds.slp1DaysThreshold) {
    segmentCode = 'SLP1'
  }
  // 7. NEW1：帳齡 < 30 天且訂單 <= 1
  else if (accountAgeDays < thresholds.newMaxAge && totalOrders <= 1) {
    segmentCode = 'NEW1'
  }
  // 8. POT1：綜合分 >= 55, 帳齡 < 90 天, 信用 >= 75
  else if (
    compositeScore >= thresholds.pot1MinScore &&
    accountAgeDays < thresholds.pot1MaxAge &&
    creditScore >= thresholds.pot1MinCredit
  ) {
    segmentCode = 'POT1'
  }
  // 9. REG2：客單價 < 中位數門檻 且頻率 >= 3 次
  else if (
    preferencesResult.avgOrderValue > 0 &&
    preferencesResult.avgOrderValue < thresholds.reg2MedianThreshold &&
    totalOrders >= 3
  ) {
    segmentCode = 'REG2'
  }
  // 10. REG1：預設（穩定會員）

  const def = SEGMENT_DEFINITIONS[segmentCode] ?? SEGMENT_DEFINITIONS.REG1!

  return {
    segment: segmentCode,
    label: def.label,
    color: def.color,
    scores: {
      rfm: rfmScore,
      credit: creditScore,
      ltv: ltvScore,
      churn: churnScore,
      behavior: behaviorScore,
      tier: tierScore,
      composite: compositeScore,
    },
    autoTags: autoTagsResult.map((t) => ({ tag: t.tag, confidence: t.confidence })),
  }
}

// ══════════════════════════════════════════════════════════
// Batch — 每日排程批次分群
// ══════════════════════════════════════════════════════════

export async function runDailySegmentation(): Promise<{
  processed: number
  changed: number
  distribution: Record<string, number>
}> {
  const payload = await getPayload({ config })

  let processed = 0
  let changed = 0
  const distribution: Record<string, number> = {}

  // 初始化分佈計數
  for (const code of Object.keys(SEGMENT_DEFINITIONS)) {
    distribution[code] = 0
  }

  // 分頁遍歷所有會員
  const PAGE_SIZE = 50
  let page = 1
  let hasMore = true

  while (hasMore) {
    try {
      const usersResult = await payload.find({
        collection: 'users',
        limit: PAGE_SIZE,
        page,
        sort: 'createdAt',
      })

      for (const user of usersResult.docs) {
        const userId = typeof user.id === 'string' ? user.id : String(user.id)

        try {
          const result = await calculateMemberSegment(userId)
          processed++
          distribution[result.segment] = (distribution[result.segment] ?? 0) + 1

          // 查詢現有分群紀錄
          const existingQuery: Where = { user: { equals: userId } }
          const existing = await payload.find({
            collection: 'member-segments',
            where: existingQuery satisfies Where,
            limit: 1,
          })

          const now = new Date().toISOString()

          if (existing.docs.length > 0) {
            const doc = existing.docs[0] as unknown as Record<string, unknown>
            const docId = typeof doc.id === 'string' ? doc.id : String(doc.id)
            const prevSegment = typeof doc.currentSegment === 'string' ? doc.currentSegment : ''
            const segmentDidChange = prevSegment !== result.segment

            if (segmentDidChange) changed++

            const existingHistory = Array.isArray(doc.history) ? doc.history : []
            const newHistory = segmentDidChange
              ? [
                  ...existingHistory,
                  {
                    segment: result.segment,
                    score: result.scores.composite,
                    changedAt: now,
                    reason: `自動分群：${prevSegment} → ${result.segment}`,
                  },
                ]
              : existingHistory

            await (payload.update as Function)({
              collection: 'member-segments',
              id: docId,
              data: {
                currentSegment: result.segment,
                segmentLabel: result.label,
                segmentColor: result.color,
                scores: {
                  rfmScore: result.scores.rfm,
                  creditScore: result.scores.credit,
                  ltvScore: result.scores.ltv,
                  churnScore: result.scores.churn,
                  behaviorScore: result.scores.behavior,
                  tierScore: result.scores.tier,
                  compositeScore: result.scores.composite,
                },
                ...(segmentDidChange
                  ? {
                      previousSegment: prevSegment,
                      segmentChangedAt: now,
                    }
                  : {}),
                history: newHistory,
                autoTags: result.autoTags,
              } as unknown as Record<string, unknown>,
            })
          } else {
            // 新建分群紀錄
            await (payload.create as Function)({
              collection: 'member-segments',
              data: {
                user: userId,
                currentSegment: result.segment,
                segmentLabel: result.label,
                segmentColor: result.color,
                scores: {
                  rfmScore: result.scores.rfm,
                  creditScore: result.scores.credit,
                  ltvScore: result.scores.ltv,
                  churnScore: result.scores.churn,
                  behaviorScore: result.scores.behavior,
                  tierScore: result.scores.tier,
                  compositeScore: result.scores.composite,
                },
                segmentChangedAt: now,
                history: [
                  {
                    segment: result.segment,
                    score: result.scores.composite,
                    changedAt: now,
                    reason: '首次分群',
                  },
                ],
                autoTags: result.autoTags,
              } as unknown as Record<string, unknown>,
            })

            changed++
          }
        } catch {
          // 單一會員計算失敗不中斷整批
          console.error(`[分群引擎] 會員 ${userId} 分群計算失敗`)
        }
      }

      hasMore = usersResult.hasNextPage ?? false
      page++
    } catch {
      console.error(`[分群引擎] 第 ${page} 頁查詢失敗，中止批次`)
      hasMore = false
    }
  }

  console.log(`[分群引擎] 批次完成：處理 ${processed} 人，變動 ${changed} 人`)
  console.log('[分群引擎] 分佈：', distribution)

  return { processed, changed, distribution }
}

// ══════════════════════════════════════════════════════════
// Strategy — 分群行銷策略
// ══════════════════════════════════════════════════════════

export function getSegmentStrategy(segment: string): {
  journeySlug: string
  recommendationIntensity: 'aggressive' | 'moderate' | 'gentle' | 'minimal'
  discountEligible: boolean
  lotteryEligible: boolean
  priorityService: boolean
  aiTone: string
} {
  const strategies: Record<string, {
    journeySlug: string
    recommendationIntensity: 'aggressive' | 'moderate' | 'gentle' | 'minimal'
    discountEligible: boolean
    lotteryEligible: boolean
    priorityService: boolean
    aiTone: string
  }> = {
    VIP1: {
      journeySlug: 'vip-exclusive',
      recommendationIntensity: 'aggressive',
      discountEligible: true,
      lotteryEligible: true,
      priorityService: true,
      aiTone: '尊貴且溫暖的專屬服務語氣，讓客人感受頂級禮遇',
    },
    VIP2: {
      journeySlug: 'vip-nurture',
      recommendationIntensity: 'aggressive',
      discountEligible: true,
      lotteryEligible: true,
      priorityService: true,
      aiTone: '熱情且時尚的語氣，強調品味與風格領袖的身份',
    },
    POT1: {
      journeySlug: 'potential-upgrade',
      recommendationIntensity: 'moderate',
      discountEligible: true,
      lotteryEligible: true,
      priorityService: false,
      aiTone: '鼓勵且友善的語氣，引導探索更多產品與風格',
    },
    REG1: {
      journeySlug: 'regular-engagement',
      recommendationIntensity: 'moderate',
      discountEligible: true,
      lotteryEligible: true,
      priorityService: false,
      aiTone: '親切且穩定的語氣，維繫良好的購物體驗',
    },
    REG2: {
      journeySlug: 'value-seeker',
      recommendationIntensity: 'moderate',
      discountEligible: true,
      lotteryEligible: true,
      priorityService: false,
      aiTone: '貼心且實用的語氣，強調超值與划算的購物建議',
    },
    RISK1: {
      journeySlug: 'churn-prevention',
      recommendationIntensity: 'gentle',
      discountEligible: true,
      lotteryEligible: true,
      priorityService: false,
      aiTone: '溫柔且關懷的語氣，表達想念並提供回購誘因',
    },
    RISK2: {
      journeySlug: 'return-reduction',
      recommendationIntensity: 'gentle',
      discountEligible: false,
      lotteryEligible: false,
      priorityService: false,
      aiTone: '專業且耐心的語氣，協助解決尺寸或商品疑慮以減少退貨',
    },
    NEW1: {
      journeySlug: 'welcome-onboard',
      recommendationIntensity: 'moderate',
      discountEligible: true,
      lotteryEligible: true,
      priorityService: false,
      aiTone: '熱情歡迎的語氣，引導了解品牌故事與首購優惠',
    },
    SLP1: {
      journeySlug: 'dormant-wakeup',
      recommendationIntensity: 'gentle',
      discountEligible: true,
      lotteryEligible: false,
      priorityService: false,
      aiTone: '溫暖且喚起記憶的語氣，分享新品與專屬回歸優惠',
    },
    BLK1: {
      journeySlug: 'restricted-service',
      recommendationIntensity: 'minimal',
      discountEligible: false,
      lotteryEligible: false,
      priorityService: false,
      aiTone: '禮貌且簡潔的語氣，僅提供基本客服協助',
    },
  }

  return strategies[segment] ?? strategies.REG1!
}
