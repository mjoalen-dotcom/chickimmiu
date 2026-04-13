/**
 * 信用分數計算引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 會員信用分數核心邏輯
 *
 * 分數範圍：0 ~ 100（初始 60）
 * 用途：決定退貨額度、優惠券資格、黑名單管理
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

// ── Types ──────────────────────────────────────────────

export interface CreditScoreConfig {
  // Rewards
  firstRegister: number
  firstPurchase: number
  normalPurchase: number
  purchaseAmountBonus: number
  purchaseAmountBonusMax: number
  goodReview: number
  photoReview: number
  referralSuccess: number
  birthdayBonus: number
  subscriberMonthly: number
  onTimeDelivery: number
  goodCustomerReward: number

  // Penalties
  returnGeneral: { min: number; max: number }
  returnNoReason: number
  returnNoReasonConsecutive2: number
  returnNoReasonConsecutive3Plus: number
  returnRatePenalty: number
  returnRateThreshold: number
  returnRateWindowDays: number
  abandonedCart: number
  maliciousCancel: number

  // Thresholds
  excellentThreshold: number
  normalThreshold: number
  watchlistThreshold: number
  warningThreshold: number
  blacklistThreshold: number
  suspendedThreshold: number
}

/** 預設信用分數設定值 */
export const DEFAULT_CREDIT_SCORE_CONFIG: CreditScoreConfig = {
  // Rewards
  firstRegister: 10,
  firstPurchase: 15,
  normalPurchase: 8,
  purchaseAmountBonus: 2,       // 每 1000 TWD 額外 +2
  purchaseAmountBonusMax: 10,   // 上限 +10
  goodReview: 10,
  photoReview: 12,
  referralSuccess: 18,
  birthdayBonus: 10,
  subscriberMonthly: 5,
  onTimeDelivery: 5,
  goodCustomerReward: 10,       // 分數 >= 95 時獎勵

  // Penalties
  returnGeneral: { min: -8, max: -15 },
  returnNoReason: -25,
  returnNoReasonConsecutive2: -35,
  returnNoReasonConsecutive3Plus: -50,
  returnRatePenalty: -15,       // 30 天退貨率 > 40%
  returnRateThreshold: 0.4,
  returnRateWindowDays: 30,
  abandonedCart: -6,
  maliciousCancel: -20,

  // Thresholds
  excellentThreshold: 90,
  normalThreshold: 70,
  watchlistThreshold: 50,
  warningThreshold: 30,
  blacklistThreshold: 10,
  suspendedThreshold: 0,
}

/** 初始信用分數（註冊時預設） */
export const INITIAL_CREDIT_SCORE = 100

// ── Credit Status ──────────────────────────────────────

export type CreditStatus = 'excellent' | 'normal' | 'watchlist' | 'warning' | 'blacklist' | 'suspended'

/**
 * 根據分數取得信用狀態
 * @param score - 目前信用分數
 * @param config - 可選的部分設定覆蓋
 */
export function getCreditStatus(score: number, config?: Partial<CreditScoreConfig>): CreditStatus {
  const c = { ...DEFAULT_CREDIT_SCORE_CONFIG, ...config }

  if (score >= c.excellentThreshold) return 'excellent'
  if (score >= c.normalThreshold) return 'normal'
  if (score >= c.watchlistThreshold) return 'watchlist'
  if (score >= c.warningThreshold) return 'warning'
  if (score > c.suspendedThreshold) return 'blacklist'
  return 'suspended'
}

// ── Reason mapping ─────────────────────────────────────

/** 原因代碼對照表 */
export type CreditScoreReason =
  | 'first_register'
  | 'first_purchase'
  | 'purchase'
  | 'on_time_delivery'
  | 'good_review'
  | 'photo_review'
  | 'referral_success'
  | 'birthday_bonus'
  | 'subscriber_bonus'
  | 'good_customer_reward'
  | 'return_general'
  | 'return_no_reason'
  | 'return_malicious'
  | 'return_rate_penalty'
  | 'abandoned_cart'
  | 'malicious_cancel'
  | 'admin_adjustment'
  | 'monthly_decay'

/**
 * 根據原因代碼取得預設分數變動
 * @param reason - 原因代碼
 * @param config - 可選的部分設定覆蓋
 */
export function getScoreChangeByReason(
  reason: CreditScoreReason,
  config?: Partial<CreditScoreConfig>,
): number {
  const c = { ...DEFAULT_CREDIT_SCORE_CONFIG, ...config }

  const mapping: Record<string, number> = {
    first_register: c.firstRegister,
    first_purchase: c.firstPurchase,
    purchase: c.normalPurchase,
    on_time_delivery: c.onTimeDelivery,
    good_review: c.goodReview,
    photo_review: c.photoReview,
    referral_success: c.referralSuccess,
    birthday_bonus: c.birthdayBonus,
    subscriber_bonus: c.subscriberMonthly,
    good_customer_reward: c.goodCustomerReward,
    return_general: c.returnGeneral.min,
    return_no_reason: c.returnNoReason,
    return_malicious: c.maliciousCancel,
    return_rate_penalty: c.returnRatePenalty,
    abandoned_cart: c.abandonedCart,
    malicious_cancel: c.maliciousCancel,
    admin_adjustment: 0,
    monthly_decay: -2,
  }

  return mapping[reason] ?? 0
}

// ── Core Functions ─────────────────────────────────────

export interface AdjustCreditScoreParams {
  userId: string
  reason: CreditScoreReason
  /** 自訂變動分數（覆蓋預設值） */
  customChange?: number
  description?: string
  relatedOrderId?: string
  relatedReturnId?: string
  metadata?: Record<string, unknown>
}

export interface AdjustCreditScoreResult {
  previousScore: number
  newScore: number
  change: number
  status: CreditStatus
}

/**
 * 調整會員信用分數
 *
 * 會自動記錄到 credit-score-history 並更新 Users 的 creditScore 欄位。
 * 分數限制在 0 ~ 100 之間。
 *
 * @param params - 調整參數
 * @returns 調整結果：前後分數、變動值、新狀態
 */
export async function adjustCreditScore(
  params: AdjustCreditScoreParams,
): Promise<AdjustCreditScoreResult> {
  const { userId, reason, customChange, description, relatedOrderId, relatedReturnId, metadata } =
    params

  const payload = await getPayload({ config })

  // 取得目前分數
  const user = await payload.findByID({ collection: 'users', id: userId })
  const previousScore = (user as unknown as Record<string, unknown>).creditScore as number | undefined ?? INITIAL_CREDIT_SCORE

  // 計算變動
  const change = customChange ?? getScoreChangeByReason(reason)

  // 限制在 0 ~ 100
  const newScore = Math.max(0, Math.min(100, previousScore + change))

  // 寫入歷史紀錄
  await (payload.create as Function)({
    collection: 'credit-score-history',
    data: {
      user: userId,
      previousScore,
      newScore,
      change,
      reason,
      description: description ?? '',
      ...(relatedOrderId ? { relatedOrder: relatedOrderId } : {}),
      ...(relatedReturnId ? { relatedReturn: relatedReturnId } : {}),
      metadata: metadata ?? {},
    },
  })

  // 更新 User 的 creditScore
  await (payload.update as Function)({
    collection: 'users',
    id: userId,
    data: { creditScore: newScore } as unknown as Record<string, unknown>,
  })

  const status = getCreditStatus(newScore)

  return { previousScore, newScore, change, status }
}

// ── Return Penalty Calculation ─────────────────────────

export interface CalculateReturnPenaltyParams {
  returnAmount: number
  orderTotal: number
  consecutiveNoReasonReturns: number
  isNoReason: boolean
  config?: Partial<CreditScoreConfig>
}

/**
 * 計算退貨扣分
 *
 * 邏輯：
 * - 有理由退貨：依退貨金額佔訂單比例，在 min ~ max 之間線性內插
 * - 無理由退貨：依連續次數階梯式加重
 *
 * @param params - 退貨參數
 * @returns 扣除分數（負值）
 */
export function calculateReturnPenalty(params: CalculateReturnPenaltyParams): number {
  const {
    returnAmount,
    orderTotal,
    consecutiveNoReasonReturns,
    isNoReason,
    config: partialConfig,
  } = params
  const c = { ...DEFAULT_CREDIT_SCORE_CONFIG, ...partialConfig }

  if (isNoReason) {
    // 無理由退貨：階梯式加重
    if (consecutiveNoReasonReturns >= 3) return c.returnNoReasonConsecutive3Plus
    if (consecutiveNoReasonReturns >= 2) return c.returnNoReasonConsecutive2
    return c.returnNoReason
  }

  // 有理由退貨：依退貨金額佔訂單比例線性內插
  const ratio = orderTotal > 0 ? Math.min(returnAmount / orderTotal, 1) : 0
  const { min, max } = c.returnGeneral
  // min = -8（輕微），max = -15（全額退貨）
  // ratio 0 → min，ratio 1 → max
  return Math.round(min + (max - min) * ratio)
}

/**
 * 檢查 30 天退貨率並決定是否額外扣分
 *
 * 若 30 天內退貨率 > 40%，則回傳額外扣分值。
 *
 * @param userId - 會員 ID
 * @returns 額外扣分值（0 或負值）
 */
export async function checkReturnRatePenalty(userId: string): Promise<number> {
  const c = DEFAULT_CREDIT_SCORE_CONFIG
  const payload = await getPayload({ config })

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - c.returnRateWindowDays)

  // 查詢期間內的訂單數量
  const ordersResult = await payload.find({
    collection: 'orders',
    where: {
      customer: { equals: userId },
      createdAt: { greater_than: windowStart.toISOString() },
    } satisfies Where,
    limit: 0,
  })
  const totalOrders = ordersResult.totalDocs

  if (totalOrders === 0) return 0

  // 查詢期間內的退貨數量
  const returnsResult = await payload.find({
    collection: 'returns',
    where: {
      customer: { equals: userId },
      createdAt: { greater_than: windowStart.toISOString() },
      status: { not_equals: 'rejected' },
    } satisfies Where,
    limit: 0,
  })
  const totalReturns = returnsResult.totalDocs

  const returnRate = totalReturns / totalOrders

  if (returnRate > c.returnRateThreshold) {
    return c.returnRatePenalty
  }

  return 0
}

// ── Purchase Amount Bonus ──────────────────────────────

/**
 * 計算購買金額加分
 *
 * 每 1000 TWD 額外 +2，上限 +10
 *
 * @param orderAmount - 訂單金額（TWD）
 * @param config - 可選的部分設定覆蓋
 * @returns 額外加分值
 */
export function calculatePurchaseAmountBonus(
  orderAmount: number,
  partialConfig?: Partial<CreditScoreConfig>,
): number {
  const c = { ...DEFAULT_CREDIT_SCORE_CONFIG, ...partialConfig }
  const bonus = Math.floor(orderAmount / 1000) * c.purchaseAmountBonus
  return Math.min(bonus, c.purchaseAmountBonusMax)
}

// ── Notification Messages ──────────────────────────────

export interface CreditChangeNotification {
  title: string
  message: string
  severity: 'info' | 'warning' | 'danger'
}

/**
 * 根據分數變動產生通知訊息
 *
 * 訊息風格為溫暖鼓勵，即使扣分也保持親切。
 *
 * @param change - 分數變動值
 * @param newScore - 變動後的新分數
 * @param reason - 變動原因說明
 * @returns 通知內容
 */
export function getCreditChangeNotification(
  change: number,
  newScore: number,
  reason: string,
): CreditChangeNotification {
  const status = getCreditStatus(newScore)

  // 加分通知
  if (change > 0) {
    return {
      title: '信用分數提升',
      message: `太棒了！感謝您的支持，您的信用分數已提升 🌟 (+${change} 分，目前 ${newScore} 分)`,
      severity: 'info',
    }
  }

  // 扣分通知 — 依嚴重程度分級
  if (status === 'blacklist' || status === 'suspended') {
    return {
      title: '信用分數提醒',
      message: `您的信用分數較低，部分會員優惠將暫時受限。歡迎透過購物提升分數！(目前 ${newScore} 分)`,
      severity: 'danger',
    }
  }

  if (status === 'warning' || status === 'watchlist') {
    return {
      title: '溫馨提醒',
      message: `溫馨提醒：頻繁退貨會影響您的會員權益，如有任何問題歡迎聯繫客服 💝 (目前 ${newScore} 分)`,
      severity: 'warning',
    }
  }

  // 輕微扣分
  return {
    title: '信用分數異動通知',
    message: `您是我們重視的好客人，請繼續保持喔～ (${change} 分，目前 ${newScore} 分)`,
    severity: 'info',
  }
}
