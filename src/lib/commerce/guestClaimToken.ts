import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * 訪客轉會員的邀請 token（純函式，可單元測試）
 * ──────────────────────────────────────────
 * 訂單確認信裡的「設定密碼成為會員」連結要帶這個 token。
 *
 * 為什麼要簽章而不是只帶訂單編號：訂單編號是流水號，任何人都猜得到；
 * 沒有簽章的話別人就能拿別人的訂單去建立一個「掛著對方 email」的會員帳號。
 * token 是寄到顧客信箱的 —— 能拿到 token 就等於證明擁有那個信箱。
 *
 * 格式：`base64url(payload).base64url(hmac)`；payload = {o: orderId, e: email, x: expiresAt}
 */

export interface GuestClaimPayload {
  orderId: string | number
  email: string
  /** epoch ms */
  expiresAt: number
}

const b64u = (buf: Buffer | string): string =>
  (typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf).toString('base64url')

function sign(secret: string, body: string): Buffer {
  return createHmac('sha256', secret).update(body).digest()
}

export function createGuestClaimToken(secret: string, input: GuestClaimPayload): string {
  const body = b64u(JSON.stringify({ o: input.orderId, e: input.email, x: input.expiresAt }))
  return `${body}.${b64u(sign(secret, body))}`
}

/** 驗章 + 檢查有效期；任何一關不過都回 null（呼叫端一律當作無效連結） */
export function verifyGuestClaimToken(
  secret: string,
  token: string | null | undefined,
  now = Date.now(),
): GuestClaimPayload | null {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  let provided: Buffer
  try {
    provided = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  const expected = sign(secret, body)
  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      o?: string | number
      e?: string
      x?: number
    }
    if (parsed.o == null || !parsed.e || typeof parsed.x !== 'number') return null
    if (parsed.x <= now) return null
    return { orderId: parsed.o, email: parsed.e, expiresAt: parsed.x }
  } catch {
    return null
  }
}

/** 邀請連結有效期：14 天（顧客收到信通常幾天內會決定要不要加入） */
export const GUEST_CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000
