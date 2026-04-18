import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Crown, Coins, Wallet, TrendingUp, Gamepad2, ArrowRight, Package } from 'lucide-react'
import { CreditScoreCard } from '@/components/account/CreditScoreCard'

export const metadata: Metadata = {
  title: '會員總覽',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

function pickTierName(tier: LooseRecord, gender: string | null): string {
  const male = tier.frontNameMale as string | null | undefined
  if (gender === 'male' && male) return male
  return (tier.frontName as string) ?? (tier.name as string) ?? '—'
}

function formatDate(raw: unknown): string {
  if (!raw) return ''
  try {
    const d = new Date(raw as string)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待處理',
  processing: '處理中',
  shipped: '已出貨',
  delivered: '已送達',
  cancelled: '已取消',
  refunded: '已退款',
}

export default async function AccountPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account')

  const [userDoc, tiersResult, ordersResult] = await Promise.all([
    payload.findByID({ collection: 'users', id: sessionUser.id, depth: 1 }),
    payload.find({ collection: 'membership-tiers', sort: 'level', limit: 20, depth: 0 }),
    payload.find({
      collection: 'orders',
      where: { customer: { equals: sessionUser.id } },
      sort: '-createdAt',
      limit: 3,
      depth: 0,
    }),
  ])

  const user = userDoc as unknown as LooseRecord
  const gender = (user.gender as string | null) ?? null
  const points = (user.points as number) ?? 0
  const shoppingCredit = (user.shoppingCredit as number) ?? 0
  const lifetimeSpend =
    (user.lifetimeSpend as number | null | undefined) ??
    (user.totalSpent as number | null | undefined) ??
    0

  const tiers = tiersResult.docs as unknown as LooseRecord[]
  const memberTier = user.memberTier as LooseRecord | null
  const currentLevel = memberTier ? ((memberTier.level as number) ?? 0) : 0
  const currentDisplayName = memberTier
    ? pickTierName(memberTier, gender)
    : pickTierName((tiers[0] ?? {}) as LooseRecord, gender) || '會員'
  const currentDiscountPercent = memberTier ? ((memberTier.discountPercent as number) ?? 0) : 0

  const nextTier = tiers.find((t) => ((t.level as number) ?? 0) === currentLevel + 1) ?? null
  const nextTierName = nextTier ? pickTierName(nextTier, gender) : null
  const nextTierMinSpent = nextTier ? ((nextTier.minSpent as number) ?? 0) : 0
  const remainingToNext = nextTier ? Math.max(0, nextTierMinSpent - lifetimeSpend) : 0
  const progressPct = nextTier && nextTierMinSpent > 0
    ? Math.min(100, Math.round((lifetimeSpend / nextTierMinSpent) * 100))
    : 100

  const recentOrders = (ordersResult.docs as unknown as LooseRecord[]).map((o) => ({
    id: String(o.id),
    orderNumber: (o.orderNumber as string) ?? '—',
    date: formatDate(o.createdAt),
    total: (o.total as number) ?? 0,
    status: (o.status as string) ?? 'pending',
    statusLabel: STATUS_LABEL[(o.status as string) ?? 'pending'] ?? '待處理',
  }))

  const upgradeSubtitle = nextTier
    ? `再消費 NT$ ${remainingToNext.toLocaleString()} 即可升級為「${nextTierName}」`
    : '已達最高等級，感謝您的支持'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 會員等級卡 */}
      <div className="bg-gradient-to-br from-cream-100 to-blush-50 rounded-2xl p-6 md:p-8 border border-cream-200">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs tracking-widest text-gold-500 mb-1">MEMBERSHIP</p>
            <h2 className="text-xl font-serif">{currentDisplayName}</h2>
            <p className="text-sm text-muted-foreground mt-1">{upgradeSubtitle}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center">
            <Crown size={24} className="text-gold-500" />
          </div>
        </div>
        {/* 升級進度條 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>累計消費 NT$ {lifetimeSpend.toLocaleString()}</span>
            <span>
              {nextTier
                ? `${nextTierName} NT$ ${nextTierMinSpent.toLocaleString()}`
                : '已達頂級'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 數據卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Coins, label: '會員點數', value: points.toLocaleString(), color: 'text-gold-500' },
          { icon: Wallet, label: '購物金', value: `NT$ ${shoppingCredit.toLocaleString()}`, color: 'text-green-600' },
          { icon: TrendingUp, label: '累計消費', value: `NT$ ${lifetimeSpend.toLocaleString()}`, color: 'text-blue-600' },
          { icon: Crown, label: '會員折扣', value: `${currentDiscountPercent}%`, color: 'text-purple-600' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4 border border-cream-200"
          >
            <card.icon size={20} className={`${card.color} mb-3`} />
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-lg font-medium mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* 信用分數 */}
      <CreditScoreCard />

      {/* 好運遊戲快捷入口 */}
      <div className="bg-gradient-to-br from-gold-500/5 to-blush-50 rounded-2xl p-6 border border-gold-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gamepad2 size={20} className="text-gold-500" />
            <h3 className="font-medium">好運遊戲</h3>
          </div>
          <Link href="/games" className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 transition-colors">
            查看全部 <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { emoji: '📅', label: '每日簽到', href: '/games/daily-checkin' },
            { emoji: '🎡', label: '幸運轉盤', href: '/games/spin-wheel' },
            { emoji: '🎫', label: '刮刮樂', href: '/games/scratch-card' },
            { emoji: '🃏', label: '抽卡對戰', href: '/games/card-battle' },
          ].map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="text-center p-3 rounded-xl bg-white/60 hover:bg-white border border-cream-200/50 hover:border-gold-400/30 transition-all group"
            >
              <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">{g.emoji}</span>
              <p className="text-[10px] text-muted-foreground">{g.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* 最近訂單 */}
      <div className="bg-white rounded-2xl p-6 border border-cream-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">最近訂單</h3>
          {recentOrders.length > 0 && (
            <Link href="/account/orders" className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 transition-colors">
              查看全部 <ArrowRight size={12} />
            </Link>
          )}
        </div>
        {recentOrders.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <Package size={36} className="mx-auto text-cream-200 mb-3" />
            <p>目前還沒有訂單</p>
            <Link href="/products" className="text-gold-600 hover:underline mt-2 inline-block">
              去逛逛 &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href="/account/orders"
                className="flex items-center justify-between py-3 border-b border-cream-100 last:border-0 hover:bg-cream-50/50 transition-colors -mx-2 px-2 rounded-lg"
              >
                <div>
                  <p className="text-sm font-mono">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">NT$ {order.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{order.statusLabel}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
