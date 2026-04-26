import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import Line from 'next-auth/providers/line'
import Apple from 'next-auth/providers/apple'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * NextAuth v5 — Google / Facebook / LINE / Apple
 *
 * OAuth 成功後 upsert Payload Users collection（email 匹配 → 綁定社群 ID；否則建立）。
 *
 * Payload session cookie (`payload-token`) 不在這裡寫 — Auth.js v5 在 callback
 * 內回自己組的 redirect Response，`cookies().set()` 不會被序列化進 headers。
 * 改由 `/api/auth/bridge` route handler 處理：`/account/**` layout 偵測到
 * NextAuth session 但無 Payload session 時，redirect 過去補 cookie 再導回。
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
        // OAuth provider 回 mixed-case email 也要對得上 Payload 已 lowercase 的紀錄
        const email = user.email.toLowerCase()

        const { docs } = await payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
        })

        let payloadUser: { id: string | number; email?: string } & Record<string, unknown>

        if (docs.length === 0) {
          // 新社群使用者 → 建立 Users 紀錄（隨機密碼只是為了過 Payload auth 必填檢查，
          // 社群使用者不會走 email/pw 流程；之後若想把帳號降級成一般帳號得走 reset-password）
          //
          // _verified:true + disableVerificationEmail:true：OAuth provider 已替我們做完
          // email 驗證，Payload 不必再寄信。沒帶這兩個欄位會讓新帳號 _verified=false →
          // /api/auth/bridge 雖能簽 JWT，但 payload.auth() 在 verify 開啟時會拒絕未驗證 user，
          // 造成 /account → bridge → /account 無限循環。
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payloadUser = (await (payload as any).create({
            collection: 'users',
            data: {
              email,
              password: `social_${crypto.randomUUID()}_${Date.now()}`,
              name: user.name || email.split('@')[0],
              role: 'customer',
              _verified: true,
              ...(socialField
                ? { socialLogins: { [socialField]: account.providerAccountId } }
                : {}),
            },
            disableVerificationEmail: true,
          })) as typeof payloadUser
        } else {
          const existing = docs[0] as unknown as Record<string, unknown>
          const currentSocial = (existing.socialLogins || {}) as Record<string, unknown>
          const alreadyVerified = (existing as { _verified?: boolean })._verified === true
          const updateData: Record<string, unknown> = {}
          if (socialField) {
            updateData.socialLogins = {
              ...currentSocial,
              [socialField]: account.providerAccountId,
            }
          }
          // 救援先前 OAuth 建立的未驗證帳號（無此 backfill 會永遠卡 bridge loop）
          if (!alreadyVerified) updateData._verified = true

          if (Object.keys(updateData).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payloadUser = (await (payload.update as any)({
              collection: 'users',
              id: docs[0].id,
              data: updateData,
            })) as typeof payloadUser
          } else {
            payloadUser = docs[0] as unknown as typeof payloadUser
          }
        }

        return true
      } catch (error) {
        console.error('[NextAuth] signIn callback error:', error)
        return true // OAuth 已成功，Payload upsert 失敗不擋 NextAuth session
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
