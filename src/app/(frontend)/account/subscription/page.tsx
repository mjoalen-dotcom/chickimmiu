import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Sparkles } from 'lucide-react'
import SubscriptionClient, { type SubscriptionPlanView } from './SubscriptionClient'

export const metadata: Metadata = {
  title: '我的訂閱',
  description: 'CHIC KIM & MIU 訂閱會員方案，享受全站折扣、每月購物金、專屬抽獎與驚喜好禮。',
}

/**
 * Phase 5.5 N1 — 前台接通 SubscriptionPlans collection
 *   1. 讀 `subscription-plans` collection 取代 hardcoded DEMO_PLANS
 *   2. 過濾 isActive=true、以 sortOrder 排序
 *   3. 空狀態 banner 避免 DB 零方案時畫面空白
 *   4. 互動狀態（billingCycle / currentPlan）移到 SubscriptionClient
 *
 * 對應 collection hooks：SubscriptionPlans afterChange/afterDelete 會
 *   safeRevalidate(['/account/subscription'], ['subscription-plans'])
 */

type RawPlan = {
  id: number | string
  slug?: string
  name?: string
  badge?: string | null
  isFeatured?: boolean | null
  isActive?: boolean | null
  pricing?: {
    monthlyPrice?: number | null
    yearlyPrice?: number | null
  } | null
  featureList?: { icon?: string | null; text?: string | null; highlight?: boolean | null }[] | null
}

async function getSubscriptionPlans(): Promise<SubscriptionPlanView[]> {
  if (!process.env.DATABASE_URI) return []
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'subscription-plans',
      where: { isActive: { equals: true } },
      sort: 'sortOrder',
      limit: 20,
      depth: 0,
    })
    const docs = result.docs as unknown as RawPlan[]
    return docs
      .map((d): SubscriptionPlanView | null => {
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
          featureList: (d.featureList || []).map((f) => ({
            icon: f.icon || undefined,
            text: f.text || '',
            highlight: Boolean(f.highlight),
          })).filter((f) => f.text),
        }
      })
      .filter((p): p is SubscriptionPlanView => p !== null)
  } catch {
    return []
  }
}

export default async function SubscriptionPage() {
  const plans = await getSubscriptionPlans()

  if (plans.length === 0) {
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

  return <SubscriptionClient plans={plans} />
}
