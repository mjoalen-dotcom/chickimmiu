/**
 * AI 客服決策引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 智能客服意圖辨識與回應產生
 *
 * 核心功能：
 * - 意圖偵測（關鍵字 + 模式比對）
 * - 情境式回應產生
 * - 自動升級人工客服規則
 *
 * ⚠️ 高 VIP（星耀皇后、璀璨天后）一律優先轉人工
 * ⚠️ 負面情緒、投訴、退款糾紛必須升級
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { getFrontName, isHighVIP } from './tierEngine'
import { getCreditStatus, INITIAL_CREDIT_SCORE } from './creditScoreEngine'

// ── Types ──────────────────────────────────────────────

export type Intent =
  | 'order_inquiry'
  | 'shipping_status'
  | 'return_exchange'
  | 'size_advice'
  | 'points_inquiry'
  | 'tier_inquiry'
  | 'product_recommendation'
  | 'coupon_inquiry'
  | 'upgrade_gap'
  | 'credit_score_inquiry'
  | 'credit_deduction_reason'
  | 'return_credit_impact'
  | 'malicious_return_detection'
  | 'complaint'
  | 'human_request'
  | 'greeting'
  | 'unknown'

export interface AIResponse {
  message: string
  intent: Intent
  confidence: number
  shouldEscalate: boolean
  escalationReason?: string
  suggestedActions?: string[]
  relatedData?: Record<string, unknown>
}

// ── Escalation Rules ───────────────────────────────────

/** 升級人工客服規則 — 符合任一條件即必須升級 */
export const ESCALATION_RULES = {
  /** 偵測到負面情緒 */
  negativeEmotion: true,
  /** 投訴類意圖 */
  complaint: true,
  /** 退款糾紛 */
  refundDispute: true,
  /** 高 VIP 等級（T4 星耀皇后、T5 璀璨天后） */
  highVIP: ['platinum', 'diamond'] as string[],
  /** 同一問題未解決超過 2 次 */
  unresolved2x: true,
  /** 用戶主動要求轉人工 */
  humanRequested: true,
  /** 信用分數相關投訴 */
  creditScoreComplaint: true,
} as const

// ── Intent Detection ───────────────────────────────────

/** 意圖關鍵字比對表 */
const INTENT_PATTERNS: Array<{ intent: Intent; keywords: string[]; weight: number }> = [
  { intent: 'greeting', keywords: ['你好', '嗨', 'hi', 'hello', '哈囉', '安安', '早安', '午安', '晚安'], weight: 0.9 },
  { intent: 'order_inquiry', keywords: ['訂單', '訂購', '下單', '購買紀錄', '買了什麼', '訂單編號', '訂單狀態'], weight: 0.85 },
  { intent: 'shipping_status', keywords: ['出貨', '寄出', '物流', '送貨', '到貨', '配送', '運送', '快遞', '貨到了嗎', '追蹤'], weight: 0.85 },
  { intent: 'return_exchange', keywords: ['退貨', '換貨', '退換', '退款', '退回', '不想要', '要退', '換尺寸'], weight: 0.85 },
  { intent: 'size_advice', keywords: ['尺寸', '尺碼', '大小', '版型', '穿多大', '幾號', '身高', '體重', 'S號', 'M號', 'L號', 'XL'], weight: 0.8 },
  { intent: 'points_inquiry', keywords: ['點數', '積分', '紅利', '點數餘額', '點數到期', '點數怎麼用', '折抵'], weight: 0.85 },
  { intent: 'tier_inquiry', keywords: ['等級', '會員等級', '升級', '會員資格', '優雅初遇者', '曦漾仙子', '優漾女神', '金曦女王', '星耀皇后', '璀璨天后'], weight: 0.85 },
  { intent: 'product_recommendation', keywords: ['推薦', '適合', '搭配', '新品', '熱銷', '建議', '好看'], weight: 0.75 },
  { intent: 'coupon_inquiry', keywords: ['優惠', '折扣', '折價', '優惠碼', '優惠券', '折扣碼', '促銷'], weight: 0.85 },
  { intent: 'upgrade_gap', keywords: ['差多少', '升級要', '還差', '消費多少可以升', '距離升級'], weight: 0.8 },
  { intent: 'credit_score_inquiry', keywords: ['信用分數', '信用', '分數多少', '信用分', '信用評分'], weight: 0.85 },
  { intent: 'credit_deduction_reason', keywords: ['為什麼扣分', '扣分原因', '信用被扣', '分數降低', '為何扣'], weight: 0.9 },
  { intent: 'return_credit_impact', keywords: ['退貨影響', '退貨扣分', '退貨信用', '退貨會扣'], weight: 0.9 },
  { intent: 'malicious_return_detection', keywords: ['惡意', '故意退', '一直退', '退太多'], weight: 0.9 },
  { intent: 'complaint', keywords: ['投訴', '抱怨', '不滿', '太差', '生氣', '客訴', '差評', '爛', '垃圾', '騙人'], weight: 0.95 },
  { intent: 'human_request', keywords: ['真人', '客服', '人工', '轉接', '找人', '真人客服', '主管'], weight: 0.95 },
]

/** 負面情緒關鍵字 */
const NEGATIVE_SENTIMENT_KEYWORDS = [
  '生氣', '憤怒', '不滿', '差勁', '離譜', '太扯', '爛',
  '垃圾', '騙人', '噁心', '失望', '糟糕', '受不了', '火大',
  '氣死', '白痴', '智障', '廢物', '黑心',
]

/**
 * 偵測使用者訊息意圖
 *
 * 使用關鍵字比對搭配權重分數，回傳最高信心度的意圖。
 *
 * @param message - 使用者訊息
 * @returns 意圖與信心度
 */
export function detectIntent(message: string): { intent: Intent; confidence: number } {
  const normalized = message.toLowerCase().trim()

  let bestIntent: Intent = 'unknown'
  let bestScore = 0

  for (const pattern of INTENT_PATTERNS) {
    let matchCount = 0
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      // 信心度 = 基礎權重 * (1 + 額外匹配加成)
      const confidence = Math.min(pattern.weight * (1 + (matchCount - 1) * 0.05), 1)
      if (confidence > bestScore) {
        bestScore = confidence
        bestIntent = pattern.intent
      }
    }
  }

  return { intent: bestIntent, confidence: bestScore }
}

/**
 * 偵測訊息情緒
 *
 * @param message - 使用者訊息
 * @returns 情緒類型
 */
export function detectSentiment(message: string): 'positive' | 'neutral' | 'negative' {
  const normalized = message.toLowerCase()

  for (const keyword of NEGATIVE_SENTIMENT_KEYWORDS) {
    if (normalized.includes(keyword)) return 'negative'
  }

  const positiveKeywords = ['謝謝', '感謝', '棒', '讚', '開心', '滿意', '喜歡', '愛']
  for (const keyword of positiveKeywords) {
    if (normalized.includes(keyword)) return 'positive'
  }

  return 'neutral'
}

// ── Response Generation ────────────────────────────────

/** 各意圖的預設回應模板 */
const RESPONSE_TEMPLATES: Record<Intent, string> = {
  greeting: '您好！歡迎來到 CHIC KIM & MIU 💕 很高興為您服務，請問有什麼可以幫您的呢？',
  order_inquiry: '讓我幫您查詢訂單狀態，請問您的訂單編號是什麼呢？或者我可以幫您查看最近的購買紀錄。',
  shipping_status: '我來幫您確認出貨進度！一般訂單會在付款後 1-3 個工作天出貨，請問您的訂單編號是什麼呢？',
  return_exchange: '了解，我來協助您處理退換貨。請問是商品有問題還是想更換尺寸呢？我們會盡力幫您處理 💝',
  size_advice: '選對尺寸很重要！可以告訴我您的身高體重嗎？我會根據您的身形推薦最適合的尺寸 ✨',
  points_inquiry: '讓我幫您查看點數餘額和使用方式。會員點數可以在結帳時折抵消費喔！',
  tier_inquiry: '讓我幫您查看目前的會員等級和權益。每個等級都有專屬的優惠和禮遇呢！',
  product_recommendation: '很樂意為您推薦！可以告訴我您喜歡的風格或場合嗎？我會挑選最適合您的款式 🌸',
  coupon_inquiry: '讓我幫您查看目前可用的優惠券和促銷活動！',
  upgrade_gap: '讓我幫您計算距離升級還差多少消費金額，升級後會有更多專屬優惠喔！',
  credit_score_inquiry: '讓我幫您查看目前的信用分數。信用分數越高，可享有的會員權益越多呢！',
  credit_deduction_reason: '我來幫您查看信用分數異動的原因。如果有任何疑問，我們都會詳細說明 💕',
  return_credit_impact: '退貨確實會影響信用分數，不過只要正常購物就能逐步提升。有理由的退貨扣分較少，我們理解購物有時需要調整 💝',
  malicious_return_detection: '我理解您的疑慮。我們的信用系統會綜合評估退貨頻率和原因，確保公平對待每一位客人。如有任何問題，歡迎詳細說明 💕',
  complaint: '非常抱歉讓您有不好的體驗 🙏 我馬上為您轉接專人處理，請稍候。',
  human_request: '好的，我馬上為您轉接真人客服，請稍候片刻 💕',
  unknown: '感謝您的訊息！我可能沒完全理解您的意思，能再說明一下嗎？或者我可以幫您轉接客服人員 💕',
}

/**
 * 根據意圖和使用者上下文產生 AI 回應
 *
 * 若需要，會從 Payload 查詢使用者資料以提供個人化回應。
 *
 * @param params - 訊息、使用者 ID、對話歷史
 * @returns AI 回應（含意圖、信心度、是否升級等）
 */
export async function generateResponse(params: {
  message: string
  userId?: string
  conversationHistory?: Array<{ role: string; content: string }>
}): Promise<AIResponse> {
  const { message, userId, conversationHistory } = params

  // 偵測意圖
  const { intent, confidence } = detectIntent(message)
  const sentiment = detectSentiment(message)

  // 取得使用者上下文
  let userTierCode: string | undefined
  let userName: string | undefined
  let creditScore: number | undefined

  if (userId) {
    try {
      const payload = await getPayload({ config })
      const user = await payload.findByID({ collection: 'users', id: userId })
      const userData = user as unknown as Record<string, unknown>
      userName = userData.name as string | undefined
      creditScore = userData.creditScore as number | undefined ?? INITIAL_CREDIT_SCORE

      // 解析等級
      const memberTier = userData.memberTier
      if (memberTier && typeof memberTier === 'object' && 'slug' in memberTier) {
        userTierCode = (memberTier as unknown as Record<string, unknown>).slug as string
      } else if (typeof memberTier === 'string') {
        userTierCode = memberTier
      }
    } catch {
      // 查不到用戶資料不影響回應
    }
  }

  // 計算未解決次數
  const unresolved = conversationHistory
    ? conversationHistory.filter(
        (msg) => msg.role === 'assistant' && msg.content.includes('沒完全理解'),
      ).length
    : 0

  // 檢查是否需要升級人工
  const escalation = shouldEscalateToHuman({
    intent,
    sentiment,
    userTierCode,
    unresolved,
    humanRequested: intent === 'human_request',
  })

  // 產生回應訊息
  let responseMessage = RESPONSE_TEMPLATES[intent] ?? RESPONSE_TEMPLATES.unknown

  // 個人化調整
  if (userName) {
    responseMessage = `${userName} 您好！` + responseMessage.replace(/^您好！/, '')
  }

  // 等級相關回應加入前台名稱
  if (intent === 'tier_inquiry' && userTierCode) {
    const frontName = getFrontName(userTierCode)
    responseMessage = `您目前是尊貴的「${frontName}」會員 ✨ ${responseMessage}`
  }

  // 信用分數相關回應
  if (intent === 'credit_score_inquiry' && creditScore !== undefined) {
    const status = getCreditStatus(creditScore)
    const statusLabel: Record<string, string> = {
      excellent: '優秀',
      normal: '良好',
      watchlist: '一般',
      warning: '待提升',
      blacklist: '需注意',
      suspended: '暫停',
    }
    responseMessage = `您目前的信用分數是 ${creditScore} 分（${statusLabel[status] ?? ''}），${responseMessage}`
  }

  // 升級差額回應
  if (intent === 'upgrade_gap' && userTierCode) {
    // 動態回應由前端或後續 API 補充實際金額
    const frontName = getFrontName(userTierCode)
    responseMessage = `您目前是「${frontName}」，${responseMessage}`
  }

  // 建議動作
  const suggestedActions: string[] = []
  if (intent === 'return_exchange') {
    suggestedActions.push('查看退貨政策', '填寫退貨申請', '聯繫客服')
  }
  if (intent === 'size_advice') {
    suggestedActions.push('填寫身體資料', '查看尺寸表', '瀏覽推薦商品')
  }
  if (intent === 'credit_score_inquiry' || intent === 'credit_deduction_reason') {
    suggestedActions.push('查看信用分數紀錄', '了解提升方式', '聯繫客服')
  }

  return {
    message: escalation.escalate
      ? `${responseMessage}\n\n正在為您轉接專人客服，請稍候...`
      : responseMessage,
    intent,
    confidence,
    shouldEscalate: escalation.escalate,
    escalationReason: escalation.reason,
    suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
    relatedData: {
      ...(userTierCode ? { tierCode: userTierCode, tierFrontName: getFrontName(userTierCode) } : {}),
      ...(creditScore !== undefined ? { creditScore } : {}),
    },
  }
}

// ── Escalation Check ───────────────────────────────────

/**
 * 判斷是否需要升級至人工客服
 *
 * @param params - 判斷參數
 * @returns 是否升級及原因
 */
export function shouldEscalateToHuman(params: {
  intent: Intent
  sentiment: string
  userTierCode?: string
  unresolved: number
  humanRequested: boolean
}): { escalate: boolean; reason?: string } {
  const { intent, sentiment, userTierCode, unresolved, humanRequested } = params

  // 用戶主動要求
  if (humanRequested) {
    return { escalate: true, reason: '用戶主動要求轉接人工客服' }
  }

  // 負面情緒
  if (sentiment === 'negative' && ESCALATION_RULES.negativeEmotion) {
    return { escalate: true, reason: '偵測到負面情緒' }
  }

  // 投訴
  if (intent === 'complaint' && ESCALATION_RULES.complaint) {
    return { escalate: true, reason: '客訴類意圖' }
  }

  // 信用分數投訴
  if (
    (intent === 'credit_deduction_reason' || intent === 'malicious_return_detection') &&
    ESCALATION_RULES.creditScoreComplaint
  ) {
    return { escalate: true, reason: '信用分數相關投訴' }
  }

  // 高 VIP
  if (userTierCode && ESCALATION_RULES.highVIP.includes(userTierCode)) {
    return { escalate: true, reason: `高 VIP 會員（${getFrontName(userTierCode)}）優先轉人工` }
  }

  // 未解決超過 2 次
  if (unresolved >= 2 && ESCALATION_RULES.unresolved2x) {
    return { escalate: true, reason: `同一問題未解決超過 ${unresolved} 次` }
  }

  // 退款糾紛
  if (intent === 'return_exchange' && sentiment === 'negative' && ESCALATION_RULES.refundDispute) {
    return { escalate: true, reason: '退款糾紛（負面情緒 + 退換貨意圖）' }
  }

  return { escalate: false }
}
