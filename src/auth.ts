import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import Line from 'next-auth/providers/line'
import Apple from 'next-auth/providers/apple'
import { resolveSocialAuth } from '@/lib/auth/socialCredentials'
import { linkOrCreateSocialUser } from '@/lib/auth/socialIdentity'

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
 * Lazy initialization：憑證每次請求經 resolveSocialAuth() 解析（後台
 * GlobalSettings 優先、.env fallback、15 秒快取）——後台貼上憑證即生效，
 * 免重啟。開關關閉或憑證不齊的 provider 不註冊，按鈕端（socialProviders）
 * 同一份判斷，永遠一致。沒有任何憑證時 providers 為空，不影響網站運作。
 */

const sharedConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false
      try {
        // 匹配/建檔邏輯與 APP 端 /api/v1/auth/social 共用同一份（socialIdentity.ts），
        // 同一個人不論從網頁或 App 登入都會對到同一個會員。
        const linked = await linkOrCreateSocialUser({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user.email,
          name: user.name,
        })
        // null = 不認得的 provider 又沒 email，無從建檔
        return linked !== null
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
} satisfies Omit<NextAuthConfig, 'providers'>

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
    providers.push(
      Facebook({
        clientId: creds.facebook.clientId,
        clientSecret: creds.facebook.clientSecret,
      }),
    )
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

  return { ...sharedConfig, providers }
})
