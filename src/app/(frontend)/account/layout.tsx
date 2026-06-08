import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth as nextAuth } from '@/auth'
import { User, ShoppingBag, Heart, MapPin, Gift, Settings, Crown, Share2, RotateCcw, Star, FileText, Gamepad2, Sparkles, Brain, Wallet } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { LogoutButton } from './LogoutButton'

export const metadata: Metadata = {
  title: '我的帳號',
  description: '管理您的 CHIC KIM & MIU 會員帳號、訂單查詢、收藏清單、點數兌換與帳號設定。',
  robots: { index: false, follow: false },
}

const SIDEBAR_LINK_DEFS = [
  { href: '/account', key: 'overview', icon: User },
  { href: '/account/orders', key: 'orders', icon: ShoppingBag },
  { href: '/account/subscription', key: 'subscription', icon: Crown },
  { href: '/account/wishlist', key: 'wishlist', icon: Heart },
  { href: '/account/referrals', key: 'referrals', icon: Share2 },
  { href: '/games', key: 'games', icon: Gamepad2 },
  { href: '/account/personality', key: 'personality', icon: Brain },
  { href: '/account/treasure', key: 'treasure', icon: Sparkles },
  { href: '/account/invoices', key: 'invoices', icon: FileText },
  { href: '/account/returns', key: 'returns', icon: RotateCcw },
  { href: '/account/reviews', key: 'reviews', icon: Star },
  { href: '/account/addresses', key: 'addresses', icon: MapPin },
  { href: '/account/points', key: 'points', icon: Gift },
  { href: '/account/wallet', key: 'wallet', icon: Wallet },
  { href: '/account/settings', key: 'settings', icon: Settings },
] as const

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [t, payload] = await Promise.all([
    getTranslations('account'),
    getPayload({ config }),
  ])
  const headersList = await nextHeaders()
  // `nextAuth()` 在 session cookie 損毀時可能拋 JWTSessionError 而不是回 null（看內部
  // 解碼路徑），整層 layout 跟著炸 → 使用者收到 500 或被框架導去最近的 error.tsx，
  // 看起來就像「莫名跳回登入」。包 try/catch 後 fallback 成沒 session：bridge 那邊也
  // 會碰到一樣狀況，會在那裡清掉壞 cookie。
  const [{ user }, session] = await Promise.all([
    payload.auth({ headers: headersList }),
    nextAuth().catch((err) => {
      console.error('[account/layout] nextAuth() threw, treating as no session', err)
      return null
    }),
  ])
  if (!user) {
    // OAuth (NextAuth) just completed but the Payload session cookie isn't set
    // (Auth.js v5 callback can't reliably write Set-Cookie on its redirect
    // response). Bounce through /api/auth/bridge so the cookie gets set from
    // a route handler we own, then come back here.
    if (session?.user?.email) {
      redirect('/api/auth/bridge?next=/account')
    }
    redirect('/login?redirect=/account')
  }
  // 使用者在已登入狀態下按 OAuth 按鈕切帳號：NextAuth session 建好新身分了，
  // 但舊的 payload-token cookie 還在 → 讓 bridge 覆蓋 cookie，否則畫面會
  // 停在舊帳號（"原地打轉"）。
  const payloadEmail = (user as unknown as { email?: string }).email?.toLowerCase()
  const sessionEmail = session?.user?.email?.toLowerCase()
  if (sessionEmail && payloadEmail && sessionEmail !== payloadEmail) {
    redirect('/api/auth/bridge?next=/account')
  }

  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="container py-8 md:py-12">
        <h1 className="text-2xl font-serif mb-8">{t('pageTitle')}</h1>
        <div className="grid md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-1">
            {SIDEBAR_LINK_DEFS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-foreground/70 hover:text-gold-600 hover:bg-cream-100 transition-colors"
              >
                <link.icon size={18} />
                {t(`nav.${link.key}`)}
              </Link>
            ))}
            <LogoutButton />
          </aside>

          {/* Content */}
          <main>{children}</main>
        </div>
      </div>
    </div>
  )
}
