import crypto from 'node:crypto'

/**
 * LINE webhook 簽章驗證
 * --------------------
 * LINE 對每個 webhook POST 附 `x-line-signature` header =
 * Base64(HMAC-SHA256(channel secret, raw request body))。
 * 必須對「原始 body 字串」算，JSON.parse 再 stringify 會因鍵序/空白差異驗不過 —
 * route 端要先 `await request.text()` 驗完才能 parse。
 *
 * timingSafeEqual 寫法同 src/lib/cron/auth.ts（避免 timing attack）。
 */
export function verifyLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
