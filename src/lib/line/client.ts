import type { Payload } from 'payload'

/**
 * LINE Messaging API client（raw fetch 包裝，repo 慣例不裝 @line/bot-sdk）
 * ----------------------------------------------------------------------
 * 憑證解析（multi-source，比照 Meta CAPI）：
 *   token  = env LINE_CHANNEL_ACCESS_TOKEN → CRMSettings.notificationChannels.lineChannelAccessToken
 *   secret = env LINE_CHANNEL_SECRET       → CRMSettings.notificationChannels.lineChannelSecret
 *
 * 總開關 `notificationChannels.lineMessagingEnabled`（預設關）：
 *   沿用 Shopline 的 Messaging API channel（1661280982），webhook URL 是單一值，
 *   開關打開 = 本站開始主動推播；正式切 webhook 到本站後 Shopline 的 LINE 功能失效。
 *   開關關閉時所有 outbound 都 no-op（webhook inbound 照收 — 訊息能進來代表
 *   webhook 已指向本站，存檔不影響 Shopline）。
 *
 * 缺 token / 開關關閉 = console no-op 不 throw（所有 caller 都是 fire-and-forget）。
 */

export interface LineConfig {
  enabled: boolean
  token: string
  secret: string
}

export type LineMessage = Record<string, unknown> // text / flex / sticker… LINE message object

const LINE_API_BASE = 'https://api.line.me/v2/bot'

export async function getLineConfig(payload: Payload): Promise<LineConfig> {
  let dbToken = ''
  let dbSecret = ''
  let enabled = false
  try {
    const crm = (await payload.findGlobal({ slug: 'crm-settings', depth: 0 })) as unknown as {
      notificationChannels?: {
        lineMessagingEnabled?: boolean
        lineChannelAccessToken?: string
        lineChannelSecret?: string
      }
    }
    const nc = crm?.notificationChannels || {}
    dbToken = nc.lineChannelAccessToken || ''
    dbSecret = nc.lineChannelSecret || ''
    enabled = nc.lineMessagingEnabled === true
  } catch (e) {
    console.error('[line/client] 讀取 crm-settings 失敗:', e instanceof Error ? e.message : String(e))
  }
  return {
    enabled,
    token: process.env.LINE_CHANNEL_ACCESS_TOKEN || dbToken,
    secret: process.env.LINE_CHANNEL_SECRET || dbSecret,
  }
}

async function lineApiPost(
  token: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, error: text.slice(0, 500) }
  }
  return { ok: true, status: res.status }
}

/**
 * 主動推播（計入 LINE 免費額度/計費則數）。
 * 開關關閉或缺 token → no-op 回 false。
 */
export async function pushMessage(
  payload: Payload,
  to: string,
  messages: LineMessage[],
): Promise<boolean> {
  const cfg = await getLineConfig(payload)
  if (!cfg.enabled) {
    console.log(`[line/client] LINE 推播總開關未開，跳過 push → ${to}`)
    return false
  }
  if (!cfg.token) {
    console.warn('[line/client] 缺 LINE channel access token，跳過 push')
    return false
  }
  const r = await lineApiPost(cfg.token, '/message/push', { to, messages })
  if (!r.ok) {
    console.error(`[line/client] push 失敗 (${r.status}) → ${to}:`, r.error)
    return false
  }
  return true
}

/**
 * 用 reply token 回覆（免費、不計推播額度；token 約 1 分鐘內單次有效）。
 * 失敗（多半 token 過期）→ fallback push（需 userId）。
 */
export async function replyMessage(
  payload: Payload,
  replyToken: string,
  messages: LineMessage[],
  fallbackUserId?: string,
): Promise<boolean> {
  const cfg = await getLineConfig(payload)
  if (!cfg.enabled) {
    console.log('[line/client] LINE 推播總開關未開，跳過 reply')
    return false
  }
  if (!cfg.token) {
    console.warn('[line/client] 缺 LINE channel access token，跳過 reply')
    return false
  }
  const r = await lineApiPost(cfg.token, '/message/reply', { replyToken, messages })
  if (r.ok) return true
  console.warn(`[line/client] reply 失敗 (${r.status})${fallbackUserId ? '，改走 push' : ''}:`, r.error)
  if (fallbackUserId) {
    return pushMessage(payload, fallbackUserId, messages)
  }
  return false
}

/** 取使用者 LINE profile（displayName / pictureUrl）；失敗回 null 不 throw */
export async function getProfile(
  payload: Payload,
  userId: string,
): Promise<{ displayName?: string; pictureUrl?: string } | null> {
  const cfg = await getLineConfig(payload)
  if (!cfg.token) return null
  try {
    const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    })
    if (!res.ok) return null
    return (await res.json()) as { displayName?: string; pictureUrl?: string }
  } catch {
    return null
  }
}

/** 純文字 message object 快捷 */
export function textMessage(text: string): LineMessage {
  return { type: 'text', text: text.slice(0, 5000) }
}
