/**
 * 推薦碼 cookie 的伺服器端讀取（唯一入口）
 * ─────────────────────────────────────────
 * `?ref=xxx` 由 lib/tracking.ts 的 parseAndStoreUTM() 存成 30 天 cookie
 * `ckmu-partner-ref`（last-click 語意）。
 *
 * ⚠️ 一律從 request 的 Cookie header 讀，**不接受 client 在 body 帶推薦碼**：
 * 推薦碼會決定分潤歸因（誰賺佣金）與 referral_attributed 規則條件（能不能吃
 * KOL 專屬折扣），信任前端等於讓任何人自稱帶了 KOL 碼來拿折扣、或把佣金
 * 掛到任意夥伴頭上。
 */
const COOKIE_NAME = 'ckmu-partner-ref'

export function readReferralCodeFromRequest(req: Request): string | undefined {
  const raw = req.headers.get('cookie') || ''
  const match = raw
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_NAME}=`))
  if (!match) return undefined
  try {
    const v = decodeURIComponent(match.slice(COOKIE_NAME.length + 1)).trim()
    return v || undefined
  } catch {
    return undefined
  }
}
