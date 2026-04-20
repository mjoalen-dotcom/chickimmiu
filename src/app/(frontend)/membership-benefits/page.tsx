import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Crown, Gift, Truck, Star, Ticket, TrendingUp, Sparkles, Zap, Heart, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: '會員福利',
  description: 'CHIC KIM & MIU 六層會員制度，享受專屬折扣、點數倍率、免運、生日禮等多重好禮。',
}

/**
 * Phase 5.5 Batch A — 前台接通 MembershipTiers collection
 *   1. 讀 `membership-tiers` collection 取代 hardcoded TIERS
 *   2. 依登入會員 `user.gender` 決定顯示 frontName / frontNameMale
 *   3. Tailwind 顏色 lookup map by slug（不進 DB）
 */

type TierRecord = {
  id: number | string
  name: string
  slug: string
  frontName: string
  frontNameMale?: string | null
  frontSubtitle?: string | null
  tagline?: string | null
  benefitsDescription?: string | null
  level: number
  minSpent: number
  discountPercent: number
  pointsMultiplier: number
  freeShippingThreshold: number
  lotteryChances: number
  birthdayGift?: string | null
  exclusiveCouponEnabled?: boolean | null
}

type TierColorKey = 'color' | 'borderColor' | 'iconColor' | 'tagColor'
const TIER_COLORS: Record<string, Record<TierColorKey, string>> = {
  ordinary: { color: 'from-gray-100 to-gray-50', borderColor: 'border-gray-200', iconColor: 'text-gray-400', tagColor: 'bg-gray-100 text-gray-600' },
  normal:   { color: 'from-gray-100 to-gray-50', borderColor: 'border-gray-200', iconColor: 'text-gray-400', tagColor: 'bg-gray-100 text-gray-600' },
  bronze:   { color: 'from-amber-100/60 to-orange-50', borderColor: 'border-amber-200', iconColor: 'text-amber-600', tagColor: 'bg-amber-50 text-amber-700' },
  silver:   { color: 'from-slate-100 to-gray-50', borderColor: 'border-slate-200', iconColor: 'text-slate-500', tagColor: 'bg-slate-100 text-slate-600' },
  gold:     { color: 'from-yellow-100/60 to-amber-50', borderColor: 'border-yellow-300', iconColor: 'text-yellow-600', tagColor: 'bg-yellow-50 text-yellow-700' },
  platinum: { color: 'from-violet-50 to-slate-50', borderColor: 'border-violet-200', iconColor: 'text-violet-500', tagColor: 'bg-violet-50 text-violet-600' },
  diamond:  { color: 'from-sky-50 to-cyan-50', borderColor: 'border-sky-200', iconColor: 'text-sky-500', tagColor: 'bg-sky-50 text-sky-600' },
}
const DEFAULT_TIER_COLOR: Record<TierColorKey, string> = TIER_COLORS.ordinary

async function getTiers(): Promise<TierRecord[]> {
  if (!process.env.DATABASE_URI) return []
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'membership-tiers',
      sort: 'level',
      limit: 20,
      depth: 0,
    })
    return result.docs as unknown as TierRecord[]
  } catch {
    return []
  }
}

async function getSessionInfo(): Promise<{ isLoggedIn: boolean; gender: string | null }> {
  if (!process.env.DATABASE_URI) return { isLoggedIn: false, gender: null }
  try {
    const payload = await getPayload({ config })
    const headersList = await nextHeaders()
    const { user } = await payload.auth({ headers: headersList })
    if (!user) return { isLoggedIn: false, gender: null }
    const gender = (user as unknown as Record<string, unknown>)?.gender as string | null ?? null
    return { isLoggedIn: true, gender }
  } catch {
    return { isLoggedIn: false, gender: null }
  }
}

function pickTierName(tier: TierRecord, gender: string | null): string {
  if (gender === 'male' && tier.frontNameMale) return tier.frontNameMale
  return tier.frontName
}

export default async function MembershipBenefitsPage() {
  const [tiers, session] = await Promise.all([getTiers(), getSessionInfo()])
  const { isLoggedIn, gender } = session

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gold-500/10 via-cream-100 to-blush-50 border-b border-cream-200">
        <div className="container py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/10 text-gold-600 text-xs tracking-widest mb-4">
            <Heart size={14} />
            MEMBERSHIP BENEFITS
          </div>
          <h1 className="text-3xl md:text-5xl font-serif mb-4">
            會員福利
          </h1>
          <p className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            加入 CHIC KIM &amp; MIU 會員，享受專屬折扣、點數加倍、免運費、生日好禮等多重驚喜。
            <br />
            等級越高，福利越豐富！
          </p>
          {isLoggedIn ? (
            <div className="flex flex-col items-center gap-3 mt-8">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs tracking-widest border border-emerald-200">
                <Sparkles size={14} />
                已登入
              </span>
              <Link
                href="/account/referrals"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-600 transition-colors"
              >
                <Heart size={16} />
                邀請朋友
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-600 transition-colors"
              >
                立即加入會員
                <Sparkles size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-foreground/20 text-foreground rounded-full text-sm tracking-wide hover:bg-foreground/5 transition-colors"
              >
                已有帳號？登入
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Benefits overview icons */}
      <section className="bg-white border-b border-cream-200">
        <div className="container py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Ticket, label: '專屬折扣', desc: '最高 10% OFF' },
            { icon: TrendingUp, label: '點數加倍', desc: '最高 3 倍點數' },
            { icon: Truck, label: '免運優惠', desc: '金牌以上無條件免運' },
            { icon: Gift, label: '生日好禮', desc: '銀牌以上專屬好禮' },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center shrink-0">
                <b.icon size={18} className="text-gold-500" />
              </div>
              <div>
                <p className="text-sm font-medium">{b.label}</p>
                <p className="text-[10px] text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tier cards */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">{tiers.length > 0 ? `${tiers.length} TIERS` : 'MEMBER TIERS'}</p>
            <h2 className="text-2xl md:text-3xl font-serif">會員等級制度</h2>
          </div>

          {tiers.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white rounded-2xl border border-cream-200 max-w-lg mx-auto">
              <p className="text-sm text-muted-foreground mb-2">尚未設定任何會員等級。</p>
              <p className="text-xs text-muted-foreground">請至後台 &quot;會員管理 → 會員等級&quot; 新增資料。</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tiers.map((tier) => {
                const colors = TIER_COLORS[tier.slug] ?? DEFAULT_TIER_COLOR
                const tierName = pickTierName(tier, gender)
                const hasBirthday = Boolean(tier.birthdayGift)
                const hasCoupon = Boolean(tier.exclusiveCouponEnabled)
                const multiplier = tier.pointsMultiplier ?? 1
                const discount = tier.discountPercent ?? 0
                const freeShipping = tier.freeShippingThreshold ?? 0
                const lottery = tier.lotteryChances ?? 0
                const minSpent = tier.minSpent ?? 0

                return (
                  <div
                    key={tier.id}
                    className={`bg-gradient-to-br ${colors.color} rounded-2xl border ${colors.borderColor} p-6 relative overflow-hidden`}
                  >
                    {/* Level badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full tracking-wider font-medium ${colors.tagColor}`}>
                        Lv.{(tier.level ?? 0) + 1}
                      </span>
                      <Crown size={24} className={colors.iconColor} />
                    </div>

                    <h3 className="text-lg font-serif mb-1">{tierName}</h3>
                    {(tier.tagline || tier.frontSubtitle) && (
                      <p className="text-xs text-gold-600/80 italic mb-2">
                        {tier.tagline || tier.frontSubtitle}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mb-4">
                      {minSpent === 0
                        ? '免費加入即享'
                        : `累計消費滿 NT$ ${minSpent.toLocaleString()}`}
                    </p>

                    {tier.benefitsDescription && (
                      <p className="text-xs text-foreground/70 leading-relaxed mb-5">
                        {tier.benefitsDescription}
                      </p>
                    )}

                    {/* Benefits list */}
                    <div className="space-y-2.5">
                      <BenefitRow icon={Ticket} label="購物折扣" value={discount > 0 ? `${discount}% OFF` : '—'} active={discount > 0} />
                      <BenefitRow icon={TrendingUp} label="點數倍率" value={`${multiplier}x`} active={multiplier > 1} />
                      <BenefitRow icon={Truck} label="免運門檻" value={freeShipping === 0 ? '無條件免運' : `滿 NT$ ${freeShipping}`} active={freeShipping < 1000} />
                      <BenefitRow icon={Star} label="月抽獎次數" value={lottery > 0 ? `${lottery} 次` : '—'} active={lottery > 0} />
                      <BenefitRow icon={Calendar} label="生日禮" value={hasBirthday ? '專屬好禮' : '—'} active={hasBirthday} />
                      <BenefitRow icon={Zap} label="專屬優惠券" value={hasCoupon ? '每月一張' : '—'} active={hasCoupon} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-gold-500/10 to-blush-50">
        <div className="container text-center">
          <h2 className="text-2xl md:text-3xl font-serif mb-4">
            準備好開始你的會員旅程了嗎？
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            註冊完全免費，立即享有普通會員福利，每次消費都在升級的路上！
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-10 py-4 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-600 transition-colors"
          >
            <Crown size={18} />
            立即加入會員
          </Link>
        </div>
      </section>
    </main>
  )
}

function BenefitRow({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: React.ElementType
  label: string
  value: string
  active: boolean
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <Icon size={12} className={active ? 'text-gold-500' : 'text-cream-300'} />
        <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
      </div>
      <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground/40'}>
        {value}
      </span>
    </div>
  )
}
