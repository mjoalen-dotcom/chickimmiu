import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import Line from 'next-auth/providers/line'
import Apple from 'next-auth/providers/apple'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * NextAuth v5 配置
 * ----------------
 * 社群登入：Google / Facebook / LINE / Apple
 * 登入後自動在 Payload Users collection 建立 / 同步帳號
 *
 * 開發環境若無 OAuth 憑證，providers 陣列為空，不影響網站運作
 */

// 只在有完整憑證時才啟用供應商
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
      if (!user.email || !account) return false

      try {
        const payload = await getPayload({ config })

        const providerIdMap: Record<string, string> = {
          google: 'googleId',
          facebook: 'facebookId',
          line: 'lineId',
          apple: 'appleId',
        }
        const socialField = providerIdMap[account.provider]

        const { docs } = await payload.find({
          collection: 'users',
          where: { email: { equals: user.email } },
          limit: 1,
        })

        if (docs.length === 0) {
          // 建立新會員（使用隨機密碼，社群登入使用者不需要密碼）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (payload as any).create({
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
          })
        } else if (socialField) {
          // 更新社群帳號綁定
          const existing = docs[0] as unknown as Record<string, unknown>
          const currentSocial = (existing.socialLogins || {}) as unknown as Record<string, unknown>
          await (payload.update as Function)({
            collection: 'users',
            id: docs[0].id,
            data: {
              socialLogins: {
                ...currentSocial,
                [socialField]: account.providerAccountId,
              },
            } as unknown as Record<string, unknown>,
          })
        }

        return true
      } catch (error) {
        console.error('[NextAuth] signIn callback error:', error)
        return true // 即使 Payload 同步失敗也允許登入
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
