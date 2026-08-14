/**
 * 社群登入 email 可信度判定（純函式，無外部依賴 — 可單元測試）
 * ------------------------------------------------------------
 * 為什麼需要這一層：`socialIdentity.linkOrCreateSocialUser` 的第 2 順位是
 * 「email 相同 → 綁進既有會員」。若 provider 回的 email 沒有經過驗證，攻擊者
 * 只要在該 provider 註冊一個掛著受害者 email 的帳號，登入後就會直接被綁進
 * 受害者的 CKMU 會員 → 訂單、點數、地址、購物金全部拿走（帳號接管）。
 *
 * 原生 App 那條路（/api/v1/auth/social）早就有這道防線：
 *   `const trustedEmail = identity.emailVerified ? identity.email : null`
 * 網頁這條（NextAuth signIn callback）先前直接把 `user.email` 交出去，缺同一道
 * 檢查。這支檔案把判定抽成純函式，兩條路徑用同一套規則。
 *
 * 判定規則（provider 各自的官方語意）：
 * - google  : OIDC id_token 一定帶 `email_verified`，只認 true。
 * - apple    : id_token 帶 `email_verified`，Apple 有時序列化成字串 "true"。
 * - line     : LINE Login 只有在 channel 申請到 email 權限、且使用者的 email
 *              已經由 LINE 驗證過時才會回傳，回傳即等於已驗證（無此 claim）。
 * - facebook : profile 不提供任何驗證聲明 → 一律不採信（只能用來建新帳號，
 *              不可用來匹配既有會員）。
 * - 其他/未知 : 不採信（fail closed）。
 */

/** provider 回傳的 email 是否可信到足以「匹配既有會員」 */
export function isProviderEmailVerified(
  provider: string | null | undefined,
  profile: Record<string, unknown> | null | undefined,
): boolean {
  const claim = profile?.email_verified
  switch ((provider || '').toLowerCase()) {
    case 'google':
      return claim === true
    case 'apple':
      // Apple 的 id_token 會把 boolean 序列化成字串（"true" / "false"）
      return claim === true || claim === 'true'
    case 'line':
      // 無 email_verified claim；LINE 只回傳已驗證的 email
      return true
    case 'facebook':
    default:
      return false
  }
}

/**
 * 取出「可用於匹配既有會員」的 email。
 * 未驗證 → 回 null，呼叫端就會走 socialId-only 路徑（新帳號用 placeholder email）。
 */
export function trustedEmailFrom(
  provider: string | null | undefined,
  profile: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): string | null {
  if (!email) return null
  return isProviderEmailVerified(provider, profile) ? email : null
}
