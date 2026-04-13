import type { Metadata } from 'next'
import Link from 'next/link'
import { Crown, Gift, Truck, Star, Ticket, TrendingUp, Sparkles, Zap, Heart, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: '會員福利',
  description: 'CHIC KIM & MIU 六層會員制度，享受專屬折扣、點數倍率、免運、生日禮等多重好禮。',
}

const TIERS = [
  {
    name: '普通會員',
    slug: 'normal',
    level: 1,
    minSpent: 0,
    discount: 0,
    multiplier: 1,
    freeShipping: 1000,
    lottery: 0,
    birthday: false,
    coupon: false,
    color: 'from-gray-100 to-gray-50',
    borderColor: 'border-gray-200',
    iconColor: 'text-gray-400',
    tagColor: 'bg-gray-100 text-gray-600',
  },
  {
    name: '銅牌會員',
    slug: 'bronze',
    level: 2,
    minSpent: 3000,
    discount: 2,
    multiplier: 1.2,
    freeShipping: 800,
    lottery: 1,
    birthday: false,
    coupon: false,
    color: 'from-amber-100/60 to-orange-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
    tagColor: 'bg-amber-50 text-amber-700',
  },
  {
    name: '銀牌會員',
    slug: 'silver',
    level: 3,
    minSpent: 10000,
    discount: 3,
    multiplier: 1.5,
    freeShipping: 600,
    lottery: 2,
    birthday: true,
    coupon: false,
    color: 'from-slate-100 to-gray-50',
    borderColor: 'border-slate-200',
    iconColor: 'text-slate-500',
    tagColor: 'bg-slate-100 text-slate-600',
  },
  {
    name: '金牌會員',
    slug: 'gold',
    level: 4,
    minSpent: 30000,
    discount: 5,
    multiplier: 2,
    freeShipping: 0,
    lottery: 3,
    birthday: true,
    coupon: true,
    color: 'from-yellow-100/60 to-amber-50',
    borderColor: 'border-yellow-300',
    iconColor: 'text-yellow-600',
    tagColor: 'bg-yellow-50 text-yellow-700',
  },
  {
    name: '白金會員',
    slug: 'platinum',
    level: 5,
    minSpent: 60000,
    discount: 8,
    multiplier: 2.5,
    freeShipping: 0,
    lottery: 5,
    birthday: true,
    coupon: true,
    color: 'from-violet-50 to-slate-50',
    borderColor: 'border-violet-200',
    iconColor: 'text-violet-500',
    tagColor: 'bg-violet-50 text-violet-600',
  },
  {
    name: '鑽石會員',
    slug: 'diamond',
    level: 6,
    minSpent: 100000,
    discount: 10,
    multiplier: 3,
    freeShipping: 0,
    lottery: 10,
    birthday: true,
    coupon: true,
    color: 'from-sky-50 to-cyan-50',
    borderColor: 'border-sky-200',
    iconColor: 'text-sky-500',
    tagColor: 'bg-sky-50 text-sky-600',
  },
]

export default function MembershipBenefitsPage() {
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
            <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">6 TIERS</p>
            <h2 className="text-2xl md:text-3xl font-serif">六層會員等級</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.slug}
                className={`bg-gradient-to-br ${tier.color} rounded-2xl border ${tier.borderColor} p-6 relative overflow-hidden`}
              >
                {/* Level badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full tracking-wider font-medium ${tier.tagColor}`}>
                    Lv.{tier.level}
                  </span>
                  <Crown size={24} className={tier.iconColor} />
                </div>

                <h3 className="text-lg font-serif mb-1">{tier.name}</h3>
                <p className="text-xs text-muted-foreground mb-5">
                  {tier.minSpent === 0
                    ? '免費加入即享'
                    : `累計消費滿 NT$ ${tier.minSpent.toLocaleString()}`}
                </p>

                {/* Benefits list */}
                <div className="space-y-2.5">
                  <BenefitRow icon={Ticket} label="購物折扣" value={tier.discount > 0 ? `${tier.discount}% OFF` : '—'} active={tier.discount > 0} />
                  <BenefitRow icon={TrendingUp} label="點數倍率" value={`${tier.multiplier}x`} active={tier.multiplier > 1} />
                  <BenefitRow icon={Truck} label="免運門檻" value={tier.freeShipping === 0 ? '無條件免運' : `滿 NT$ ${tier.freeShipping}`} active={tier.freeShipping < 1000} />
                  <BenefitRow icon={Star} label="月抽獎次數" value={tier.lottery > 0 ? `${tier.lottery} 次` : '—'} active={tier.lottery > 0} />
                  <BenefitRow icon={Calendar} label="生日禮" value={tier.birthday ? '專屬好禮' : '—'} active={tier.birthday} />
                  <BenefitRow icon={Zap} label="專屬優惠券" value={tier.coupon ? '每月一張' : '—'} active={tier.coupon} />
                </div>
              </div>
            ))}
          </div>
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
