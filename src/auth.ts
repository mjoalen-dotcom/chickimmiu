import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import Line from 'next-auth/providers/line'
import Apple from 'next-auth/providers/apple'
import { getPayload } from 'payload'
import config from '@payload-config'
import { PROVIDER_SOCIAL_FIELD, isPlaceholderEmail, placeholderEmailFor } from '@/lib/auth/social'

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false
      const socialField = PROVIDER_SOCIAL_FIELD[account.provider]
      // OAuth provider 回 mixed-case email 也要對得上 Payload 已 lowercase 的紀錄。
      // 台灣 LINE 用戶很多沒在 LINE 設 email → user.email 為空，walk lineId-first 路徑。
      const email = user.email?.toLowerCase() || null
      if (!email && !socialField) return false // 不認得的 provider 又沒 email，無從建檔

      try {
        const payload = await getPayload({ config })

        // 1) socialId-first：同一個社群帳號回訪。比 email 匹配優先 —
        //    使用者在 LINE 端換過 email（或根本沒 email）也能對回同一個會員。
        type PayloadUserDoc = { id: string | number; email?: string } & Record<string, unknown>
        let existing: PayloadUserDoc | null = null
        if (socialField) {
          const bySocial = await payload.find({
            collection: 'users',
            where: { [`socialLogins.${socialField}`]: { equals: account.providerAccountId } },
            limit: 1,
          })
          if (bySocial.docs.length > 0) {
            existing = bySocial.docs[0] as unknown as PayloadUserDoc
          }
        }

        // 2) email 匹配：第一次用這個社群方式登入，但 email 已有會員 → 綁定社群 ID
        if (!existing && email) {
          const byEmail = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
          })
          if (byEmail.docs.length > 0) {
            existing = byEmail.docs[0] as unknown as PayloadUserDoc
          }
        }

        if (!existing) {
          // 3) 全新社群使用者 → 建立 Users 紀錄。
          //    無 email（LINE 常見）→ 合成 placeholder email（noemail.invalid）過 Payload
          //    auth 必填檢查，之後可在 /account/settings 補綁真 email。
          //    隨機密碼只是為了過必填檢查，社群使用者不會走 email/pw 流程。
          //
          // _verified:true + disableVerificationEmail:true：OAuth provider 已替我們做完
          // email 驗證（placeholder 則本來就不可投遞），Payload 不必再寄信。沒帶這兩個
          // 欄位會讓新帳號 _verified=false → /api/auth/bridge 雖能簽 JWT，但 payload.auth()
          // 在 verify 開啟時會拒絕未驗證 user，造成 /account → bridge → /account 無限循環。
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (payload as any).create({
            collection: 'users',
            data: {
              email: email || placeholderEmailFor(account.provider, account.providerAccountId),
              password: `social_${crypto.randomUUID()}_${Date.now()}`,
              name: user.name || (email ? email.split('@')[0] : `LINE 會員`),
              role: 'customer',
              _verified: true,
              ...(socialField
                ? { socialLogins: { [socialField]: account.providerAccountId } }
                : {}),
            },
            disableVerificationEmail: true,
          })
        } else {
          const currentSocial = (existing.socialLogins || {}) as Record<string, unknown>
          const alreadyVerified = (existing as { _verified?: boolean })._verified === true
          const updateData: Record<string, unknown> = {}
          if (socialField && currentSocial[socialField] !== account.providerAccountId) {
            updateData.socialLogins = {
              ...currentSocial,
              [socialField]: account.providerAccountId,
            }
          }
          // 救援先前 OAuth 建立的未驗證帳號（無此 backfill 會永遠卡 bridge loop）
          if (!alreadyVerified) updateData._verified = true
          // 舊帳號掛著 placeholder email、這次 OAuth 給了真 email → 升級（先查重，
          // 該 email 已屬於別的會員時保留 placeholder，留給客服做人工合併）
          if (email && isPlaceholderEmail(existing.email)) {
            const emailTaken = await payload.find({
              collection: 'users',
              where: { email: { equals: email } },
              limit: 1,
            })
            if (emailTaken.docs.length === 0) {
              updateData.email = email
            } else {
              console.warn(
                `[NextAuth] user ${existing.id} 的 OAuth email ${email} 已屬於 user ${emailTaken.docs[0].id}，保留 placeholder`,
              )
            }
          }

          if (Object.keys(updateData).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (payload.update as any)({
              collection: 'users',
              id: existing.id,
              data: updateData,
            })
          }
        }

        return true
      } catch (error) {
        console.error('[NextAuth] signIn callback error:', error)
        return true // OAuth 已成功，Payload upsert 失敗不擋 NextAuth session
      }
    },
    async jwt({ token, account }) {
      // account 只在 OAuth 首次簽入那一輪有值 → 把 provider 資訊持久化進 JWT。
      // /api/auth/bridge 靠它在無 email 帳號時用 socialLogins.{field} 找回 Payload user。
      if (account) {
        token.provider = account.provider
        token.providerAccountId = account.providerAccountId
      }
      return token
    },
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub
      }
      const u = session.user as unknown as Record<string, unknown>
      if (typeof token?.provider === 'string') u.provider = token.provider
      if (typeof token?.providerAccountId === 'string') u.providerAccountId = token.providerAccountId
      return session
    },
  },
})
