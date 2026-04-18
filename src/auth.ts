import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import Line from 'next-auth/providers/line'
import Apple from 'next-auth/providers/apple'
import { cookies } from 'next/headers'
import { getPayload, getFieldsToSign, jwtSign } from 'payload'
import config from '@payload-config'

/**
 * NextAuth v5 — Google / Facebook / LINE / Apple
 *
 * OAuth 成功後做兩件事：
 *   1. upsert Payload Users collection（email 匹配 → 綁定社群 ID；否則建立）
 *   2. 寫 Payload session cookie（`payload-token`），讓 `/account/**` 伺服端用
 *      `payload.auth({ headers })` 檢查時也認得 OAuth 使用者，不再只吃
 *      email/pw 登入流程下的 session（舊 bug 說明見 login/page.tsx）
 *
 * 開發環境若無 OAuth 憑證，providers 陣列為空，不影響網站運作。
 */

const providers = []

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  )
}

if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
    })
  )
}

if (process.env.AUTH_LINE_CHANNEL_ID && process.env.AUTH_LINE_CHANNEL_SECRET) {
  providers.push(
    Line({
      clientId: process.env.AUTH_LINE_CHANNEL_ID,
      clientSecret: process.env.AUTH_LINE_CHANNEL_SECRET,
      // LINE Login v2.1 要求 `state`（見 LINE docs「Required」欄位）。Auth.js
      // 內建 Line provider 預設 `checks` 只放 `pkce`，少了 state 會被 LINE
      // 在 callback 擋成 `error=INVALID_REQUEST&error_description='state' is
      // not specified`。顯式補上 state + nonce（後者是 OIDC replay protection）。
      checks: ['pkce', 'state', 'nonce'],
    })
  )
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    })
  )
}

const PROVIDER_SOCIAL_FIELD: Record<string, string> = {
  google: 'googleId',
  facebook: 'facebookId',
  line: 'lineId',
  apple: 'appleId',
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false

      try {
        const payload = await getPayload({ config })
        const socialField = PROVIDER_SOCIAL_FIELD[account.provider]

        const { docs } = await payload.find({
          collection: 'users',
          where: { email: { equals: user.email } },
          limit: 1,
        })

        let payloadUser: { id: string | number; email?: string } & Record<string, unknown>

        if (docs.length === 0) {
          // 新社群使用者 → 建立 Users 紀錄（隨機密碼只是為了過 Payload auth 必填檢查，
          // 社群使用者不會走 email/pw 流程；之後若想把帳號降級成一般帳號得走 reset-password）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payloadUser = (await (payload as any).create({
            collection: 'users',
            data: {
              email: user.email,
              password: `social_${crypto.randomUUID()}_${Date.now()}`,
              name: user.name || user.email.split('@')[0],
              role: 'customer',
              ...(socialField
                ? { socialLogins: { [socialField]: account.providerAccountId } }
                : {}),
            },
          })) as typeof payloadUser
        } else if (socialField) {
          const existing = docs[0] as unknown as Record<string, unknown>
          const currentSocial = (existing.socialLogins || {}) as Record<string, unknown>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payloadUser = (await (payload.update as any)({
            collection: 'users',
            id: docs[0].id,
            data: {
              socialLogins: {
                ...currentSocial,
                [socialField]: account.providerAccountId,
              },
            },
          })) as typeof payloadUser
        } else {
          payloadUser = docs[0] as unknown as typeof payloadUser
        }

        await setPayloadSessionCookie(payload, payloadUser)
        return true
      } catch (error) {
        console.error('[NextAuth] signIn callback error:', error)
        return true // OAuth 已成功，Payload 同步失敗不擋 NextAuth session
      }
    },
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})

/**
 * 手動簽 Payload JWT + set-cookie，等價於 Payload 內建 `/api/users/login`
 * 端點做的事。這樣 OAuth callback 結束、瀏覽器被導回 `/account/**` 時，
 * `payload.auth({ headers })` 會從 `payload-token` cookie 取出這裡簽的 JWT，
 * 解出 user id，和正常 email/pw 登入一樣通過檢查。
 */
async function setPayloadSessionCookie(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  user: { id: string | number; email?: string } & Record<string, unknown>
) {
  const usersConfig = payload.collections?.users?.config
  const authConfig = usersConfig?.auth
  if (!usersConfig || !authConfig) {
    console.warn('[NextAuth] users collection auth config missing; skipping payload-token cookie')
    return
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: usersConfig,
    email: user.email || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: user as any,
  })

  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret as string,
    tokenExpiration: authConfig.tokenExpiration,
  })

  const cookiePrefix = (payload.config?.cookiePrefix as string | undefined) || 'payload'
  const rawSameSite = authConfig.cookies?.sameSite
  const sameSite: 'strict' | 'lax' | 'none' =
    typeof rawSameSite === 'string'
      ? (rawSameSite.toLowerCase() as 'strict' | 'lax' | 'none')
      : rawSameSite
        ? 'strict'
        : 'lax'
  const secure = Boolean(authConfig.cookies?.secure) || sameSite === 'none'

  const store = await cookies()
  store.set({
    name: `${cookiePrefix}-token`,
    value: token,
    httpOnly: true,
    path: '/',
    secure,
    sameSite,
    domain: authConfig.cookies?.domain || undefined,
    maxAge: authConfig.tokenExpiration,
  })
}
