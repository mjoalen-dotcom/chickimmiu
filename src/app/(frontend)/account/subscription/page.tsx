'use client'

import { useState } from 'react'
import { Crown, Sparkles, Gift, Zap, Calendar, ChevronRight, Star, Check } from 'lucide-react'
import { motion } from 'framer-motion'

const DEMO_PLANS = [
  {
    id: '1',
    name: '閃耀會員',
    badge: '✨',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    isFeatured: false,
    benefits: [
      { icon: '🏷️', text: '全站 95 折', highlight: false },
      { icon: '💰', text: '每月 50 購物金', highlight: false },
      { icon: '🎁', text: '1.5 倍點數', highlight: false },
      { icon: '🚚', text: '滿 $800 免運', highlight: false },
    ],
  },
  {
    id: '2',
    name: '尊榮 VIP',
    badge: '💎',
    monthlyPrice: 399,
    yearlyPrice: 3990,
    isFeatured: true,
    benefits: [
      { icon: '🏷️', text: '全站 9 折', highlight: true },
      { icon: '💰', text: '每月 150 購物金', highlight: true },
      { icon: '🎁', text: '2 倍點數', highlight: false },
      { icon: '🚚', text: '全站免運', highlight: true },
      { icon: '🎰', text: '每月 5 次抽獎', highlight: false },
      { icon: '⏰', text: '新品搶先購 24 小時', highlight: false },
      { icon: '🎂', text: '生日月 3 倍購物金', highlight: true },
      { icon: '📦', text: '每月驚喜禮盒', highlight: false },
    ],
  },
]

export default function SubscriptionPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [currentPlan] = useState<string | null>(null) // null = 未訂閱

  return (
    <main className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">SUBSCRIPTION</p>
        <h1 className="text-2xl font-serif">我的訂閱</h1>
      </div>

      {/* Current status */}
      {currentPlan ? (
        <div className="bg-gradient-to-r from-gold-500/10 to-blush-50 rounded-2xl border border-gold-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Crown size={24} className="text-gold-500" />
            <div>
              <p className="font-medium">尊榮 VIP 會員</p>
              <p className="text-xs text-muted-foreground">剩餘 25 天｜下次扣款 2026-05-11</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '本月購物金', value: 'NT$ 150' },
              { label: '點數倍率', value: '2x' },
              { label: '累計節省', value: 'NT$ 2,340' },
              { label: '連續訂閱', value: '6 個月' },
            ].map((s) => (
              <div key={s.label} className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-medium text-gold-600">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-cream-100 rounded-2xl border border-cream-200 p-6 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-gold-500" />
          <h2 className="font-serif text-lg mb-2">升級為訂閱會員</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            訂閱即享全站折扣、每月購物金、專屬抽獎與更多驚喜好禮！
          </p>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center bg-cream-100 rounded-full p-1 gap-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm transition-all ${
              billingCycle === 'monthly'
                ? 'bg-foreground text-cream-50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            月繳
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-full text-sm transition-all ${
              billingCycle === 'yearly'
                ? 'bg-foreground text-cream-50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            年繳
            <span className="ml-1 text-[10px] text-gold-500">省 17%</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-2 gap-6">
        {DEMO_PLANS.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -4 }}
            className={`relative rounded-2xl border-2 p-6 transition-all ${
              plan.isFeatured
                ? 'border-gold-500 bg-gradient-to-b from-gold-500/5 to-transparent shadow-lg'
                : 'border-cream-200 bg-white'
            }`}
          >
            {plan.isFeatured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold-500 text-white text-xs rounded-full tracking-wider">
                最受歡迎
              </span>
            )}
            <div className="text-center mb-6">
              <span className="text-3xl">{plan.badge}</span>
              <h3 className="text-lg font-serif mt-2">{plan.name}</h3>
              <div className="mt-3">
                <span className="text-3xl font-medium text-gold-600">
                  NT$ {billingCycle === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)}
                </span>
                <span className="text-sm text-muted-foreground">/月</span>
              </div>
              {billingCycle === 'yearly' && (
                <p className="text-xs text-muted-foreground mt-1">
                  年繳 NT$ {plan.yearlyPrice}（省 NT$ {plan.monthlyPrice * 12 - plan.yearlyPrice}）
                </p>
              )}
            </div>

            <div className="space-y-3 mb-6">
              {plan.benefits.map((b, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-sm ${
                    b.highlight ? 'font-medium text-gold-600' : 'text-foreground/80'
                  }`}
                >
                  <span>{b.icon}</span>
                  <span>{b.text}</span>
                  {b.highlight && <Star size={12} className="text-gold-400 ml-auto" />}
                </div>
              ))}
            </div>

            <button
              className={`w-full py-3 rounded-xl text-sm tracking-wide transition-colors ${
                plan.isFeatured
                  ? 'bg-gold-500 text-white hover:bg-gold-600'
                  : 'bg-foreground text-cream-50 hover:bg-foreground/90'
              }`}
            >
              {currentPlan === plan.id ? '目前方案' : '立即訂閱'}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Dopamine milestones */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} className="text-gold-500" />
          <h3 className="font-medium">連續訂閱里程碑</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { months: 3, reward: '贈 NT$100 購物金', icon: Gift },
            { months: 6, reward: '限定金色徽章', icon: Crown },
            { months: 9, reward: '贈 NT$300 購物金', icon: Sparkles },
            { months: 12, reward: '年度神秘大禮', icon: Star },
          ].map((m) => (
            <div key={m.months} className="text-center p-4 bg-cream-50 rounded-xl border border-cream-200">
              <m.icon size={20} className="mx-auto mb-2 text-gold-500" />
              <p className="text-xs text-muted-foreground">連續 {m.months} 個月</p>
              <p className="text-xs font-medium mt-1">{m.reward}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-3">
        <h3 className="font-medium mb-4">常見問題</h3>
        {[
          { q: '訂閱後可以隨時取消嗎？', a: '可以！您可以隨時取消訂閱，已付費的期間權益仍然有效直到到期。' },
          { q: '購物金什麼時候發放？', a: '每月訂閱日自動發放到您的帳戶，當月有效。' },
          { q: '年繳可以退費嗎？', a: '年繳首月內可申請全額退費，超過首月按比例計算。' },
        ].map((faq, i) => (
          <details key={i} className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 text-sm font-medium border-b border-cream-200">
              {faq.q}
              <ChevronRight size={14} className="text-muted-foreground group-open:rotate-90 transition-transform" />
            </summary>
            <p className="text-sm text-muted-foreground py-3 leading-relaxed">{faq.a}</p>
          </details>
        ))}
      </div>
    </main>
  )
}
