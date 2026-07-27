import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'
import { syncUserMembership, type SubDoc } from '@/lib/subscription/activate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * /api/cron/expire-subscriptions — 訂閱到期收斂（每日一次即可）。
 *
 * 權益 gating 本身走 membership.validUntil 比對（getActiveMembership），
 * 不依賴本 cron；這裡只做觀測性收斂：
 *   active/cancelled 且 currentPeriodEnd < now-3d → status=expired +
 *   清空該 user 的 membership.* 快照（若快照仍指向這筆）。
 * 3 天緩衝避免和綠界排程授權的時序競賽（授權成功會把 periodEnd 推走）。
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const payload = await getPayload({ config })
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const found = await payload.find({
    collection: 'user-subscriptions',
    where: {
      status: { in: ['active', 'cancelled'] },
      currentPeriodEnd: { less_than: cutoff },
    },
    limit: 200,
    depth: 0,
  })

  let expired = 0
  for (const doc of found.docs as unknown as SubDoc[]) {
    try {
      await payload.update({
        collection: 'user-subscriptions',
        id: doc.id,
        data: { status: 'expired' } as never,
        overrideAccess: true,
      })
      const userId = typeof doc.user === 'object' ? doc.user.id : doc.user
      const u = (await payload.findByID({ collection: 'users', id: userId, depth: 0 })) as unknown as {
        membership?: { activeSubscription?: number | string | { id: number | string } | null }
      }
      const activeSubId = u.membership?.activeSubscription
      const pointsTo = typeof activeSubId === 'object' && activeSubId ? activeSubId.id : activeSubId
      if (String(pointsTo) === String(doc.id)) {
        await syncUserMembership(payload, userId, null)
      }
      expired++
    } catch (err) {
      console.error(`[expire-subscriptions] sub=${doc.id} 收斂失敗:`, err)
    }
  }

  payload.logger.info(`[expire-subscriptions] 掃描 ${found.totalDocs} 筆，收斂 ${expired} 筆`)
  return NextResponse.json({ scanned: found.totalDocs, expired })
}
