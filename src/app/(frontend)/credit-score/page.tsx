import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShoppingBag,
  Gift,
  Heart,
  Cake,
  Users,
  Repeat,
  AlertTriangle,
  PackageX,
  XCircle,
  ArrowRight,
  Star,
} from 'lucide-react'
import { DEFAULT_CREDIT_SCORE_CONFIG, INITIAL_CREDIT_SCORE } from '@/lib/crm/creditScoreEngine'

export const metadata: Metadata = {
  title: '信用分數制度',
  description: 'CHIC KIM & MIU 信用分數制度說明：分數計算方式、各等級權益與提升建議。',
}

const C = DEFAULT_CREDIT_SCORE_CONFIG

const STATUS_TIERS: {
  key: string
  label: string
  range: string
  icon: string
  bg: string
  text: string
  bar: string
  desc: string
  perks: string[]
}[] = [
  {
    key: 'excellent',
    label: '優質好客人',
    range: `${C.excellentThreshold}+`,
    icon: '✨',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    desc: '您是我們最珍貴的好客人。感謝您的支持與信賴。',
    perks: [
      '所有會員等級優惠無限制享用',
      '優先參加 VIP 活動與新品預購',
      '退換貨享有最寬鬆審核條件',
      '達 95 分以上可獲得好客人表揚加分',
    ],
  },
  {
    key: 'normal',
    label: '一般會員',
    range: `${C.normalThreshold}–${C.excellentThreshold - 1}`,
    icon: '👍',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    bar: 'bg-blue-500',
    desc: '標準會員狀態，享有完整會員權益。',
    perks: [
      '完整享有會員折扣、點數、抽獎等權益',
      '退換貨正常審核',
      '繼續消費與好評即可邁向優質好客人',
    ],
  },
  {
    key: 'watchlist',
    label: '觀察中',
    range: `${C.watchlistThreshold}–${C.normalThreshold - 1}`,
    icon: '⚠️',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    bar: 'bg-amber-500',
    desc: '近期有較多退貨或棄單行為，我們關心您的購物體驗是否順利。',
    perks: [
      '基本會員權益仍可使用',
      '退換貨審核較為嚴格',
      '建議透過購物、好評、準時收貨提升分數',
    ],
  },
  {
    key: 'warning',
    label: '警告',
    range: `${C.warningThreshold}–${C.watchlistThreshold - 1}`,
    icon: '🔶',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    bar: 'bg-orange-500',
    desc: '分數偏低，部分會員優惠可能受限。',
    perks: [
      '折扣券、抽獎等優惠可能受限',
      '退換貨需主動聯繫客服',
      '可透過好評、分享、準時收貨恢復分數',
    ],
  },
  {
    key: 'blacklist',
    label: '黑名單',
    range: `1–${C.warningThreshold - 1}`,
    icon: '⛔',
    bg: 'bg-red-50',
    text: 'text-red-700',
    bar: 'bg-red-500',
    desc: '多項會員權益暫時停用，歡迎透過購物重新累積信任。',
    perks: [
      '無法使用會員折扣、抽獎、優惠券',
      '購物仍可進行，所有交易需採標準方式',
      '如有疑問請聯繫客服專員',
    ],
  },
  {
    key: 'suspended',
    label: '停權',
    range: '0',
    icon: '🚫',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    bar: 'bg-gray-500',
    desc: '帳號已暫停會員功能。',
    perks: [
      '會員相關功能停用',
      '請聯繫客服申請恢復',
    ],
  },
]

const EARN_RULES: { icon: React.ElementType; label: string; value: string; detail?: string }[] = [
  { icon: Sparkles, label: '首次註冊', value: `+${C.firstRegister}`, detail: '註冊完成即享' },
  { icon: ShoppingBag, label: '首次購買', value: `+${C.firstPurchase}`, detail: '第一筆訂單完成' },
  { icon: ShoppingBag, label: '一般購買', value: `+${C.normalPurchase}`, detail: '每筆訂單完成' },
  { icon: TrendingUp, label: '消費金額加分', value: `+${C.purchaseAmountBonus} / 每 1,000 元`, detail: `單筆上限 +${C.purchaseAmountBonusMax}` },
  { icon: Heart, label: '商品好評', value: `+${C.goodReview}`, detail: '每筆評價' },
  { icon: Heart, label: '好評附圖', value: `+${C.photoReview}`, detail: '附圖評價更加分' },
  { icon: Users, label: '推薦好友成功', value: `+${C.referralSuccess}`, detail: '好友完成首購' },
  { icon: Cake, label: '生日月加分', value: `+${C.birthdayBonus}`, detail: '生日當月享有' },
  { icon: Gift, label: '訂閱會員月加分', value: `+${C.subscriberMonthly}`, detail: '每月結算' },
  { icon: Repeat, label: '準時收貨', value: `+${C.onTimeDelivery}`, detail: '準時簽收訂單' },
  { icon: Star, label: '好客人表揚', value: `+${C.goodCustomerReward}`, detail: '分數 95 分以上' },
]

const LOSE_RULES: { icon: React.ElementType; label: string; value: string; detail?: string }[] = [
  { icon: PackageX, label: '一般退貨', value: `${C.returnGeneral.min} ~ ${C.returnGeneral.max}`, detail: '依退貨狀況判定' },
  { icon: PackageX, label: '無理由退貨', value: `${C.returnNoReason}`, detail: '單次' },
  { icon: PackageX, label: '連續 2 次無理由退貨', value: `${C.returnNoReasonConsecutive2}`, detail: '加重扣分' },
  { icon: PackageX, label: '連續 3 次以上無理由退貨', value: `${C.returnNoReasonConsecutive3Plus}`, detail: '大幅扣分' },
  { icon: AlertTriangle, label: '高退貨率', value: `${C.returnRatePenalty}`, detail: `${Math.round(C.returnRateThreshold * 100)}% 以上（${C.returnRateWindowDays} 天內）` },
  { icon: XCircle, label: '購物車棄單', value: `${C.abandonedCart}`, detail: '長期未結帳' },
  { icon: XCircle, label: '惡意取消訂單', value: `${C.maliciousCancel}`, detail: '下單後刻意取消' },
]

export default function CreditScorePage() {
  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gold-500/10 via-cream-100 to-emerald-50 border-b border-cream-200">
        <div className="container py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/10 text-gold-600 text-xs tracking-widest mb-4">
            <Shield size={14} />
            CREDIT SCORE
          </div>
          <h1 className="text-3xl md:text-5xl font-serif mb-4">信用分數制度</h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            信用分數是 CHIC KIM &amp; MIU 衡量會員信任關係的指標。
            <br />
            範圍 <span className="font-medium text-foreground">0 – 100 分</span>，
            註冊時起始 <span className="font-medium text-foreground">{INITIAL_CREDIT_SCORE} 分</span>。
            <br />
            購物、好評、準時收貨皆可累積分數，維持良好紀錄即享最完整會員權益。
          </p>
        </div>
      </section>

      {/* Status tiers */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">STATUS TIERS</p>
            <h2 className="text-2xl md:text-3xl font-serif">6 個信用狀態</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {STATUS_TIERS.map((t) => (
              <div
                key={t.key}
                className={`${t.bg} rounded-2xl border border-cream-200 p-6 space-y-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <p className="text-sm font-serif">{t.label}</p>
                      <p className={`text-[10px] tracking-widest ${t.text}`}>{t.range} 分</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed">{t.desc}</p>
                <ul className="space-y-1.5">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[11px] text-foreground/70">
                      <span className={`shrink-0 w-1 h-1 mt-1.5 rounded-full ${t.bar}`} />
                      <span className="leading-relaxed">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earn + Lose */}
      <section className="py-16 md:py-20 bg-white border-y border-cream-200">
        <div className="container grid md:grid-cols-2 gap-8">
          {/* Earn */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={18} className="text-emerald-600" />
              <h3 className="text-lg font-serif">加分項</h3>
            </div>
            <div className="space-y-2">
              {EARN_RULES.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <r.icon size={14} className="text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{r.label}</p>
                      {r.detail && (
                        <p className="text-[10px] text-muted-foreground truncate">{r.detail}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600 shrink-0 ml-2">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lose */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <TrendingDown size={18} className="text-red-500" />
              <h3 className="text-lg font-serif">扣分項</h3>
            </div>
            <div className="space-y-2">
              {LOSE_RULES.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between p-3 rounded-xl bg-red-50/40 border border-red-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <r.icon size={14} className="text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{r.label}</p>
                      {r.detail && (
                        <p className="text-[10px] text-muted-foreground truncate">{r.detail}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-red-500 shrink-0 ml-2">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="py-16 md:py-20">
        <div className="container max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">IMPROVE YOUR SCORE</p>
            <h2 className="text-2xl md:text-3xl font-serif">如何提升信用分數</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: ShoppingBag, title: '持續購物', desc: '每筆訂單都會加分，金額越高加分越多（每 1,000 元 +2，上限 +10）。' },
              { icon: Heart, title: '留下好評', desc: '商品評價 +10 分，附上照片再加 +12 分，幫助其他買家也幫自己加分。' },
              { icon: Repeat, title: '準時收貨', desc: '收到包裹後盡快確認收貨，每次 +5 分。' },
              { icon: Users, title: '推薦好友', desc: '邀請好友完成首購，雙方皆受益，您可獲 +18 分。' },
              { icon: Cake, title: '把握生日月', desc: '生日當月自動 +10 分，記得在會員設定填寫生日日期。' },
              { icon: Gift, title: '訂閱會員', desc: '訂閱會員每月結算自動 +5 分，穩定累積。' },
            ].map((tip) => (
              <div
                key={tip.title}
                className="p-5 rounded-2xl bg-white border border-cream-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <tip.icon size={16} className="text-gold-500" />
                  <p className="text-sm font-medium">{tip.title}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-gold-500/10 to-emerald-50">
        <div className="container text-center">
          <h2 className="text-2xl md:text-3xl font-serif mb-4">
            查看您的信用分數
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            登入會員中心，即時查看您的信用分數、歷史紀錄與下一步建議。
          </p>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 px-10 py-4 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-600 transition-colors"
          >
            <Shield size={18} />
            前往會員中心
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  )
}
