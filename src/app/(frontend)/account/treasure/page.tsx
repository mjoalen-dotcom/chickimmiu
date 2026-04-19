import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import TreasureClient, { type RewardRow } from './TreasureClient'

export const metadata: Metadata = {
  title: '我的寶物箱',
  description: '查詢遊樂場所抽到的所有獎項：免運券、電影券、優惠券、徽章等。',
  robots: { index: false, follow: false },
}

/**
 * PR-B — 我的寶物箱升級版
 * ───────────────────────
 * 由 `user-rewards` collection 拉當前會員的獎項（PR-A 建立的庫存表），
 * 取代原本直接讀 `mini-game-records` 的做法；狀態機 unused / pending_attach /
 * shipped / consumed / expired 在 UI 上呈現，過期項目灰階顯示、有兌換碼時
 * 提供複製 + 標記已使用按鈕。
 *
 * PR-C 會補上 checkout 自動 attach + Orders.gifts array。
 * Ref: docs/session-prompts/15-treasure-redemption-spec.md
 */

type RewardDoc = {
  id: number
  rewardType: RewardRow['rewardType']
  displayName: string
  amount?: number | null
  couponCode?: string | null
  redemptionInstructions?: string | null
  state: RewardRow['state']
  expiresAt: string
  requiresPhysicalShipping?: boolean | null
  createdAt: string
}

// 狀態排序：可操作優先，然後歷史紀錄，過期殿後
const STATE_PRIORITY: Record<RewardRow['state'], number> = {
  unused: 0,
  pending_attach: 1,
  shipped: 2,
  consumed: 3,
  expired: 4,
}

export default async function TreasurePage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/account/treasure')

  const result = await payload.find({
    collection: 'user-rewards',
    where: { user: { equals: user.id } },
    sort: '-createdAt',
    limit: 200,
    depth: 0,
  })

  const rewards: RewardRow[] = (result.docs as unknown as RewardDoc[])
    .map((d) => ({
      id: Number(d.id),
      rewardType: d.rewardType,
      displayName: String(d.displayName ?? ''),
      amount: d.amount ?? null,
      couponCode: d.couponCode ?? null,
      redemptionInstructions: d.redemptionInstructions ?? null,
      state: d.state,
      expiresAt: String(d.expiresAt ?? ''),
      requiresPhysicalShipping: Boolean(d.requiresPhysicalShipping),
      createdAt: String(d.createdAt ?? ''),
    }))
    .sort((a, b) => {
      const sa = STATE_PRIORITY[a.state] ?? 99
      const sb = STATE_PRIORITY[b.state] ?? 99
      if (sa !== sb) return sa - sb
      return b.createdAt.localeCompare(a.createdAt)
    })

  // summary 只算可用（unused / pending_attach）的獎項，提供 at-a-glance 指標
  const summary = rewards
    .filter((r) => r.state === 'unused' || r.state === 'pending_attach')
    .reduce<Record<string, { count: number; total: number }>>((acc, r) => {
      if (!acc[r.rewardType]) acc[r.rewardType] = { count: 0, total: 0 }
      acc[r.rewardType].count += 1
      acc[r.rewardType].total += r.amount ?? 0
      return acc
    }, {})

  return <TreasureClient rewards={rewards} summary={summary} />
}
