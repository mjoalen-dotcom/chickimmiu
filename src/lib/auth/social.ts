/**
 * 社群登入共用常數/helpers（純函式，無 payload 依賴 — client/server 都可 import）
 */

/** NextAuth provider 名 → Users.socialLogins 欄位名 */
export const PROVIDER_SOCIAL_FIELD: Record<string, 'googleId' | 'facebookId' | 'lineId' | 'appleId'> = {
  google: 'googleId',
  facebook: 'facebookId',
  line: 'lineId',
  apple: 'appleId',
}

/**
 * 無 email 社群帳號的 placeholder email
 * ------------------------------------
 * 台灣 LINE 用戶很多沒設 email，但 Payload Users auth 必填 email。
 * 用 `.invalid` TLD（RFC 2606 保留，永不可投遞）合成一個可辨識的假信箱；
 * 寄信端用 isPlaceholderEmail() 跳過這類地址。
 */
export const PLACEHOLDER_EMAIL_DOMAIN = 'noemail.invalid'

export function placeholderEmailFor(provider: string, providerAccountId: string): string {
  // providerAccountId 可能含大寫（LINE sub 是 U + hex），Payload 內部 email 一律 lowercase
  return `${provider}_${providerAccountId}`.toLowerCase() + `@${PLACEHOLDER_EMAIL_DOMAIN}`
}

export function isPlaceholderEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`))
}
