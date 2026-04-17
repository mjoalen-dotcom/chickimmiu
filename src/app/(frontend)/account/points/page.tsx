import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import PointsClient, {
  type TierLite, type ShopItemLite, type HistoryItem, type UserLite,
  type TestimonialItem,
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

/**
 * Phase 5.5.4 — FIFO 到期點數計算
 *
 * 規則（2026-04-17 user confirmed）：
 *   - 點數有效期從 createdAt + pointsExpiryDays 推導（忽略 PointsTransactions.expiresAt 欄位）
 *   - 正數 amount（earn / positive admin_adjust）= 新 batch 入池
 *   - 負數 amount（redeem / expire / refund_deduct / negative admin_adjust）= 從最舊 batch FIFO 扣除
 *   - 已過期的 batch（createdAt + validity < now）視為非活躍
 *   - 「即將到期」= 剩餘 batches 中，到期時間落在 now + windowDays 內的總和
 *   - expiringDays = 最早會過期的那批距今天數
 */
type FifoTxn = { amount: number; createdAt: string | null | undefined }

function computeExpiringPoints(
  txns: FifoTxn[],
  validityDays: number,
  windowDays: number,
): { expiringPoints: number; expiringDays: number } {
  if (validityDays <= 0 || windowDays <= 0 || txns.length === 0) {
    return { expiringPoints: 0, expiringDays: 0 }
  }
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  const validityMs = validityDays * MS_PER_DAY
  const windowCutoffMs = now + windowDays * MS_PER_DAY

  const sorted = [...txns]
    .filter((t) => t.createdAt && t.amount !== 0)
    .sort((a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime())

  const batches: { createdAtMs: number; remaining: number }[] = []
  for (const t of sorted) {
    const ts = new Date(t.createdAt as string).getTime()
    if (t.amount > 0) {
      batches.push({ createdAtMs: ts, remaining: t.amount })
    } else {
      let toConsume = -t.amount
      for (const b of batches) {
        if (toConsume <= 0) break
        if (b.remaining <= 0) continue
        const take = Math.min(b.remaining, toConsume)
        b.remaining -= take
        toConsume -= take
      }
    }
  }

  // 活躍 batches（尚未實際過期 + 還有餘額）
  const live = batches.filter((b) => b.remaining > 0 && b.createdAtMs + validityMs > now)
  // 落在 warning window 內的 batches
  const expiring = live.filter((b) => b.createdAtMs + validityMs <= windowCutoffMs)
  if (expiring.length === 0) return { expiringPoints: 0, expiringDays: 0 }

  const earliest = expiring.reduce((min, b) => (b.createdAtMs < min.createdAtMs ? b : min))
  const msUntilExpiry = earliest.createdAtMs + validityMs - now
  const expiringDays = Math.max(0, Math.ceil(msUntilExpiry / MS_PER_DAY))
  const expiringPoints = expiring.reduce((sum, b) => sum + b.remaining, 0)

  return { expiringPoints, expiringDays }
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

  // Phase 5.5.4 — 拉 FIFO 計算用的全量 txns
  // 為避免對 500+ txns 會員過度拉取，用 createdAt >= now-2×validityDays 的 filter。
  // validityDays 要從 LoyaltySettings 讀，但 Promise.all 當下還沒拿到，用 730 天保險餘量（>2 × 365 default）。
  const fifoCutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()

  const [loyaltyRaw, redemptionRaw, tiersResult, itemsResult, historyResult, fifoResult] =
    await Promise.all([
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
      payload.find({
        collection: 'points-transactions',
        where: {
          and: [
            { user: { equals: sessionUser.id } },
            { createdAt: { greater_than_equal: fifoCutoff } },
          ],
        },
        sort: 'createdAt',
        pagination: false,
        depth: 0,
      }),
    ])

  const gender = (user.gender as string | null) ?? null
  // redemptionRaw 型別 (PointRedemptionSetting) 有具名 fields，TS 不認為它能 assign 成
  // LooseRecord (index signature)。透過 unknown 中介完成 widen → 仍在 type-check 之下。
  const redemption = redemptionRaw as unknown as LooseRecord
  const loyalty = loyaltyRaw as unknown as LooseRecord
  const scarcity = redemption?.scarcity as LooseRecord | undefined
  const lowStockThreshold = (scarcity?.lowStockThreshold as number) ?? 10
  const hotBadgeThreshold = (scarcity?.hotBadgeThreshold as number) ?? 50

  // Phase 5.5.4 — 到期點數計算參數
  // validityDays 從 LoyaltySettings.pointsConfig.pointsExpiryDays (0=永不過期, default 365)
  // windowDays 從 PointRedemptionSettings.expiryNotification.reminderDays[].days 取最大 (default 30)
  const pointsConfig = loyalty?.pointsConfig as LooseRecord | undefined
  const validityDays = (pointsConfig?.pointsExpiryDays as number) ?? 365
  const expiryNotification = redemption?.expiryNotification as LooseRecord | undefined
  const expiryEnabled = (expiryNotification?.enabled as boolean) ?? true
  const showCountdown = (expiryNotification?.showCountdown as boolean) ?? true
  const reminderDaysArr = (expiryNotification?.reminderDays as LooseRecord[] | undefined) ?? []
  const reminderMax = reminderDaysArr.reduce((max, r) => {
    const d = (r.days as number) ?? 0
    return d > max ? d : max
  }, 0)
  const windowDays = reminderMax > 0 ? reminderMax : 30

  const fifoTxns: FifoTxn[] = (fifoResult.docs as unknown as LooseRecord[]).map((h) => ({
    amount: (h.amount as number) ?? 0,
    createdAt: (h.createdAt as string) ?? null,
  }))
  const { expiringPoints, expiringDays } =
    expiryEnabled && showCountdown
      ? computeExpiringPoints(fifoTxns, validityDays, windowDays)
      : { expiringPoints: 0, expiringDays: 0 }

  // Phase 5.5.3 — UGC 見證從 settings 讀取（留空時前端會 fallback 到預設範例）
  const ugcGroup = redemption?.ugcTestimonials as LooseRecord | undefined
  const ugcEnabled = (ugcGroup?.enabled as boolean) ?? true
  const ugcMaxDisplay = (ugcGroup?.maxDisplay as number) ?? 6
  const ugcItems = (ugcGroup?.items as LooseRecord[] | undefined) ?? []
  const testimonials: TestimonialItem[] = ugcEnabled
    ? ugcItems.slice(0, ugcMaxDisplay).map((it) => ({
        name: (it.name as string) ?? '',
        text: (it.text as string) ?? '',
        avatar: (it.avatar as string) ?? '🎁',
        tier: (it.tier as string) ?? '',
      }))
    : []

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
    // Phase 5.5.4 — 真正的 FIFO 計算（取代 Phase 5.5 的硬寫 0）
    expiringPoints,
    expiringDays,
  }

  return (
    <PointsClient
      tiers={tiers}
      shopItems={shopItems}
      history={history}
      user={userProfile}
      testimonials={testimonials}
    />
  )
}
