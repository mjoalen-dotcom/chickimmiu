/**
 * 多通道訊息派發器
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷訊息統一發送介面
 *
 * 支援通道：LINE OA、Email、SMS、Push Notification、站內彈窗、EDM
 *
 * 各通道目前為佔位實作（console.log），
 * 待整合實際 API（LINE Messaging API、Resend / SES、SMS Gateway）後替換。
 *
 * 所有發送皆檢查免打擾時間，並於 console 記錄 [Marketing] 前綴日誌。
 *
 * ⚠️ 前台介面一律只顯示 TIER_FRONT_NAMES
 *    絕對不可出現 bronze / silver / gold 等金屬分級名稱
 */

import { getPayload } from 'payload'
import config from '@payload-config'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

export interface SendResult {
  success: boolean
  channel: string
  messageId?: string
  error?: string
}

interface MessageContent {
  subject?: string
  body: string
  htmlBody?: string
  lineFlexMessage?: Record<string, unknown>
}

// ══════════════════════════════════════════════════════════
// Helper — 產生唯一訊息 ID
// ══════════════════════════════════════════════════════════

/** 產生簡易的唯一訊息 ID */
function generateMessageId(channel: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${channel}_${timestamp}_${random}`
}

// ══════════════════════════════════════════════════════════
// Helper — 讀取 CRM 設定
// ══════════════════════════════════════════════════════════

interface CRMSettings {
  lineChannelAccessToken?: string
  lineChannelSecret?: string
  emailSenderName?: string
  emailSenderAddress?: string
  smsApiKey?: string
  smsApiSecret?: string
  pushServerKey?: string
  automationConfig?: {
    quietHoursStart?: number
    quietHoursEnd?: number
  }
}

/**
 * 從 CRM Global 設定讀取通道相關設定
 *
 * @returns CRM 設定物件
 */
async function loadCRMSettings(): Promise<CRMSettings> {
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'crm-settings' }) as unknown as Record<string, unknown>
    return settings as unknown as CRMSettings
  } catch {
    return {}
  }
}

// ══════════════════════════════════════════════════════════
// Core — 統一發送介面
// ══════════════════════════════════════════════════════════

/**
 * 統一多通道訊息發送介面
 *
 * 根據 channel 參數路由到對應的通道發送函式。
 * 發送前檢查免打擾時間。
 *
 * @param userId - 目標會員 ID
 * @param channel - 通道類型
 * @param content - 訊息內容
 * @param campaignId - 關聯活動 ID（可選）
 * @returns 發送結果
 */
export async function sendMessage(
  userId: string,
  channel: 'line' | 'email' | 'sms' | 'push' | 'in_app_popup' | 'edm',
  content: MessageContent,
  campaignId?: string,
): Promise<SendResult> {
  // 檢查免打擾時間
  const quiet = await isQuietHours()
  if (quiet) {
    console.log(`[Marketing] 免打擾時間內，跳過發送 (channel: ${channel}, user: ${userId})`)
    return {
      success: false,
      channel,
      error: '免打擾時間，已排入延遲佇列',
    }
  }

  try {
    switch (channel) {
      case 'line':
        return await sendLineMessage(userId, content.body, content.lineFlexMessage)
      case 'email':
        return await sendEmail(userId, content.subject ?? '', content.htmlBody ?? content.body)
      case 'sms':
        return await sendSMS(userId, content.body)
      case 'push':
        return await sendPushNotification(userId, content.subject ?? '', content.body)
      case 'in_app_popup':
        return await createInAppPopup(userId, content.body, campaignId)
      case 'edm':
        return await sendEDM(userId, content.subject ?? '', content.htmlBody ?? content.body)
      default:
        return {
          success: false,
          channel,
          error: `不支援的通道類型: ${channel}`,
        }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Marketing] 訊息發送失敗 (channel: ${channel}, user: ${userId}):`, error)
    return {
      success: false,
      channel,
      error: errorMessage,
    }
  }
}

// ══════════════════════════════════════════════════════════
// Channel — LINE OA
// ══════════════════════════════════════════════════════════

/**
 * LINE OA 訊息發送
 *
 * 從會員資料取得 lineUid，並使用 LINE Channel Access Token 發送。
 * 目前為 TODO 佔位實作。
 *
 * @param userId - 會員 ID
 * @param content - 文字訊息內容
 * @param flexMessage - LINE Flex Message JSON（可選）
 * @returns 發送結果
 */
async function sendLineMessage(
  userId: string,
  content: string,
  flexMessage?: Record<string, unknown>,
): Promise<SendResult> {
  const payload = await getPayload({ config })
  const settings = await loadCRMSettings()

  // 取得會員的 LINE UID
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>
  const lineUid = typeof user.lineUid === 'string' ? user.lineUid : ''

  if (!lineUid) {
    return {
      success: false,
      channel: 'line',
      error: '會員未綁定 LINE 帳號',
    }
  }

  if (!settings.lineChannelAccessToken) {
    console.warn('[Marketing] LINE Channel Access Token 未設定')
  }

  // TODO: 整合 LINE Messaging API
  // const lineClient = new MessagingApiClient({ channelAccessToken: settings.lineChannelAccessToken })
  // await lineClient.pushMessage({ to: lineUid, messages: [{ type: 'text', text: content }] })

  const messageId = generateMessageId('line')
  const previewContent = content.length > 30 ? content.substring(0, 30) + '...' : content

  console.log(
    `[Marketing] LINE 訊息發送 → lineUid: ${lineUid}, ` +
    `內容: ${previewContent}` +
    (flexMessage ? ', 含 Flex Message' : ''),
  )

  return {
    success: true,
    channel: 'line',
    messageId,
  }
}

// ══════════════════════════════════════════════════════════
// Channel — Email
// ══════════════════════════════════════════════════════════

/**
 * Email 發送
 *
 * 從會員資料取得 email，並使用設定中的寄件者資訊發送。
 * 目前為 TODO 佔位實作。
 *
 * @param userId - 會員 ID
 * @param subject - 郵件主旨
 * @param htmlBody - HTML 郵件內容
 * @returns 發送結果
 */
async function sendEmail(
  userId: string,
  subject: string,
  htmlBody: string,
): Promise<SendResult> {
  const payload = await getPayload({ config })
  const settings = await loadCRMSettings()

  // 取得會員的 Email
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>
  const email = typeof user.email === 'string' ? user.email : ''

  if (!email) {
    return {
      success: false,
      channel: 'email',
      error: '會員未設定 Email',
    }
  }

  const senderName = settings.emailSenderName ?? 'CHIC KIM & MIU'
  const senderAddress = settings.emailSenderAddress ?? 'noreply@chickimmiu.com'

  // TODO: 整合 Email Service（Resend / SES）
  // await resend.emails.send({
  //   from: `${senderName} <${senderAddress}>`,
  //   to: email,
  //   subject,
  //   html: htmlBody,
  // })

  const messageId = generateMessageId('email')

  console.log(
    `[Marketing] Email 發送 → ${email}, ` +
    `主旨: ${subject}, ` +
    `寄件者: ${senderName} <${senderAddress}>`,
  )

  return {
    success: true,
    channel: 'email',
    messageId,
  }
}

// ══════════════════════════════════════════════════════════
// Channel — SMS
// ══════════════════════════════════════════════════════════

/**
 * SMS 發送
 *
 * 從會員資料取得手機號碼，發送簡訊。
 * 目前為 TODO 佔位實作。
 *
 * @param userId - 會員 ID
 * @param content - 簡訊內容
 * @returns 發送結果
 */
async function sendSMS(userId: string, content: string): Promise<SendResult> {
  const payload = await getPayload({ config })

  // 取得會員的手機號碼
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>
  const phone = typeof user.phone === 'string' ? user.phone : ''

  if (!phone) {
    return {
      success: false,
      channel: 'sms',
      error: '會員未設定手機號碼',
    }
  }

  // TODO: 整合 SMS Gateway（如 Twilio、三竹簡訊等）

  const messageId = generateMessageId('sms')
  const previewContent = content.length > 20 ? content.substring(0, 20) + '...' : content

  console.log(`[Marketing] SMS 發送 → ${phone}, 內容: ${previewContent}`)

  return {
    success: true,
    channel: 'sms',
    messageId,
  }
}

// ══════════════════════════════════════════════════════════
// Channel — Push Notification
// ══════════════════════════════════════════════════════════

/**
 * Push Notification 發送
 *
 * 從會員資料取得 push token，發送推播通知。
 * 目前為 TODO 佔位實作。
 *
 * @param userId - 會員 ID
 * @param title - 推播標題
 * @param body - 推播內容
 * @returns 發送結果
 */
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
): Promise<SendResult> {
  const payload = await getPayload({ config })

  // 取得會員的 Push Token
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>
  const pushToken = typeof user.pushToken === 'string' ? user.pushToken : ''

  if (!pushToken) {
    return {
      success: false,
      channel: 'push',
      error: '會員未註冊推播裝置',
    }
  }

  // TODO: 整合 FCM / APNs

  const messageId = generateMessageId('push')

  console.log(`[Marketing] Push 發送 → token: ${pushToken.substring(0, 10)}..., 標題: ${title}`)

  return {
    success: true,
    channel: 'push',
    messageId,
  }
}

// ══════════════════════════════════════════════════════════
// Channel — 站內彈窗
// ══════════════════════════════════════════════════════════

/**
 * 站內彈窗記錄
 *
 * 將彈窗內容寫入資料庫，前端輪詢後顯示。
 * 目前僅寫入日誌，待前端實作彈窗元件後整合。
 *
 * @param userId - 會員 ID
 * @param content - 彈窗內容
 * @param campaignId - 關聯活動 ID（可選）
 * @returns 發送結果
 */
async function createInAppPopup(
  userId: string,
  content: string,
  campaignId?: string,
): Promise<SendResult> {
  // TODO: 寫入 in-app-notifications 集合，前端輪詢顯示

  const messageId = generateMessageId('popup')
  const previewContent = content.length > 30 ? content.substring(0, 30) + '...' : content

  console.log(
    `[Marketing] 站內彈窗 → user: ${userId}, ` +
    `內容: ${previewContent}` +
    (campaignId ? `, 活動: ${campaignId}` : ''),
  )

  return {
    success: true,
    channel: 'in_app_popup',
    messageId,
  }
}

// ══════════════════════════════════════════════════════════
// Channel — EDM 批量發送
// ══════════════════════════════════════════════════════════

/**
 * EDM 發送（批量電子報）
 *
 * 與 Email 類似，但使用 EDM 專屬的發送佇列與追蹤機制。
 * 目前為 TODO 佔位實作。
 *
 * @param userId - 會員 ID
 * @param subject - EDM 主旨
 * @param htmlBody - HTML 內容
 * @returns 發送結果
 */
async function sendEDM(
  userId: string,
  subject: string,
  htmlBody: string,
): Promise<SendResult> {
  const payload = await getPayload({ config })

  // 取得會員的 Email
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>
  const email = typeof user.email === 'string' ? user.email : ''

  if (!email) {
    return {
      success: false,
      channel: 'edm',
      error: '會員未設定 Email',
    }
  }

  // TODO: 整合 EDM 服務（如 Mailchimp Transactional / SendGrid）

  const messageId = generateMessageId('edm')

  console.log(`[Marketing] EDM 發送 → ${email}, 主旨: ${subject}`)

  return {
    success: true,
    channel: 'edm',
    messageId,
  }
}

// ══════════════════════════════════════════════════════════
// Core — 免打擾時間檢查
// ══════════════════════════════════════════════════════════

/**
 * 檢查免打擾時間
 *
 * 從 CRM 設定的 automationConfig 讀取 quietHoursStart / quietHoursEnd，
 * 檢查目前時間（台灣時區 UTC+8）是否在免打擾時段內。
 *
 * 預設免打擾時段：22:00 ~ 08:00
 *
 * @returns 是否在免打擾時段內
 */
export async function isQuietHours(): Promise<boolean> {
  const settings = await loadCRMSettings()

  const quietStart = settings.automationConfig?.quietHoursStart ?? 22
  const quietEnd = settings.automationConfig?.quietHoursEnd ?? 8

  // 取得台灣時間（UTC+8）
  const now = new Date()
  const taiwanHour = (now.getUTCHours() + 8) % 24

  // 處理跨午夜的情況（例如 22:00 ~ 08:00）
  if (quietStart > quietEnd) {
    // 跨午夜：22-24 或 0-8 為免打擾
    return taiwanHour >= quietStart || taiwanHour < quietEnd
  }

  // 不跨午夜（例如 01:00 ~ 06:00）
  return taiwanHour >= quietStart && taiwanHour < quietEnd
}

// ══════════════════════════════════════════════════════════
// Core — 批量發送
// ══════════════════════════════════════════════════════════

/** 批量發送批次大小 */
const BATCH_SIZE = 50

/** 批次間延遲（毫秒） */
const BATCH_DELAY_MS = 1000

/**
 * 批量發送（多用戶同一訊息）
 *
 * 將用戶分批，每批 50 人，批次之間延遲 1 秒以控制發送速率。
 *
 * @param userIds - 目標會員 ID 陣列
 * @param channel - 通道類型
 * @param content - 訊息內容
 * @param campaignId - 關聯活動 ID（可選）
 * @returns 批量發送統計
 */
export async function batchSend(
  userIds: string[],
  channel: string,
  content: { subject?: string; body: string; htmlBody?: string },
  campaignId?: string,
): Promise<{ sent: number; failed: number; results: SendResult[] }> {
  let sent = 0
  let failed = 0
  const results: SendResult[] = []

  console.log(`[Marketing] 批量發送開始: ${userIds.length} 位會員, 通道: ${channel}`)

  // 分批處理
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.allSettled(
      batch.map((userId) =>
        sendMessage(
          userId,
          channel as 'line' | 'email' | 'sms' | 'push' | 'in_app_popup' | 'edm',
          content,
          campaignId,
        ),
      ),
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
        if (result.value.success) {
          sent++
        } else {
          failed++
        }
      } else {
        failed++
        results.push({
          success: false,
          channel,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
      }
    }

    // 批次間延遲（非最後一批時）
    if (i + BATCH_SIZE < userIds.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  console.log(`[Marketing] 批量發送完成: 成功=${sent}, 失敗=${failed}`)

  return { sent, failed, results }
}
