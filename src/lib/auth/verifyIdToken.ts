import { createPublicKey, createVerify, timingSafeEqual, createHash, type JsonWebKey } from 'node:crypto'

/**
 * 原生 App 的 Google / Apple id_token 驗證（server-only，零外部套件）
 * -----------------------------------------------------------------
 * 網頁走 NextAuth authorization-code flow（瀏覽器轉址）；原生 App 不能也不該那樣做，
 * iOS/Android 用官方 SDK（Google Sign-In / ASAuthorizationAppleIDProvider）拿到 id_token
 * 後直接 POST 給我們，由這裡驗簽 → 換 Payload Bearer token。
 *
 * 驗證項目（缺一不可）：
 *   1. header.alg = RS256、kid 對得上 provider JWKS 上的公鑰，且簽章正確
 *   2. iss 是 provider 官方 issuer
 *   3. aud ∈ 我們登記的 client id（web / iOS / Android 各一組，見 socialCredentials）
 *   4. exp 未過期、iat 不在未來（±120 秒時鐘容差）
 *   5. 呼叫端有給 nonce 時，token 內 nonce 必須相符（Apple 存 SHA256、Google 存原文，兩種都比）
 *
 * 不做 `jose` 依賴的原因：pnpm 不 hoist，且 Apple client secret 簽發（socialCredentials.ts）
 * 已經用 node:crypto 走通同一條路，維持一致。
 */

export type IdTokenProvider = 'google' | 'apple'

export type VerifiedIdentity = {
  provider: IdTokenProvider
  /** id_token 的 sub —— 寫進 Users.socialLogins.{googleId,appleId} */
  sub: string
  email: string | null
  emailVerified: boolean
  /** Google 會給；Apple 的 id_token 永遠沒有名字（App 要在首次登入時自己帶上來） */
  name: string | null
}

type ProviderSpec = {
  jwksUrl: string
  issuers: string[]
}

const PROVIDERS: Record<IdTokenProvider, ProviderSpec> = {
  google: {
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  },
  apple: {
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
  },
}

const CLOCK_SKEW_SEC = 120
const JWKS_TTL_MS = 60 * 60 * 1000 // 1 小時；kid 找不到時無視 TTL 立刻重抓（provider 輪替金鑰）

const jwksCache: Partial<Record<IdTokenProvider, { at: number; keys: JsonWebKey[] }>> = {}

async function fetchJwks(provider: IdTokenProvider, force = false): Promise<JsonWebKey[]> {
  const cached = jwksCache[provider]
  if (!force && cached && Date.now() - cached.at < JWKS_TTL_MS) return cached.keys

  const res = await fetch(PROVIDERS[provider].jwksUrl, { cache: 'no-store' })
  if (!res.ok) {
    // 抓不到就沿用舊快取（provider 短暫故障不該讓全部 App 使用者登不進來）
    if (cached) return cached.keys
    throw new Error(`無法取得 ${provider} JWKS（HTTP ${res.status}）`)
  }
  const body = (await res.json()) as { keys?: JsonWebKey[] }
  const keys = Array.isArray(body.keys) ? body.keys : []
  jwksCache[provider] = { at: Date.now(), keys }
  return keys
}

function b64urlToBuffer(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function safeEqualStr(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export class IdTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IdTokenError'
  }
}

/**
 * 驗證原生 App 傳來的 id_token。驗不過一律丟 IdTokenError（呼叫端回 401）。
 *
 * @param allowedAudiences 這個 provider 允許的 client id 清單（web + iOS + Android）。
 *                         空陣列代表尚未設定憑證 → 直接拒絕，不做無 aud 檢查的驗證。
 */
export async function verifyIdToken(input: {
  provider: IdTokenProvider
  idToken: string
  allowedAudiences: string[]
  /** App 端發起授權時用的 nonce（原文）。有給就強制比對。 */
  nonce?: string | null
}): Promise<VerifiedIdentity> {
  const { provider, idToken } = input
  const audiences = input.allowedAudiences.filter(Boolean)
  if (audiences.length === 0) {
    throw new IdTokenError(`${provider} 尚未設定 client id（後台社群登入設定或 .env）`)
  }

  const parts = idToken.split('.')
  if (parts.length !== 3) throw new IdTokenError('id_token 格式錯誤')
  const [rawHeader, rawPayload, rawSignature] = parts

  let header: { alg?: string; kid?: string }
  let claims: Record<string, unknown>
  try {
    header = JSON.parse(b64urlToBuffer(rawHeader).toString('utf8'))
    claims = JSON.parse(b64urlToBuffer(rawPayload).toString('utf8'))
  } catch {
    throw new IdTokenError('id_token 解析失敗')
  }

  if (header.alg !== 'RS256') throw new IdTokenError(`不支援的簽章演算法：${header.alg}`)
  if (!header.kid) throw new IdTokenError('id_token 缺 kid')

  // ── 1. 簽章 ──
  let keys = await fetchJwks(provider)
  let jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid)
  if (!jwk) {
    // provider 輪替過金鑰 → 強制重抓一次再找
    keys = await fetchJwks(provider, true)
    jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid)
  }
  if (!jwk) throw new IdTokenError('id_token 的 kid 不在 provider 公鑰清單中')

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' })
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${rawHeader}.${rawPayload}`)
  verifier.end()
  if (!verifier.verify(publicKey, b64urlToBuffer(rawSignature))) {
    throw new IdTokenError('id_token 簽章驗證失敗')
  }

  // ── 2. iss ──
  const iss = typeof claims.iss === 'string' ? claims.iss : ''
  if (!PROVIDERS[provider].issuers.includes(iss)) {
    throw new IdTokenError(`id_token issuer 不符：${iss}`)
  }

  // ── 3. aud ──
  const audClaim = claims.aud
  const tokenAudiences = Array.isArray(audClaim)
    ? audClaim.filter((a): a is string => typeof a === 'string')
    : typeof audClaim === 'string'
      ? [audClaim]
      : []
  const audMatched = tokenAudiences.some((a) => audiences.some((allowed) => safeEqualStr(a, allowed)))
  if (!audMatched) {
    throw new IdTokenError('id_token audience 不在允許清單（App 的 client id 沒登記？）')
  }

  // ── 4. exp / iat ──
  const now = Math.floor(Date.now() / 1000)
  const exp = typeof claims.exp === 'number' ? claims.exp : 0
  const iat = typeof claims.iat === 'number' ? claims.iat : 0
  if (!exp || exp + CLOCK_SKEW_SEC < now) throw new IdTokenError('id_token 已過期')
  if (iat && iat - CLOCK_SKEW_SEC > now) throw new IdTokenError('id_token iat 在未來')

  // ── 5. nonce（有給才驗）──
  if (input.nonce) {
    const tokenNonce = typeof claims.nonce === 'string' ? claims.nonce : ''
    if (!tokenNonce) throw new IdTokenError('id_token 缺 nonce')
    // Apple 的 Sign in with Apple 慣例是把 nonce 先做 SHA256 再送出（nonce_supported=false 的舊裝置例外），
    // Google 則是原文；兩種都接受，避免 App 端要為平台分歧寫兩套。
    const hashed = createHash('sha256').update(input.nonce).digest('hex')
    if (!safeEqualStr(tokenNonce, input.nonce) && !safeEqualStr(tokenNonce, hashed)) {
      throw new IdTokenError('nonce 不符')
    }
  }

  const sub = typeof claims.sub === 'string' ? claims.sub : ''
  if (!sub) throw new IdTokenError('id_token 缺 sub')

  const rawEmail = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : ''
  // Google 回 boolean，Apple 回字串 "true"/"false"
  const verifiedClaim = claims.email_verified
  const emailVerified = verifiedClaim === true || verifiedClaim === 'true'
  const name =
    typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null

  return {
    provider,
    sub,
    email: rawEmail || null,
    emailVerified,
    name,
  }
}

// ── LINE ──────────────────────────────────────────────────────
//
// LINE Login 的 id_token 簽章可能是 HS256（channel secret）或 ES256（LINE 金鑰），
// 與 Google/Apple 的 RS256+JWKS 不同套。LINE 官方提供 server-side 驗證端點
// POST https://api.line.me/oauth2/v2.1/verify（帶 id_token + client_id [+ nonce]），
// 由 LINE 代驗簽章 / iss / aud / exp，直接回傳 claims 或錯誤 —— 走官方端點，
// 不在本地重造兩套簽章驗證。
//
// email 語意（與 emailTrust.ts 同）：LINE 只在使用者 email 已通過 LINE 驗證時
// 才回傳 email claim，回傳即等於已驗證。

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

export type LineVerifiedIdentity = {
  provider: 'line'
  /** LINE userId（U 開頭）—— 寫進 Users.socialLogins.lineId */
  sub: string
  email: string | null
  emailVerified: boolean
  name: string | null
  picture: string | null
}

/**
 * 驗證原生 App（LINE SDK）取得的 LINE id_token。驗不過丟 IdTokenError。
 *
 * @param allowedAudiences 允許的 LINE Login channel id 清單（web channel +
 *        App 專用 channel）。逐一嘗試，全部失敗才拒絕。
 */
export async function verifyLineIdToken(input: {
  idToken: string
  allowedAudiences: string[]
  nonce?: string | null
}): Promise<LineVerifiedIdentity> {
  const audiences = input.allowedAudiences.filter(Boolean)
  if (audiences.length === 0) {
    throw new IdTokenError('line 尚未設定 channel id（後台社群登入設定或 .env）')
  }

  let lastError = 'id_token 驗證失敗'
  for (const clientId of audiences) {
    const body = new URLSearchParams({ id_token: input.idToken, client_id: clientId })
    if (input.nonce) body.set('nonce', input.nonce)

    let res: Response
    try {
      res = await fetch(LINE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
      })
    } catch {
      throw new IdTokenError('無法連線 LINE 驗證服務，請稍後再試')
    }

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

    if (res.ok) {
      const sub = typeof json.sub === 'string' ? json.sub : ''
      if (!sub) throw new IdTokenError('LINE id_token 缺 sub')
      const email = typeof json.email === 'string' && json.email ? json.email.trim().toLowerCase() : null
      return {
        provider: 'line',
        sub,
        email,
        // LINE 只回傳已驗證的 email（無 email_verified claim）
        emailVerified: Boolean(email),
        name: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : null,
        picture: typeof json.picture === 'string' && json.picture ? json.picture : null,
      }
    }

    lastError =
      typeof json.error_description === 'string' && json.error_description
        ? `LINE id_token 驗證失敗：${json.error_description}`
        : 'LINE id_token 驗證失敗'
    // audience 不符時試下一組 channel id；其他錯誤（過期/簽章）換 channel 也不會過，
    // 但 LINE 錯誤訊息格式不保證可判別，逐一嘗試成本低（清單至多 2-3 組）。
  }

  throw new IdTokenError(lastError)
}
