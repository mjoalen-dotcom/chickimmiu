import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth as nextAuth } from '@/auth'
import { PROVIDER_SOCIAL_FIELD } from '@/lib/auth/social'
import { getTranslations } from 'next-intl/server'
import { LogoutButton } from './LogoutButton'
import { AccountSidebar, type SidebarGroup } from './AccountSidebar'

export const metadata: Metadata = {
  title: '我的帳號',
  description: '管理您的 CHIC KIM & MIU 會員帳號、訂單查詢、收藏清單、點數兌換與帳號設定。',
  robots: { index: false, follow: false },
}

// 需求 ②（2026-08-22）：15 條平鋪連結收斂成 4+1 組 — 依顧客心智模型分
// （訂單物流 / 點數獎勵 / 個人風格 / 帳號），icon 用名稱字串傳 client。
const SIDEBAR_GROUP_DEFS = [
  { titleKey: null, items: [{ href: '/account', key: 'overview', icon: 'User' }] },
  {
    titleKey: 'shopping',
    items: [
      { href: '/account/orders', key: 'orders', icon: 'ShoppingBag' },
      { href: '/account/returns', key: 'returns', icon: 'RotateCcw' },
      { href: '/account/invoices', key: 'invoices', icon: 'FileText' },
      { href: '/account/addresses', key: 'addresses', icon: 'MapPin' },
    ],
  },
  {
    titleKey: 'rewards',
    items: [
      { href: '/account/points', key: 'points', icon: 'Gift' },
      { href: '/account/wallet', key: 'wallet', icon: 'Wallet' },
      { href: '/account/treasure', key: 'treasure', icon: 'Sparkles' },
      { href: '/account/referrals', key: 'referrals', icon: 'Share2' },
      { href: '/games', key: 'games', icon: 'Gamepad2' },
    ],
  },
  {
    titleKey: 'style',
    items: [
      { href: '/account/wishlist', key: 'wishlist', icon: 'Heart' },
      { href: '/account/personality', key: 'personality', icon: 'Brain' },
      { href: '/account/reviews', key: 'reviews', icon: 'Star' },
    ],
  },
  {
    titleKey: 'account',
    items: [
      { href: '/account/subscription', key: 'subscription', icon: 'Crown' },
      { href: '/account/settings', key: 'settings', icon: 'Settings' },
    ],
  },
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
  // 無 email 的社群帳號（LINE 常見）session.user 沒 email，但 auth.ts session
  // callback 會帶 provider + providerAccountId — 一樣視為有效 NextAuth session。
  const sessionUser = session?.user as
    | { email?: string | null; provider?: string; providerAccountId?: string }
    | undefined
  const hasNextAuthIdentity = Boolean(sessionUser?.email || sessionUser?.providerAccountId)
  if (!user) {
    // OAuth (NextAuth) just completed but the Payload session cookie isn't set
    // (Auth.js v5 callback can't reliably write Set-Cookie on its redirect
    // response). Bounce through /api/auth/bridge so the cookie gets set from
    // a route handler we own, then come back here.
    if (hasNextAuthIdentity) {
      redirect('/api/auth/bridge?next=/account')
    }
    redirect('/login?redirect=/account')
  }
  // 使用者在已登入狀態下按 OAuth 按鈕切帳號：NextAuth session 建好新身分了，
  // 但舊的 payload-token cookie 還在 → 讓 bridge 覆蓋 cookie，否則畫面會
  // 停在舊帳號（"原地打轉"）。無 email session 改比 socialLogins 對應欄位。
  const payloadEmail = (user as unknown as { email?: string }).email?.toLowerCase()
  const sessionEmail = sessionUser?.email?.toLowerCase()
  if (sessionEmail && payloadEmail && sessionEmail !== payloadEmail) {
    redirect('/api/auth/bridge?next=/account')
  }
  if (!sessionEmail && sessionUser?.provider && sessionUser?.providerAccountId) {
    const field = PROVIDER_SOCIAL_FIELD[sessionUser.provider]
    const socials = (user as unknown as { socialLogins?: Record<string, unknown> }).socialLogins
    if (field && socials && socials[field] && socials[field] !== sessionUser.providerAccountId) {
      redirect('/api/auth/bridge?next=/account')
    }
  }

  const sidebarGroups: SidebarGroup[] = SIDEBAR_GROUP_DEFS.map((group) => ({
    title: group.titleKey ? t(`navGroups.${group.titleKey}`) : null,
    items: group.items.map((item) => ({
      href: item.href,
      label: t(`nav.${item.key}`),
      icon: item.icon,
    })),
  }))

  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="container py-8 md:py-12">
        <h1 className="text-2xl font-serif mb-6 md:mb-8">{t('pageTitle')}</h1>
        <div className="grid md:grid-cols-[240px_1fr] gap-4 md:gap-8">
          {/* Sidebar：桌機分組直欄 / 手機橫向 chips */}
          <aside>
            <AccountSidebar groups={sidebarGroups} />
            <div className="hidden md:block mt-5 pt-4 border-t border-cream-200">
              <LogoutButton />
            </div>
          </aside>

          {/* Content */}
          <main>{children}</main>
        </div>
      </div>
    </div>
  )
}
