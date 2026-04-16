import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import ReferralsClient, {
  type ReferralSummary, type ReferralHistoryItem, type TierBonusRow, type RewardRules,
} from './ReferralsClient'

export const metadata: Metadata = {
  title: '推薦好友',
  robots: { index: false, follow: false },
}

/**
 * Phase 5.5 Batch C — 前台接通 ReferralSettings + user referral data
 *   1. users (self) — referralCode / memberTier (depth 1) / gender
 *   2. referral-settings — rewards / tierBonus / linkSettings / antiAbuse
 *   3. users (where referredBy=self) — 被推薦名單 + count
 *   4. users (where referredBy=self AND createdAt >= 本月初) — 本月推薦次數 (for monthlyRemaining)
 *   5. membership-tiers (level > 0) — 等級加成表 5 列
 *
 *  簡化（本 Phase 不做）：totalReward 採 completedCount × (signup + purchase) 近似，
 *  未來可改為 SUM(PointsTransactions where source=referral AND user=self)。
 */

type LooseRecord = Record<string, unknown>

function pickTierName(tier: LooseRecord, gender: string | null): string {
  const male = tier.frontNameMale as string | null | undefined
  if (gender === 'male' && male) return male
  return (tier.frontName as string) ?? (tier.name as string) ?? '—'
}

function maskName(name: string): string {
  if (!name) return '—'
  return `${name.charAt(0)}**`
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

function getTierMultiplier(tierBonus: LooseRecord | undefined, slug: string): number {
  if (!tierBonus || !slug) return 1
  const key = `${slug}Multiplier`
  return (tierBonus[key] as number) ?? 1
}

export default async function ReferralsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/referrals')

  const user = (await payload.findByID({
    collection: 'users',
    id: sessionUser.id,
    depth: 1,
  })) as unknown as LooseRecord

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)

  const [settingsRaw, tiersResult, referredResult, referredThisMonth] = await Promise.all([
    payload.findGlobal({ slug: 'referral-settings', depth: 0 }),
    payload.find({
      collection: 'membership-tiers',
      where: { level: { greater_than: 0 } },
      sort: 'level',
      limit: 20,
      depth: 0,
    }),
    payload.find({
      collection: 'users',
      where: { referredBy: { equals: sessionUser.id } },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
    }),
    payload.find({
      collection: 'users',
      where: {
        and: [
          { referredBy: { equals: sessionUser.id } },
          { createdAt: { greater_than_equal: thisMonthStart.toISOString() } },
        ],
      },
      limit: 0,
      depth: 0,
    }),
  ])

  const settings = settingsRaw as LooseRecord
  const rewardsCfg = (settings?.rewards as LooseRecord) ?? {}
  const tierBonus = (settings?.tierBonus as LooseRecord) ?? {}
  const linkSettings = (settings?.linkSettings as LooseRecord) ?? {}
  const antiAbuse = (settings?.antiAbuse as LooseRecord) ?? {}

  const gender = (user.gender as string | null) ?? null
  const memberTier = user.memberTier as LooseRecord | null
  const tierSlug = memberTier ? ((memberTier.slug as string) ?? 'ordinary') : 'ordinary'
  const tierDisplayName = memberTier ? pickTierName(memberTier, gender) : '—'
  const multiplier = getTierMultiplier(tierBonus, tierSlug)

  const referredList = referredResult.docs as unknown as LooseRecord[]
  const totalReferred = referredResult.totalDocs

  const referrerSignup = (rewardsCfg.referrerSignupReward as number) ?? 50
  const referrerPurchase = (rewardsCfg.referrerPurchaseReward as number) ?? 100

  const history: ReferralHistoryItem[] = referredList.slice(0, 20).map((u) => {
    const orderCount = (u.orderCount as number) ?? 0
    const status: 'completed' | 'pending' = orderCount > 0 ? 'completed' : 'pending'
    const reward = status === 'completed' ? referrerSignup + referrerPurchase : 0
    return {
      id: String(u.id),
      name: maskName((u.name as string) ?? ''),
      date: formatDate(u.createdAt),
      status,
      reward,
      event: status === 'completed' ? '首消達標' : '待首消',
    }
  })

  const completedCount = history.filter((h) => h.status === 'completed').length
  const totalReward = completedCount * (referrerSignup + referrerPurchase)

  const monthlyLimit = (antiAbuse.monthlyReferralLimit as number) ?? 50
  const monthlyRemaining = Math.max(0, monthlyLimit - referredThisMonth.totalDocs)

  const summary: ReferralSummary = {
    code: (user.referralCode as string) ?? '',
    linkPrefix: (linkSettings.linkPrefix as string) ?? '/ref/',
    tierSlug,
    tierDisplayName,
    multiplier,
    totalReferred,
    totalReward,
    monthlyRemaining,
    monthlyLimit,
  }

  const tierBonuses: TierBonusRow[] = (tiersResult.docs as unknown as LooseRecord[]).map((t) => {
    const slug = (t.slug as string) ?? ''
    return {
      slug,
      displayName: pickTierName(t, gender),
      multiplier: getTierMultiplier(tierBonus, slug),
      isCurrent: slug === tierSlug,
    }
  })

  const rewards: RewardRules = {
    enabled: (rewardsCfg.enabled as boolean) ?? true,
    referrerSignup,
    referrerPurchase,
    refereeSignup: (rewardsCfg.refereeSignupReward as number) ?? 30,
    refereePurchase: (rewardsCfg.refereePurchaseReward as number) ?? 50,
    subscriberBonus: (tierBonus.subscriberBonus as number) ?? 20,
    minPurchaseAmount: (rewardsCfg.minPurchaseAmount as number) ?? 500,
  }

  return (
    <ReferralsClient
      summary={summary}
      history={history}
      tierBonuses={tierBonuses}
      rewards={rewards}
    />
  )
}
