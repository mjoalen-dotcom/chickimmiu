import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Crown, Coins, Wallet, TrendingUp, Gamepad2, ArrowRight, Package, Ticket, Truck, Gift, Sparkles, Award, Gem, Layers, Receipt } from 'lucide-react'
import { CreditScoreCard } from '@/components/account/CreditScoreCard'
import AccountAvatarUpload from '@/components/account/AccountAvatarUpload'
import { HoroscopeBlock } from '@/components/account/HoroscopeBlock'

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

const POINTS_SOURCE_LABEL: Record<string, string> = {
  purchase: '購買',
  review: '評價',
  referral: '推薦',
  birthday: '生日',
  monthly_bonus: '月度獎勵',
  game: '遊戲',
  redemption: '兌換',
  order_refund: '訂單退款',
  admin: '管理員調整',
  points_expiry: '點數過期',
  welcome: '歡迎禮',
  tier_upgrade: '升等贈點',
  card_burn: '銷毀造型卡',
}

const POINTS_TYPE_LABEL: Record<string, string> = {
  earn: '獲得',
  redeem: '兌換',
  expire: '過期',
  admin_adjust: '管理員調整',
  refund_deduct: '退款扣回',
}

export default async function AccountPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account')

  const [userDoc, tiersResult, ordersResult, badgesResult, treasuresResult, pointsTxnsResult] = await Promise.all([
    payload.findByID({ collection: 'users', id: sessionUser.id, depth: 1 }),
    payload.find({ collection: 'membership-tiers', sort: 'level', limit: 20, depth: 0 }),
    payload.find({
      collection: 'orders',
      where: { customer: { equals: sessionUser.id } },
      sort: '-createdAt',
      limit: 3,
      depth: 0,
    }),
    // 勳章：包含所有狀態（badge 通常不會 consume，全部都算擁有）
    payload.find({
      collection: 'user-rewards',
      where: {
        and: [
          { user: { equals: sessionUser.id } },
          { rewardType: { equals: 'badge' } },
        ],
      },
      limit: 1,
      depth: 0,
    }),
    // 寶物：非 badge 的可用獎項（unused / pending_attach / shipped）
    payload.find({
      collection: 'user-rewards',
      where: {
        and: [
          { user: { equals: sessionUser.id } },
          { rewardType: { not_equals: 'badge' } },
          { state: { in: ['unused', 'pending_attach', 'shipped'] } },
        ],
      },
      limit: 1,
      depth: 0,
    }),
    // 點數異動最近 6 筆（PointsTransactions.access.read = isAdmin，這裡用 server-side
    // payload.find 直接讀，不需 overrideAccess — payload.find 在 server context 不套 access）
    payload.find({
      collection: 'points-transactions',
      where: { user: { equals: sessionUser.id } },
      sort: '-createdAt',
      limit: 6,
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
  const displayName = (user.name as string) ?? (user.email as string) ?? '會員'
  const avatarUrl =
    user.avatar && typeof user.avatar === 'object'
      ? ((user.avatar as LooseRecord).url as string | undefined) ?? null
      : null
  const badgesCount = badgesResult.totalDocs
  const treasuresCount = treasuresResult.totalDocs

  const tiers = tiersResult.docs as unknown as LooseRecord[]
  const memberTier = (user.memberTier as LooseRecord | null) ?? (tiers[0] ?? null) as LooseRecord | null
  const currentLevel = memberTier ? ((memberTier.level as number) ?? 0) : 0
  const currentDisplayName = memberTier
    ? pickTierName(memberTier, gender)
    : pickTierName((tiers[0] ?? {}) as LooseRecord, gender) || '會員'
  const currentDiscountPercent = memberTier ? ((memberTier.discountPercent as number) ?? 0) : 0
  const currentTagline = memberTier
    ? (memberTier.tagline as string | null | undefined) ?? (memberTier.frontSubtitle as string | null | undefined) ?? null
    : null
  const currentDescription = memberTier
    ? (memberTier.benefitsDescription as string | null | undefined) ?? null
    : null
  const currentMultiplier = memberTier ? ((memberTier.pointsMultiplier as number) ?? 1) : 1
  const currentFreeShipping = memberTier ? ((memberTier.freeShippingThreshold as number) ?? 0) : 0
  const currentLottery = memberTier ? ((memberTier.lotteryChances as number) ?? 0) : 0
  const currentBirthdayGift = memberTier ? ((memberTier.birthdayGift as string | null | undefined) ?? null) : null
  const currentCouponEnabled = memberTier ? Boolean(memberTier.exclusiveCouponEnabled) : false

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

  const recentPointsTxns = (pointsTxnsResult.docs as unknown as LooseRecord[]).map((t) => {
    const amount = (t.amount as number) ?? 0
    const type = (t.type as string) ?? 'earn'
    const source = (t.source as string) ?? ''
    const description = (t.description as string) || POINTS_SOURCE_LABEL[source] || POINTS_TYPE_LABEL[type] || '點數異動'
    return {
      id: String(t.id),
      date: formatDate(t.createdAt),
      description,
      amount,
      balance: (t.balance as number) ?? null,
      isEarn: amount >= 0,
    }
  })

  const upgradeSubtitle = nextTier
    ? `再消費 NT$ ${remainingToNext.toLocaleString()} 即可升級為「${nextTierName}」`
    : '已達最高等級，感謝您的支持'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 大頭貼 */}
      <AccountAvatarUpload currentAvatarUrl={avatarUrl} displayName={displayName} />

      {/* 今日星座運勢 + 穿搭推薦 */}
      <HoroscopeBlock />

      {/* 會員等級卡 */}
      <div className="bg-gradient-to-br from-cream-100 to-blush-50 rounded-2xl p-6 md:p-8 border border-cream-200">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs tracking-widest text-gold-500 mb-1">MEMBERSHIP</p>
            <h2 className="text-xl font-serif">{currentDisplayName}</h2>
            {currentTagline && (
              <p className="text-xs text-gold-600/80 italic mt-0.5">{currentTagline}</p>
            )}
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

        {/* 等級介紹文案 */}
        {currentDescription && (
          <p className="text-xs text-foreground/70 leading-relaxed mt-5 pt-5 border-t border-cream-200/60">
            {currentDescription}
          </p>
        )}

        {/* 目前享有福利 */}
        <div className="mt-5 pt-5 border-t border-cream-200/60">
          <p className="text-xs font-medium text-foreground/80 mb-3">您目前享有的福利</p>
          <div className="grid grid-cols-2 gap-2.5">
            <BenefitChip icon={Ticket} label={currentDiscountPercent > 0 ? `${currentDiscountPercent}% 折扣` : '無折扣'} active={currentDiscountPercent > 0} />
            <BenefitChip icon={TrendingUp} label={`${currentMultiplier}x 點數`} active={currentMultiplier > 1} />
            <BenefitChip
              icon={Truck}
              label={currentFreeShipping === 0 ? '無條件免運' : `滿 NT$ ${currentFreeShipping.toLocaleString()} 免運`}
              active={currentFreeShipping < 1000}
            />
            <BenefitChip
              icon={Sparkles}
              label={currentLottery > 0 ? `每月 ${currentLottery} 次抽獎` : '無抽獎'}
              active={currentLottery > 0}
            />
            <BenefitChip icon={Gift} label={currentBirthdayGift ? '生日禮遇' : '無生日禮'} active={Boolean(currentBirthdayGift)} />
            <BenefitChip icon={Crown} label={currentCouponEnabled ? '專屬優惠券' : '無專屬券'} active={currentCouponEnabled} />
          </div>
          <Link
            href="/membership-benefits"
            className="inline-flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 transition-colors mt-4"
          >
            查看所有會員等級與福利 <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* 數據卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* 會員點數 → /account/points（保留點數明細） */}
        <Link
          href="/account/points"
          className="group bg-white rounded-xl p-4 border border-cream-200 hover:border-gold-400/50 hover:shadow-sm transition-all"
        >
          <Coins size={20} className="text-gold-500 mb-3" />
          <p className="text-xs text-muted-foreground">會員點數</p>
          <p className="text-lg font-medium mt-1">{points.toLocaleString()}</p>
        </Link>

        {/* 購物金 */}
        <div className="bg-white rounded-xl p-4 border border-cream-200">
          <Wallet size={20} className="text-green-600 mb-3" />
          <p className="text-xs text-muted-foreground">購物金</p>
          <p className="text-lg font-medium mt-1">NT$ {shoppingCredit.toLocaleString()}</p>
        </div>

        {/* 累計消費 */}
        <div className="bg-white rounded-xl p-4 border border-cream-200">
          <TrendingUp size={20} className="text-blue-600 mb-3" />
          <p className="text-xs text-muted-foreground">累計消費</p>
          <p className="text-lg font-medium mt-1">NT$ {lifetimeSpend.toLocaleString()}</p>
        </div>

        {/* 會員折扣 */}
        <div className="bg-white rounded-xl p-4 border border-cream-200">
          <Crown size={20} className="text-purple-600 mb-3" />
          <p className="text-xs text-muted-foreground">會員折扣</p>
          <p className="text-lg font-medium mt-1">{currentDiscountPercent}%</p>
        </div>

        {/* 我的勳章 → /account/treasure */}
        <Link
          href="/account/treasure"
          className="group bg-white rounded-xl p-4 border border-cream-200 hover:border-gold-400/50 hover:shadow-sm transition-all relative"
        >
          <Award size={20} className="text-amber-600 mb-3" />
          <p className="text-xs text-muted-foreground">我的勳章</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-lg font-medium">{badgesCount.toLocaleString()}</p>
            <ArrowRight size={14} className="text-cream-300 group-hover:text-gold-500 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* 我的寶物 → /account/treasure */}
        <Link
          href="/account/treasure"
          className="group bg-white rounded-xl p-4 border border-cream-200 hover:border-gold-400/50 hover:shadow-sm transition-all relative"
        >
          <Gem size={20} className="text-rose-500 mb-3" />
          <p className="text-xs text-muted-foreground">我的寶物</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-lg font-medium">{treasuresCount.toLocaleString()}</p>
            <ArrowRight size={14} className="text-cream-300 group-hover:text-gold-500 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* 我的造型卡 → /account/cards */}
        <Link
          href="/account/cards"
          className="group bg-white rounded-xl p-4 border border-cream-200 hover:border-gold-400/50 hover:shadow-sm transition-all relative"
        >
          <Layers size={20} className="text-amber-500 mb-3" />
          <p className="text-xs text-muted-foreground">造型卡</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-lg font-medium">收藏</p>
            <ArrowRight size={14} className="text-cream-300 group-hover:text-gold-500 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
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

      {/* 點數明細 */}
      <div className="bg-white rounded-2xl p-6 border border-cream-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-gold-500" />
            <h3 className="font-medium">點數明細</h3>
          </div>
          <Link href="/account/points" className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 transition-colors">
            查看全部 <ArrowRight size={12} />
          </Link>
        </div>
        {recentPointsTxns.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Coins size={32} className="mx-auto text-cream-200 mb-3" />
            <p>尚無點數異動紀錄</p>
            <p className="text-xs mt-1">完成訂單、評價、推薦好友皆可獲得點數</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPointsTxns.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between py-2.5 border-b border-cream-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      txn.isEarn ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-500'
                    }`}
                  >
                    {txn.isEarn ? '+' : '−'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{txn.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{txn.date}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-3">
                  <p className={`text-sm font-medium ${txn.isEarn ? 'text-green-600' : 'text-rose-500'}`}>
                    {txn.isEarn ? '+' : ''}{txn.amount.toLocaleString()}
                  </p>
                  {txn.balance != null && (
                    <p className="text-[10px] text-muted-foreground">餘 {txn.balance.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BenefitChip({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] ${
        active
          ? 'bg-white/70 border border-cream-200 text-foreground'
          : 'bg-cream-100/50 border border-cream-200/50 text-muted-foreground/60'
      }`}
    >
      <Icon size={12} className={active ? 'text-gold-500' : 'text-cream-300'} />
      <span className="truncate">{label}</span>
    </div>
  )
}
