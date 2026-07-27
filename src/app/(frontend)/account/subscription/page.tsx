import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Sparkles } from 'lucide-react'
import SubscriptionClient, {
  type SubscriptionPlanView,
  type CurrentSubscriptionView,
} from './SubscriptionClient'

export const metadata: Metadata = {
  title: '我的訂閱',
  description: 'CHIC KIM & MIU 訂閱會員方案，享受全站折扣、每月購物金、專屬抽獎與驚喜好禮。',
}

export const dynamic = 'force-dynamic'

/**
 * 訂閱頁（綠界定期定額版）
 *   1. 讀 subscription-plans（isActive、sortOrder）
 *   2. 讀登入者生效/已取消訂閱 → CurrentSubscriptionView（真實狀態卡）
 *   3. 訂閱/取消互動在 SubscriptionClient（POST /api/subscription/*）
 */

type RawPlan = {
  id: number | string
  slug?: string
  name?: string
  badge?: string | null
  isFeatured?: boolean | null
  pricing?: { monthlyPrice?: number | null; yearlyPrice?: number | null } | null
  benefits?: {
    discountPercent?: number | null
    pointsMultiplier?: number | null
    freeShippingThreshold?: number | null
    monthlyCredit?: number | null
  } | null
  dopamine?: {
    streakMilestones?: { months?: number | null; reward?: string | null; creditAmount?: number | null }[] | null
  } | null
  featureList?: { icon?: string | null; text?: string | null; highlight?: boolean | null }[] | null
}

function toPlanView(d: RawPlan): SubscriptionPlanView | null {
  const monthly = d.pricing?.monthlyPrice
  if (typeof monthly !== 'number' || monthly <= 0) return null
  return {
    id: String(d.id),
    slug: d.slug || String(d.id),
    name: d.name || '',
    badge: d.badge || undefined,
    isFeatured: Boolean(d.isFeatured),
    monthlyPrice: monthly,
    yearlyPrice:
      typeof d.pricing?.yearlyPrice === 'number' && d.pricing.yearlyPrice > 0
        ? d.pricing.yearlyPrice
        : null,
    benefits: {
      discountPercent: Number(d.benefits?.discountPercent) || 0,
      pointsMultiplier: Number(d.benefits?.pointsMultiplier) || 1,
      freeShippingThreshold:
        d.benefits?.freeShippingThreshold === null || d.benefits?.freeShippingThreshold === undefined
          ? null
          : Number(d.benefits.freeShippingThreshold),
      monthlyCredit: Number(d.benefits?.monthlyCredit) || 0,
    },
    milestones: (d.dopamine?.streakMilestones || [])
      .map((m) => ({
        months: Number(m.months) || 0,
        reward: m.reward || '',
        creditAmount: Number(m.creditAmount) || 0,
      }))
      .filter((m) => m.months > 0 && (m.reward || m.creditAmount > 0)),
    featureList: (d.featureList || [])
      .map((f) => ({ icon: f.icon || undefined, text: f.text || '', highlight: Boolean(f.highlight) }))
      .filter((f) => f.text),
  }
}

export default async function SubscriptionPage() {
  let plans: SubscriptionPlanView[] = []
  let current: CurrentSubscriptionView | null = null
  let isLoggedIn = false

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const headersList = await headers()
      const [plansResult, authResult] = await Promise.all([
        payload.find({
          collection: 'subscription-plans',
          where: { isActive: { equals: true } },
          sort: 'sortOrder',
          limit: 20,
          depth: 0,
        }),
        payload.auth({ headers: headersList }),
      ])
      plans = (plansResult.docs as unknown as RawPlan[])
        .map(toPlanView)
        .filter((p): p is SubscriptionPlanView => p !== null)

      const user = authResult.user as unknown as Record<string, unknown> | null
      isLoggedIn = Boolean(user)
      if (user) {
        const subResult = await payload.find({
          collection: 'user-subscriptions',
          where: {
            user: { equals: user.id as string | number },
            status: { in: ['active', 'cancelled'] },
          },
          sort: '-createdAt',
          limit: 1,
          depth: 0,
        })
        const sub = subResult.docs[0] as unknown as
          | {
              id: number | string
              plan: number | string | { id: number | string }
              status: string
              billingCycle: 'monthly' | 'yearly'
              amount: number
              currentPeriodEnd?: string | null
              streakMonths?: number | null
            }
          | undefined
        if (sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() > Date.now()) {
          const planId = typeof sub.plan === 'object' ? sub.plan.id : sub.plan
          const planView = plans.find((p) => p.id === String(planId))
          current = {
            planSlug: planView?.slug || String(planId),
            planName: planView?.name || '訂閱方案',
            badge: planView?.badge,
            status: sub.status === 'cancelled' ? 'cancelled' : 'active',
            billingCycle: sub.billingCycle,
            amount: sub.amount,
            validUntil: sub.currentPeriodEnd,
            streakMonths: Number(sub.streakMonths) || 0,
            benefits: planView?.benefits || {
              discountPercent: 0,
              pointsMultiplier: 1,
              freeShippingThreshold: null,
              monthlyCredit: 0,
            },
            milestones: planView?.milestones || [],
          }
        }
      }
    } catch (err) {
      console.error('[subscription page] 讀取失敗:', err)
    }
  }

  if (plans.length === 0 && !current) {
    return (
      <main className="space-y-8">
        <div>
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">SUBSCRIPTION</p>
          <h1 className="text-2xl font-serif">我的訂閱</h1>
        </div>
        <div className="bg-cream-100 rounded-2xl border border-cream-200 p-10 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-gold-500" />
          <h2 className="font-serif text-lg mb-2">目前暫無訂閱方案</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            方案正在整理中，敬請期待。管理員可於後台「會員管理 → 訂閱方案」建立方案。
          </p>
        </div>
      </main>
    )
  }

  return <SubscriptionClient plans={plans} current={current} isLoggedIn={isLoggedIn} />
}
