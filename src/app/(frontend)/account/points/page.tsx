import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import PointsClient, {
  type TierLite, type ShopItemLite, type HistoryItem, type UserLite,
} from './PointsClient'

export const metadata: Metadata = {
  title: '點數 / 購物金',
  robots: { index: false, follow: false },
}

/**
 * Phase 5.5 Batch B — 前台接通 4 個 data source
 *   1. users (self) — points / shoppingCredit / memberTier (depth 1) / gender
 *   2. membership-tiers — 6 層等級資料
 *   3. points-redemptions — 兌換商品
 *   4. points-transactions (where user=self) — 點數歷史
 *   5. loyalty-settings + point-redemption-settings — 點數規則 + 稀缺性參數
 */

type LooseRecord = Record<string, unknown>

function pickTierName(tier: LooseRecord, gender: string | null): string {
  const male = tier.frontNameMale as string | null | undefined
  if (gender === 'male' && male) return male
  return (tier.frontName as string) ?? (tier.name as string) ?? '—'
}

function computeBadge(
  item: LooseRecord,
  scarcity: { lowStockThreshold: number; hotBadgeThreshold: number },
): string | null {
  const stock = (item.stock as number) ?? 0
  const redeemed = (item.redeemed as number) ?? 0
  const type = item.type as string
  const limits = item.limits as LooseRecord | undefined
  const remaining = stock > 0 ? stock - redeemed : null

  if (remaining !== null && remaining <= scarcity.lowStockThreshold) return '即將售完'
  if (redeemed >= scarcity.hotBadgeThreshold) return '熱門'
  if (type === 'mystery') return '驚喜'
  if (type === 'charity') return '愛心'
  if (type === 'styling') return '專屬'
  if (type === 'experience') return 'VIP'
  if (limits?.subscriberOnly) return 'VIP'
  return null
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

export default async function PointsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/points')

  // Refetch user with depth:1 so memberTier is populated
  const user = (await payload.findByID({
    collection: 'users',
    id: sessionUser.id,
    depth: 1,
  })) as unknown as LooseRecord

  const [loyaltyRaw, redemptionRaw, tiersResult, itemsResult, historyResult] = await Promise.all([
    payload.findGlobal({ slug: 'loyalty-settings', depth: 0 }),
    payload.findGlobal({ slug: 'point-redemption-settings', depth: 0 }),
    payload.find({ collection: 'membership-tiers', sort: 'level', limit: 20, depth: 0 }),
    payload.find({
      collection: 'points-redemptions',
      where: { isActive: { equals: true } },
      sort: 'sortOrder',
      limit: 50,
      depth: 0,
    }),
    payload.find({
      collection: 'points-transactions',
      where: { user: { equals: sessionUser.id } },
      sort: '-createdAt',
      limit: 20,
      depth: 0,
    }),
  ])

  const gender = (user.gender as string | null) ?? null
  // redemptionRaw 型別 (PointRedemptionSetting) 有具名 fields，TS 不認為它能 assign 成
  // LooseRecord (index signature)。透過 unknown 中介完成 widen → 仍在 type-check 之下。
  const scarcity = (redemptionRaw as unknown as LooseRecord)?.scarcity as LooseRecord | undefined
  const lowStockThreshold = (scarcity?.lowStockThreshold as number) ?? 10
  const hotBadgeThreshold = (scarcity?.hotBadgeThreshold as number) ?? 50

  const tiers: TierLite[] = (tiersResult.docs as unknown as LooseRecord[]).map((t) => ({
    id: String(t.id),
    slug: (t.slug as string) ?? '',
    level: (t.level as number) ?? 0,
    displayName: pickTierName(t, gender),
    minSpent: (t.minSpent as number) ?? 0,
    discountPercent: (t.discountPercent as number) ?? 0,
    pointsMultiplier: (t.pointsMultiplier as number) ?? 1,
    freeShippingThreshold: (t.freeShippingThreshold as number) ?? 0,
  }))

  const shopItems: ShopItemLite[] = (itemsResult.docs as unknown as LooseRecord[]).map((it) => ({
    id: String(it.id),
    name: (it.name as string) ?? '',
    type: (it.type as string) ?? 'physical',
    pointsCost: (it.pointsCost as number) ?? 0,
    stock: (it.stock as number) ?? 0,
    redeemed: (it.redeemed as number) ?? 0,
    description: (it.description as string) ?? '',
    badge: computeBadge(it, { lowStockThreshold, hotBadgeThreshold }),
  }))

  const history: HistoryItem[] = (historyResult.docs as unknown as LooseRecord[]).map((h) => {
    const amount = (h.amount as number) ?? 0
    return {
      date: formatDate(h.createdAt),
      desc: (h.description as string) ?? (h.source as string) ?? '—',
      points: amount,
      type: amount >= 0 ? 'earn' : 'spend',
    }
  })

  // Resolve current tier display
  const memberTier = user.memberTier as LooseRecord | null
  const currentTierSlug = memberTier ? ((memberTier.slug as string) ?? '') : 'ordinary'
  const currentTierDisplayName = memberTier
    ? pickTierName(memberTier, gender)
    : tiers[0]?.displayName ?? '會員'
  const currentTierMultiplier = memberTier ? ((memberTier.pointsMultiplier as number) ?? 1) : 1

  const userProfile: UserLite = {
    points: (user.points as number) ?? 0,
    shoppingCredit: (user.shoppingCredit as number) ?? 0,
    currentTierSlug,
    currentTierDisplayName,
    currentTierMultiplier,
    // TODO Phase 5.5: expiringPoints 需要正式 FIFO/LIFO aggregation — 先 0
    expiringPoints: 0,
    expiringDays: 0,
  }

  return (
    <PointsClient
      tiers={tiers}
      shopItems={shopItems}
      history={history}
      user={userProfile}
    />
  )
}
