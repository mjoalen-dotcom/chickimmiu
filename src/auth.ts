import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Line from 'next-auth/providers/line'
import Apple from 'next-auth/providers/apple'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { createFacebookProvider } from '@/lib/auth/facebookProvider'
import { completeFacebookLink } from '@/lib/auth/facebookLink'
import { FACEBOOK_LINK_COOKIE, readCookie } from '@/lib/auth/facebookLinkIntent'
import { resolveSocialAuth } from '@/lib/auth/socialCredentials'
import { linkOrCreateSocialUser } from '@/lib/auth/socialIdentity'
import { onboardNewCustomer } from '@/lib/auth/newCustomerOnboarding'
import { isProviderEmailVerified, trustedEmailFrom } from '@/lib/auth/emailTrust'

/**
 * NextAuth v5 — Google / Facebook / LINE / Apple
 *
 * OAuth 成功後解析 Payload Customers（social ID 優先；僅可信 email 可匹配）。
 *
 * Payload session cookie (`payload-token`) 不在這裡寫 — Auth.js v5 在 callback
 * 內回自己組的 redirect Response，`cookies().set()` 不會被序列化進 headers。
 * 改由 `/api/auth/bridge` route handler 處理：`/account/**` layout 偵測到
 * NextAuth session 但無 Payload session 時，redirect 過去補 cookie 再導回。
 *
 * Lazy initialization：憑證每次請求經 resolveSocialAuth() 解析（後台
 * GlobalSettings 優先、.env fallback、15 秒快取）——後台貼上憑證即生效，
 * 免重啟。開關關閉或憑證不齊的 provider 不註冊，按鈕端（socialProviders）
 * 同一份判斷，永遠一致。沒有任何憑證時 providers 為空，不影響網站運作。
 */

const createSharedConfig = (facebookAppId?: string) => ({
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account) return false
      try {
        if (account.provider === 'facebook') {
          if (!facebookAppId) return false
          const requestHeaders = await headers()
          if (readCookie(requestHeaders, FACEBOOK_LINK_COOKIE)) {
            try {
              const payload = await getPayload({ config })
              await completeFacebookLink(payload, requestHeaders, facebookAppId, account.providerAccountId)
              // The customer already has a valid Payload session. Do not replace
              // it with another account/session when linking a login method.
              return '/api/auth/facebook/link-complete?result=linked'
            } catch {
              return '/api/auth/facebook/link-complete?result=failed'
            }
          }
        }
        // 未驗證的 provider email 不可拿來匹配既有會員 —— 否則在該 provider 註冊
        // 一個掛受害者 email 的帳號就能接管 CKMU 會員（判定規則見 emailTrust.ts，
        // 與 App 端 /api/v1/auth/social 的 trustedEmail 同一套語意）。
        const trustedEmail = trustedEmailFrom(
          account.provider,
          profile as Record<string, unknown> | null | undefined,
          user.email,
        )
        // 匹配/建檔邏輯與 APP 端 /api/v1/auth/social 共用同一份（socialIdentity.ts），
        // 同一個人不論從網頁或 App 登入都會對到同一個會員。
        const linked = await linkOrCreateSocialUser({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          providerAppId: account.provider === 'facebook' ? facebookAppId : undefined,
          email: trustedEmail,
          name: user.name,
        })
        // null = 不認得的 provider 又沒 email，無從建檔
        if (!linked) return false

        // 網頁社群「首次註冊」也要發新會員註冊禮 —— 與 Email 註冊、App 社群註冊
        // 同一份實作（lib/auth/newCustomerOnboarding.ts）。網頁 OAuth 轉址流程帶不到
        // 推薦碼，故只發註冊禮；推薦綁定由 Email 註冊與 App 社群註冊涵蓋。
        // best-effort：helper 內全程 try/catch，失敗不擋登入。
        if (linked.created) {
          const payload = await getPayload({ config })
          await onboardNewCustomer(payload, { userId: linked.user.id })
        }
        return true
      } catch (error) {
        console.error('[NextAuth] customer sign-in failed', { provider: account.provider, errorType: error instanceof Error ? error.name : 'unknown' })
        return false // Never issue a usable social session when member resolution failed.
      }
    },
    async jwt({ token, account, profile }) {
      // account 只在 OAuth 首次簽入那一輪有值 → 把 provider 資訊持久化進 JWT。
      // /api/auth/bridge 靠它在無 email 帳號時用 socialLogins.{field} 找回 Payload user。
      if (account) {
        token.provider = account.provider
        token.providerAccountId = account.providerAccountId
        token.providerAppId = account.provider === 'facebook' ? facebookAppId : undefined
        // email 是否經 provider 驗證，一併帶進 JWT —— bridge 用 email 找 Payload user
        // 時必須套同一道門檻，否則未驗證 email 仍能在 bridge 這關接管既有會員。
        token.providerEmailVerified = isProviderEmailVerified(
          account.provider,
          profile as Record<string, unknown> | null | undefined,
        )
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
      if (typeof token?.providerAppId === 'string') u.providerAppId = token.providerAppId
      u.providerEmailVerified = token?.providerEmailVerified === true
      return session
    },
  },
} satisfies Omit<NextAuthConfig, 'providers'>)

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const { creds, enabled } = await resolveSocialAuth()
  const providers: NextAuthConfig['providers'] = []

  if (enabled.google && creds.google) {
    providers.push(
      Google({
        clientId: creds.google.clientId,
        clientSecret: creds.google.clientSecret,
      }),
    )
  }

  if (enabled.facebook && creds.facebook) {
    providers.push(createFacebookProvider(creds.facebook))
  }

  if (enabled.line && creds.line) {
    providers.push(
      Line({
        clientId: creds.line.clientId,
        clientSecret: creds.line.clientSecret,
        // LINE Login v2.1 要求 `state`（見 LINE docs「Required」欄位）。Auth.js
        // 內建 Line provider 預設 `checks` 只放 `pkce`，少了 state 會被 LINE
        // 在 callback 擋成 `error=INVALID_REQUEST&error_description='state' is
        // not specified`。顯式補上 state + nonce（後者是 OIDC replay protection）。
        checks: ['pkce', 'state', 'nonce'],
      }),
    )
  }

  if (enabled.apple && creds.apple) {
    providers.push(
      Apple({
        clientId: creds.apple.clientId,
        clientSecret: creds.apple.clientSecret,
      }),
    )
  }

  return { ...createSharedConfig(creds.facebook?.clientId), providers }
})
