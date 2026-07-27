'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Crown, Sparkles, Gift, Zap, ChevronRight, Star, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

export type SubscriptionPlanView = {
  id: string
  slug: string
  name: string
  badge?: string
  isFeatured: boolean
  monthlyPrice: number
  yearlyPrice?: number | null
  benefits: {
    discountPercent: number
    pointsMultiplier: number
    freeShippingThreshold: number | null
    monthlyCredit: number
  }
  milestones: { months: number; reward: string; creditAmount: number }[]
  featureList: { icon?: string; text: string; highlight: boolean }[]
}

export type CurrentSubscriptionView = {
  planSlug: string
  planName: string
  badge?: string
  status: 'active' | 'cancelled'
  billingCycle: 'monthly' | 'yearly'
  amount: number
  validUntil: string
  streakMonths: number
  benefits: SubscriptionPlanView['benefits']
  milestones: SubscriptionPlanView['milestones']
}

interface SubscriptionClientProps {
  plans: SubscriptionPlanView[]
  current: CurrentSubscriptionView | null
  isLoggedIn: boolean
}

const fmtDate = (iso: string) => iso.slice(0, 10)

export default function SubscriptionClient({ plans, current, isLoggedIn }: SubscriptionClientProps) {
  const searchParams = useSearchParams()
  const justPaid = searchParams.get('paid') === '1'

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    current?.billingCycle || 'monthly',
  )
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState('')

  // 綠界導回後 callback 可能還沒進來：剛付款但 server 還沒看到訂閱 → 提示處理中並自動刷新
  const [awaitingActivation, setAwaitingActivation] = useState(justPaid && !current)
  useEffect(() => {
    if (!awaitingActivation) return
    let tries = 0
    const timer = setInterval(async () => {
      tries += 1
      try {
        const r = await fetch('/api/subscription/me', { credentials: 'include' })
        const m = await r.json()
        if (m?.active) {
          clearInterval(timer)
          window.location.replace('/account/subscription')
          return
        }
      } catch {
        /* 續試 */
      }
      if (tries >= 10) {
        clearInterval(timer)
        setAwaitingActivation(false)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [awaitingActivation])

  const hasYearly = plans.some((p) => typeof p.yearlyPrice === 'number' && p.yearlyPrice > 0)

  const subscribe = async (plan: SubscriptionPlanView) => {
    setError('')
    if (!isLoggedIn) {
      window.location.href = '/login?redirect=/account/subscription'
      return
    }
    setProcessingPlan(plan.slug)
    try {
      const cycle =
        billingCycle === 'yearly' && plan.yearlyPrice && plan.yearlyPrice > 0 ? 'yearly' : 'monthly'
      const res = await fetch('/api/subscription/ecpay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planSlug: plan.slug, cycle }),
      })
      const data = (await res.json().catch(() => null)) as
        | { action?: string; params?: Record<string, string>; error?: string }
        | null
      if (!res.ok || !data?.action || !data.params) {
        setError(data?.error || '建立訂閱失敗，請稍後再試')
        setProcessingPlan(null)
        return
      }
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.action
      Object.entries(data.params).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = v
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch {
      setError('建立訂閱失敗，請檢查網路連線後再試')
      setProcessingPlan(null)
    }
  }

  const cancelSubscription = async () => {
    setCancelling(true)
    setError('')
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!res.ok || !data?.ok) {
        setError(data?.error || '取消失敗，請稍後再試')
        setCancelling(false)
        setConfirmCancel(false)
        return
      }
      window.location.replace('/account/subscription')
    } catch {
      setError('取消失敗，請檢查網路連線後再試')
      setCancelling(false)
      setConfirmCancel(false)
    }
  }

  const milestones = current?.milestones?.length
    ? current.milestones
    : plans.find((p) => p.isFeatured && p.milestones.length)?.milestones ||
      plans.find((p) => p.milestones.length)?.milestones ||
      []

  return (
    <main className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">SUBSCRIPTION</p>
        <h1 className="text-2xl font-serif">我的訂閱</h1>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      {awaitingActivation && (
        <div className="bg-gold-500/10 rounded-2xl border border-gold-500/30 p-6 flex items-center gap-3">
          <Loader2 size={20} className="text-gold-500 animate-spin" />
          <div>
            <p className="font-medium">付款完成，訂閱開通中…</p>
            <p className="text-xs text-muted-foreground">
              正在等待綠界付款確認（通常數秒內完成），頁面將自動更新。
            </p>
          </div>
        </div>
      )}

      {/* Current status（真實訂閱狀態） */}
      {current ? (
        <div className="bg-gradient-to-r from-gold-500/10 to-blush-50 rounded-2xl border border-gold-500/30 p-6">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Crown size={24} className="text-gold-500" />
              <div>
                <p className="font-medium">
                  {current.badge ? `${current.badge} ` : ''}
                  {current.planName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {current.billingCycle === 'yearly' ? '年繳' : '月繳'} NT${' '}
                    {current.amount.toLocaleString()}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {current.status === 'cancelled'
                    ? `已取消・權益保留至 ${fmtDate(current.validUntil)}`
                    : `權益有效至 ${fmtDate(current.validUntil)}｜綠界自動續扣`}
                </p>
              </div>
            </div>
            {current.status === 'active' &&
              (confirmCancel ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">確定取消？後續不再扣款</span>
                  <button
                    onClick={cancelSubscription}
                    disabled={cancelling}
                    className="px-3 py-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {cancelling ? '處理中…' : '確定取消'}
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    disabled={cancelling}
                    className="px-3 py-1.5 rounded-full border border-cream-300 hover:bg-cream-100"
                  >
                    保留訂閱
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  取消訂閱
                </button>
              ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: '每月購物金',
                value: current.benefits.monthlyCredit > 0 ? `NT$ ${current.benefits.monthlyCredit}` : '—',
              },
              {
                label: '點數倍率',
                value: current.benefits.pointsMultiplier > 1 ? `${current.benefits.pointsMultiplier}x` : '1x',
              },
              {
                label: '全站折扣',
                value: current.benefits.discountPercent > 0 ? `${current.benefits.discountPercent}%` : '—',
              },
              { label: '連續訂閱', value: `${current.streakMonths} 個月` },
            ].map((s) => (
              <div key={s.label} className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-medium text-gold-600">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !awaitingActivation && (
          <div className="bg-cream-100 rounded-2xl border border-cream-200 p-6 text-center">
            <Sparkles size={32} className="mx-auto mb-3 text-gold-500" />
            <h2 className="font-serif text-lg mb-2">升級為訂閱會員</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              訂閱即享全站折扣、每月購物金、雙倍點數與更多驚喜好禮！
              以綠界信用卡定期定額自動續訂，可隨時取消。
            </p>
          </div>
        )
      )}

      {/* Billing toggle — 只有任一方案有年繳、且尚未訂閱時可切換 */}
      {hasYearly && !current && (
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
            </button>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className={`grid gap-6 ${plans.length >= 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-md mx-auto'}`}>
        {plans.map((plan) => {
          const hasPlanYearly = typeof plan.yearlyPrice === 'number' && plan.yearlyPrice > 0
          const effectiveCycle = billingCycle === 'yearly' && !hasPlanYearly ? 'monthly' : billingCycle
          const displayPrice =
            effectiveCycle === 'monthly'
              ? plan.monthlyPrice
              : Math.round((plan.yearlyPrice as number) / 12)
          const yearlyTotal =
            hasPlanYearly && effectiveCycle === 'yearly' ? plan.yearlyPrice! : null
          const yearlySaved =
            hasPlanYearly && effectiveCycle === 'yearly'
              ? plan.monthlyPrice * 12 - (plan.yearlyPrice as number)
              : null
          const isCurrent = current?.planSlug === plan.slug
          const isProcessing = processingPlan === plan.slug

          return (
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
                {plan.badge && <span className="text-3xl">{plan.badge}</span>}
                <h3 className="text-lg font-serif mt-2">{plan.name}</h3>
                <div className="mt-3">
                  <span className="text-3xl font-medium text-gold-600">NT$ {displayPrice}</span>
                  <span className="text-sm text-muted-foreground">/月</span>
                </div>
                {yearlyTotal != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    年繳 NT$ {yearlyTotal}
                    {yearlySaved && yearlySaved > 0 ? `（省 NT$ ${yearlySaved}）` : ''}
                  </p>
                )}
              </div>

              {plan.featureList.length > 0 && (
                <div className="space-y-3 mb-6">
                  {plan.featureList.map((b, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-sm ${
                        b.highlight ? 'font-medium text-gold-600' : 'text-foreground/80'
                      }`}
                    >
                      {b.icon && <span>{b.icon}</span>}
                      <span>{b.text}</span>
                      {b.highlight && <Star size={12} className="text-gold-400 ml-auto" />}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => subscribe(plan)}
                disabled={Boolean(current) || isProcessing}
                className={`w-full py-3 rounded-xl text-sm tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.isFeatured
                    ? 'bg-gold-500 text-white hover:bg-gold-600'
                    : 'bg-foreground text-cream-50 hover:bg-foreground/90'
                }`}
              >
                {isCurrent
                  ? '目前方案'
                  : current
                    ? '已有訂閱中方案'
                    : isProcessing
                      ? '前往付款中…'
                      : isLoggedIn
                        ? '立即訂閱'
                        : '登入後訂閱'}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* 連續訂閱里程碑（讀方案 dopamine.streakMilestones） */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={18} className="text-gold-500" />
            <h3 className="font-medium">連續訂閱里程碑</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {milestones.map((m, i) => {
              const icons = [Gift, Crown, Sparkles, Star]
              const Icon = icons[i % icons.length]
              const reached = (current?.streakMonths || 0) >= m.months
              return (
                <div
                  key={`${m.months}-${i}`}
                  className={`text-center p-4 rounded-xl border ${
                    reached
                      ? 'bg-gold-500/10 border-gold-500/40'
                      : 'bg-cream-50 border-cream-200'
                  }`}
                >
                  <Icon size={20} className="mx-auto mb-2 text-gold-500" />
                  <p className="text-xs text-muted-foreground">連續 {m.months} 個月</p>
                  <p className="text-xs font-medium mt-1">
                    {m.reward || `贈 NT$${m.creditAmount} 購物金`}
                  </p>
                  {reached && <p className="text-[10px] text-gold-600 mt-1">已達成 ✓</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-3">
        <h3 className="font-medium mb-4">常見問題</h3>
        {[
          {
            q: '訂閱如何扣款？',
            a: '透過綠界科技信用卡定期定額自動扣款：月繳每月、年繳每年自動續訂，扣款成功會寄送收據 Email。',
          },
          {
            q: '訂閱後可以隨時取消嗎？',
            a: '可以！取消後綠界即停止後續扣款，已付費期間的權益仍然有效直到到期日。',
          },
          {
            q: '購物金什麼時候發放？',
            a: '每期扣款成功後自動發放到您的購物金錢包（年繳一次發放 12 個月份額），可在「我的錢包」查看。',
          },
        ].map((faq, i) => (
          <details key={i} className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 text-sm font-medium border-b border-cream-200">
              {faq.q}
              <ChevronRight
                size={14}
                className="text-muted-foreground group-open:rotate-90 transition-transform"
              />
            </summary>
            <p className="text-sm text-muted-foreground py-3 leading-relaxed">{faq.a}</p>
          </details>
        ))}
      </div>
    </main>
  )
}
