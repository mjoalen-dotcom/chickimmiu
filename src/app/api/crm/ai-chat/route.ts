import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * CRM AI Customer Service Chat API
 * POST /api/crm/ai-chat — AI 客服聊天端點
 *
 * Body: { message, userId?, sessionId?, conversationHistory? }
 * Returns: { reply, intent, shouldEscalate, escalationReason?, suggestedActions? }
 */

// ── 意圖偵測（MVP 版本：關鍵字匹配） ──
type Intent =
  | 'order_inquiry'
  | 'shipping_status'
  | 'return_exchange'
  | 'size_advice'
  | 'points_inquiry'
  | 'credit_score'
  | 'product_recommendation'
  | 'coupon_inquiry'
  | 'tier_upgrade'
  | 'complaint'
  | 'greeting'
  | 'unknown'

interface IntentRule {
  intent: Intent
  keywords: string[]
  label: string
}

const INTENT_RULES: IntentRule[] = [
  { intent: 'order_inquiry', keywords: ['訂單', '出貨', '下單', '購買紀錄', '訂購'], label: '訂單查詢' },
  { intent: 'shipping_status', keywords: ['物流', '配送', '寄送', '到貨', '快遞', '運送', '追蹤'], label: '物流狀態' },
  { intent: 'return_exchange', keywords: ['退貨', '換貨', '退款', '退換', '退回', '不合適'], label: '退換貨' },
  { intent: 'size_advice', keywords: ['尺寸', '大小', '尺碼', '版型', '穿起來', '合身', 'S號', 'M號', 'L號'], label: '尺寸建議' },
  { intent: 'points_inquiry', keywords: ['點數', '紅利', '積分', '兌換', '獎勵'], label: '點數查詢' },
  { intent: 'credit_score', keywords: ['信用', '評分', '信譽', '黑名單', '停權'], label: '信用分數' },
  { intent: 'product_recommendation', keywords: ['推薦', '新品', '搭配', '好看', '適合', '穿搭'], label: '商品推薦' },
  { intent: 'coupon_inquiry', keywords: ['優惠', '折扣', '折價', '優惠券', '促銷', '活動'], label: '優惠券查詢' },
  { intent: 'tier_upgrade', keywords: ['等級', '升級', '會員', 'VIP', '權益'], label: '等級升級' },
  { intent: 'complaint', keywords: ['客訴', '投訴', '不滿', '差評', '生氣', '爛', '騙'], label: '客訴' },
  { intent: 'greeting', keywords: ['你好', '哈囉', '嗨', 'Hi', 'hello', '請問', '在嗎'], label: '打招呼' },
]

function detectIntent(message: string): { intent: Intent; label: string; confidence: number } {
  const lowerMsg = message.toLowerCase()
  let bestMatch: { intent: Intent; label: string; matchCount: number } | null = null

  for (const rule of INTENT_RULES) {
    const matchCount = rule.keywords.filter((kw) => lowerMsg.includes(kw.toLowerCase())).length
    if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.matchCount)) {
      bestMatch = { intent: rule.intent, label: rule.label, matchCount }
    }
  }

  if (bestMatch) {
    return {
      intent: bestMatch.intent,
      label: bestMatch.label,
      confidence: Math.min(bestMatch.matchCount * 0.3 + 0.4, 1.0),
    }
  }

  return { intent: 'unknown', label: '未知意圖', confidence: 0.1 }
}

// ── 升級規則：何時需要轉接真人客服 ──
interface EscalationResult {
  shouldEscalate: boolean
  reason?: string
}

function checkEscalation(
  intent: Intent,
  message: string,
  conversationLength: number,
): EscalationResult {
  // 客訴 → 直接轉人工
  if (intent === 'complaint') {
    return { shouldEscalate: true, reason: '偵測到客訴情緒，建議轉接真人客服' }
  }

  // 退換貨涉及金額 → 轉人工
  if (intent === 'return_exchange' && /金額|退款|賠償/.test(message)) {
    return { shouldEscalate: true, reason: '退換貨涉及金額處理，需要真人確認' }
  }

  // 對話超過 5 輪 → 可能 AI 無法解決
  if (conversationLength > 10) {
    return { shouldEscalate: true, reason: '對話輪數較多，建議轉接真人以提升體驗' }
  }

  // 訊息中包含要求真人客服的關鍵字
  if (/真人|人工|客服人員|轉接/.test(message)) {
    return { shouldEscalate: true, reason: '顧客主動要求轉接真人客服' }
  }

  return { shouldEscalate: false }
}

// ── AI 回覆生成（MVP 版本：模板回覆） ──
const REPLY_TEMPLATES: Record<Intent, string> = {
  order_inquiry:
    '您好！關於您的訂單查詢，請提供您的訂單編號，我可以為您查詢最新狀態。您也可以在「我的訂單」頁面查看所有訂單紀錄。',
  shipping_status:
    '您好！目前我們的出貨時間為下單後 1-3 個工作天，配送約需 1-2 天。如果您想查詢特定訂單的物流進度，請提供訂單編號。',
  return_exchange:
    '您好！我們提供 14 天鑑賞期退換貨服務。請注意商品需保持原包裝、吊牌完整且未穿洗過。如需退換貨，請至「我的訂單」點選退貨申請。',
  size_advice:
    '您好！關於尺寸建議，每件商品頁面都有詳細的尺寸表。如果您可以告訴我身高體重，我可以為您推薦最適合的尺寸。',
  points_inquiry:
    '您好！您可以在「會員中心」查看目前的點數餘額和兌換紀錄。消費每 NT$100 可獲得 1 點，點數可在結帳時折抵使用。',
  credit_score:
    '您好！信用分數反映您的購物信譽，良好的購物習慣（如準時取貨、合理退貨）能提升分數。您可以在「會員中心」查看目前的信用等級。',
  product_recommendation:
    '您好！很高興為您推薦！請問您在找什麼類型的商品呢？例如上衣、下身、洋裝、或外套？告訴我您的風格偏好，我可以為您推薦！',
  coupon_inquiry:
    '您好！請查看「我的優惠券」頁面，可以看到所有可使用的折扣碼。新會員首購另有專屬優惠喔！',
  tier_upgrade:
    '您好！目前會員等級可在「會員中心」查看，累計消費達到門檻即自動升級。升級後享有更多專屬禮遇！',
  complaint:
    '非常抱歉造成您的不便，我們非常重視您的意見。為了更好地為您處理，我將為您轉接專人服務。',
  greeting: '您好！歡迎來到 CHIC KIM & MIU 客服中心，請問有什麼可以幫助您的嗎？',
  unknown:
    '您好！感謝您的訊息。請問您想了解哪方面的資訊呢？我可以幫您查詢訂單、物流、退換貨、尺寸建議、會員權益等。',
}

function generateSuggestedActions(intent: Intent): string[] {
  const actionMap: Partial<Record<Intent, string[]>> = {
    order_inquiry: ['查看我的訂單', '聯繫物流'],
    shipping_status: ['追蹤包裹', '查看訂單'],
    return_exchange: ['申請退貨', '查看退貨政策'],
    size_advice: ['查看尺寸表', '填寫身體資料'],
    points_inquiry: ['查看點數', '兌換商品'],
    coupon_inquiry: ['查看優惠券', '最新活動'],
    tier_upgrade: ['查看會員等級', '查看升級條件'],
    greeting: ['查詢訂單', '推薦商品', '退換貨說明'],
    unknown: ['查詢訂單', '物流追蹤', '退換貨', '尺寸建議'],
  }
  return actionMap[intent] || ['查詢訂單', '物流追蹤', '退換貨']
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, userId, sessionId, conversationHistory } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少訊息內容' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 意圖偵測
    const { intent, label, confidence } = detectIntent(message)

    // 升級規則檢查
    const conversationLength = Array.isArray(conversationHistory) ? conversationHistory.length : 0
    const escalation = checkEscalation(intent, message, conversationLength)

    // 生成回覆
    const reply = REPLY_TEMPLATES[intent]
    const suggestedActions = generateSuggestedActions(intent)

    // 如果有 userId，可額外擷取會員資料增強回覆
    let userContext: Record<string, unknown> | null = null
    if (userId) {
      try {
        const user = await payload.findByID({
          collection: 'users',
          id: userId,
          depth: 1,
        })
        if (user) {
          const tierObj = user.memberTier as unknown as Record<string, unknown> | null
          userContext = {
            name: user.name,
            tierFrontName: tierObj?.frontName || '優雅初遇者',
            points: (user as unknown as Record<string, unknown>).points ?? 0,
          }
        }
      } catch {
        // 使用者資料取得失敗不影響主流程
      }
    }

    // 如果需要轉接，建立客服工單
    if (escalation.shouldEscalate && userId) {
      try {
        await (payload.create as Function)({
          collection: 'customer-service-tickets',
          data: {
            ticketNumber: `CS-${Date.now()}`,
            user: userId,
            channel: 'ai_chat',
            status: 'pending_human',
            priority: intent === 'complaint' ? 'high' : 'normal',
            category: intent === 'unknown' || intent === 'greeting' ? 'other' : intent,
            subject: `AI 轉接：${label}`,
            messages: [
              {
                sender: 'customer',
                content: message,
                timestamp: new Date().toISOString(),
              },
              {
                sender: 'ai',
                content: reply,
                timestamp: new Date().toISOString(),
                metadata: { intent, confidence },
              },
            ],
            escalationReason: escalation.reason,
          },
        })
      } catch (ticketError) {
        console.error('CRM AI Chat: 建立客服工單失敗', ticketError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: userContext
          ? `${(userContext.name as string)}${(userContext.tierFrontName as string)}您好！${reply.slice(3)}`
          : reply,
        intent,
        intentLabel: label,
        confidence,
        shouldEscalate: escalation.shouldEscalate,
        ...(escalation.shouldEscalate ? { escalationReason: escalation.reason } : {}),
        suggestedActions,
        sessionId: sessionId || `session-${Date.now()}`,
      },
    })
  } catch (error) {
    console.error('CRM AI Chat POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
