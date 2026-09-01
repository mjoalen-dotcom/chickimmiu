import { getPayload } from 'payload'
import config from '@payload-config'
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { facebookCredentials } from './facebook'

/**
 * 社群登入憑證解析（server-only）
 * ------------------------------
 * Shopline 式後台設定：憑證優先讀 GlobalSettings.socialLogin（後台貼上即生效），
 * 欄位留空才 fallback 到 .env —— 現行以 env 設定的 LINE 不受影響。
 *
 * auth.ts（NextAuth lazy init）與 socialProviders.ts（按鈕顯示）都走這裡，
 * 「provider 有沒有註冊」和「按鈕出不出現」永遠同一份判斷。
 *
 * Apple 特例：client secret 不是固定字串，是拿 .p8 私鑰簽的 ES256 JWT（Apple
 * 上限 180 天）。後台貼 Services ID / Team ID / Key ID / .p8 四欄，這裡 runtime
 * 自動簽 + 到期前自動換新，完全免手動維護（.env 的 AUTH_APPLE_SECRET 仍可作 fallback）。
 */

export type ProviderCreds = { clientId: string; clientSecret: string }

export type SocialProviderFlags = {
  google: boolean
  facebook: boolean
  line: boolean
  apple: boolean
}

export type ResolvedSocialAuth = {
  creds: {
    google: ProviderCreds | null
    facebook: ProviderCreds | null
    line: ProviderCreds | null
    apple: ProviderCreds | null
  }
  /** creds 齊全 AND 後台開關 —— provider 註冊與按鈕顯示共用 */
  enabled: SocialProviderFlags
  /**
   * 原生 App id_token 的合法 audience 清單（POST /api/v1/auth/social 用）。
   * 網頁的 client id 也含在內，方便 App 內嵌 WebView 情境。
   */
  nativeAudiences: {
    google: string[]
    apple: string[]
    line: string[]
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// ── Apple client secret（ES256 JWT）runtime 簽發 + 快取 ──
// 效期 170 天、剩 7 天內或後台換了金鑰（fingerprint 變）就重簽。
const APPLE_JWT_TTL_DAYS = 170
let appleJwtCache: { fingerprint: string; jwt: string; exp: number } | null = null

function signAppleClientSecret(input: {
  servicesId: string
  teamId: string
  keyId: string
  privateKey: string
}): string {
  const fingerprint = createHash('sha256')
    .update(`${input.servicesId}|${input.teamId}|${input.keyId}|${input.privateKey}`)
    .digest('hex')
  const now = Math.floor(Date.now() / 1000)
  if (
    appleJwtCache &&
    appleJwtCache.fingerprint === fingerprint &&
    appleJwtCache.exp - now > 7 * 86400
  ) {
    return appleJwtCache.jwt
  }

  const b64url = (b: Buffer | string) =>
    Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const exp = now + APPLE_JWT_TTL_DAYS * 86400
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: input.keyId }))
  const payload = b64url(
    JSON.stringify({
      iss: input.teamId,
      iat: now,
      exp,
      aud: 'https://appleid.apple.com',
      sub: input.servicesId,
    }),
  )
  // JWT 的 ES256 簽章要 raw r‖s 64 bytes，不是 DER —— dsaEncoding 必須 ieee-p1363
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(input.privateKey),
    dsaEncoding: 'ieee-p1363',
  })
  const jwt = `${header}.${payload}.${b64url(signature)}`
  appleJwtCache = { fingerprint, jwt, exp }
  return jwt
}

// ── 解析結果快取（後台貼完憑證最慢 15 秒生效，免重啟） ──
const CACHE_TTL_MS = 15_000
let resolvedCache: { at: number; value: ResolvedSocialAuth } | null = null

export async function resolveSocialAuth(): Promise<ResolvedSocialAuth> {
  if (resolvedCache && Date.now() - resolvedCache.at < CACHE_TTL_MS) {
    return resolvedCache.value
  }

  type SocialLoginSettings = {
    enableGoogle?: boolean
    enableFacebook?: boolean
    enableLine?: boolean
    enableApple?: boolean
    googleClientId?: string
    googleClientSecret?: string
    facebookAppId?: string
    facebookAppSecret?: string
    lineChannelId?: string
    lineChannelSecret?: string
    appleServicesId?: string
    appleTeamId?: string
    appleKeyId?: string
    applePrivateKey?: string
    googleIosClientId?: string
    googleAndroidClientId?: string
    appleAppBundleId?: string
  }

  let sl: SocialLoginSettings = {}
  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({ slug: 'global-settings', depth: 0 })) as unknown as {
      socialLogin?: SocialLoginSettings
    }
    sl = settings?.socialLogin || {}
  } catch (error) {
    console.error('[socialCredentials] 讀取 global-settings 失敗，fallback 純 .env：', error)
  }

  const pair = (dbId: unknown, dbSecret: unknown, envId?: string, envSecret?: string): ProviderCreds | null => {
    const id = str(dbId) || str(envId)
    const secret = str(dbSecret) || str(envSecret)
    return id && secret ? { clientId: id, clientSecret: secret } : null
  }

  const google = pair(sl.googleClientId, sl.googleClientSecret, process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET)
  const facebook = facebookCredentials(sl.facebookAppId, sl.facebookAppSecret, process.env.AUTH_FACEBOOK_ID, process.env.AUTH_FACEBOOK_SECRET)
  const line = pair(sl.lineChannelId, sl.lineChannelSecret, process.env.AUTH_LINE_CHANNEL_ID, process.env.AUTH_LINE_CHANNEL_SECRET)

  // Apple：後台四欄齊 → runtime 簽 JWT；不齊 → .env fallback
  let apple: ProviderCreds | null = null
  const appleDb = {
    servicesId: str(sl.appleServicesId),
    teamId: str(sl.appleTeamId),
    keyId: str(sl.appleKeyId),
    privateKey: str(sl.applePrivateKey),
  }
  if (appleDb.servicesId && appleDb.teamId && appleDb.keyId && appleDb.privateKey) {
    try {
      apple = { clientId: appleDb.servicesId, clientSecret: signAppleClientSecret(appleDb) }
    } catch (error) {
      console.error('[socialCredentials] Apple .p8 簽章失敗（金鑰內容有誤？），Apple 登入停用：', error)
    }
  } else {
    apple = pair(undefined, undefined, process.env.AUTH_APPLE_ID, process.env.AUTH_APPLE_SECRET)
  }

  // 原生 App 的 id_token aud 跟網頁那組不同 —— 全部收進允許清單（去重、去空）。
  //
  // 多 App 共用同一批會員（CKMU App + KimLafayette App，2026-08-27 App 團隊提出）：
  // 每個 App 有各自的 Bundle ID / Package name / OAuth client ID，但後台是單值文字
  // 欄位。改成「一格可填多組」——用逗號、分號或換行分隔即可，不必為此加 migration，
  // 既有單值設定原樣繼續有效。Google 官方對「多個 client 共用同一後端」的建議也是
  // 由後端自行比對 aud，正是這份允許清單在做的事。
  const splitMulti = (v: string | undefined): string[] =>
    str(v)
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)

  const dedupe = (list: Array<string | undefined>): string[] => [
    ...new Set(list.flatMap((v) => splitMulti(v))),
  ]

  const value: ResolvedSocialAuth = {
    creds: { google, facebook, line, apple },
    nativeAudiences: {
      google: dedupe([
        google?.clientId,
        sl.googleIosClientId,
        sl.googleAndroidClientId,
        process.env.AUTH_GOOGLE_IOS_ID,
        process.env.AUTH_GOOGLE_ANDROID_ID,
      ]),
      apple: dedupe([
        apple?.clientId,
        sl.appleAppBundleId,
        process.env.AUTH_APPLE_APP_BUNDLE_ID,
      ]),
      // LINE 的 id_token aud = channel id。App 若用獨立的 LINE Login channel，
      // 以 AUTH_LINE_NATIVE_CHANNEL_ID 補登記（後台 global 欄位需 migration，先走 .env）。
      line: dedupe([line?.clientId, process.env.AUTH_LINE_NATIVE_CHANNEL_ID]),
    },
    enabled: {
      google: Boolean(google) && (sl.enableGoogle ?? true),
      facebook: Boolean(facebook) && (sl.enableFacebook ?? true),
      line: Boolean(line) && (sl.enableLine ?? true),
      apple: Boolean(apple) && (sl.enableApple ?? false),
    },
  }
  resolvedCache = { at: Date.now(), value }
  return value
}
