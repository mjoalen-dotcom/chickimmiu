import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { User, ShoppingBag, Heart, MapPin, Gift, Settings, LogOut, Crown, Share2, RotateCcw, Star, FileText, Gamepad2 } from 'lucide-react'

export const metadata: Metadata = {
  title: '我的帳號',
  description: '管理您的 CHIC KIM & MIU 會員帳號、訂單查詢、收藏清單、點數兌換與帳號設定。',
  robots: { index: false, follow: false },
}

const sidebarLinks = [
  { href: '/account', label: '會員總覽', icon: User },
  { href: '/account/orders', label: '我的訂單', icon: ShoppingBag },
  { href: '/account/subscription', label: '我的訂閱', icon: Crown },
  { href: '/account/wishlist', label: '收藏清單', icon: Heart },
  { href: '/account/referrals', label: '推薦好友', icon: Share2 },
  { href: '/games', label: '好運遊戲', icon: Gamepad2 },
  { href: '/account/invoices', label: '電子發票', icon: FileText },
  { href: '/account/returns', label: '退換貨', icon: RotateCcw },
  { href: '/account/reviews', label: '我的評價', icon: Star },
  { href: '/account/addresses', label: '地址管理', icon: MapPin },
  { href: '/account/points', label: '點數 / 購物金', icon: Gift },
  { href: '/account/settings', label: '帳號設定', icon: Settings },
]

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/account')

  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="container py-8 md:py-12">
        <h1 className="text-2xl font-serif mb-8">我的帳戶</h1>
        <div className="grid md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-1">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-foreground/70 hover:text-gold-600 hover:bg-cream-100 transition-colors"
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors w-full"
            >
              <LogOut size={18} />
              登出
            </button>
          </aside>

          {/* Content */}
          <main>{children}</main>
        </div>
      </div>
    </div>
  )
}
