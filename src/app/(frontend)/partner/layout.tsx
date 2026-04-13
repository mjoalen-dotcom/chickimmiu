import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, Link2, DollarSign, Wallet, Settings } from 'lucide-react'

export const metadata: Metadata = {
  title: '合作夥伴',
  description: '管理您的 CHIC KIM & MIU 推廣夥伴帳戶，查看佣金明細、推廣連結與提款紀錄。',
  robots: { index: false, follow: false },
}

const partnerLinks = [
  { href: '/partner', label: '推廣總覽', icon: BarChart3 },
  { href: '/partner/referrals', label: '推廣連結', icon: Link2 },
  { href: '/partner/earnings', label: '佣金明細', icon: DollarSign },
  { href: '/partner/withdraw', label: '申請提款', icon: Wallet },
]

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center">
            <BarChart3 size={20} className="text-gold-500" />
          </div>
          <div>
            <h1 className="text-2xl font-serif">合作夥伴後台</h1>
            <p className="text-xs text-muted-foreground">Partner Dashboard</p>
          </div>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-1">
            {partnerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-foreground/70 hover:text-gold-600 hover:bg-cream-100 transition-colors"
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}
          </aside>

          {/* Content */}
          <main>{children}</main>
        </div>
      </div>
    </div>
  )
}
