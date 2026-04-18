import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { verifyCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type LooseRecord = Record<string, unknown>
type FifoTxn = { id: string | number; amount: number; createdAt: string }

/**
 * /api/cron/expire-points
 *
 * FIFO 規則（與 src/app/(frontend)/account/points/page.tsx computeExpiringPoints 一致）：
 *   - 正數 amount = 新 batch 入池
 *   - 負數 amount = 從最舊 batch FIFO 扣除
 *   - batch 超過 validityDays 即視為過期
 * 每個 user 的活躍過期 batches 總和寫為 type=expire 的 tx，並扣 users.points。
 *
 * validityDays 從 LoyaltySettings.pointsConfig.pointsExpiryDays 讀（0 = 永不過期，cron no-op）。
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const payload = await getPayload({ config })

  const loyalty = (await payload.findGlobal({
    slug: 'loyalty-settings',
    depth: 0,
  })) as unknown as LooseRecord
  const pointsConfig = (loyalty.pointsConfig ?? {}) as LooseRecord
  const validityDays = (pointsConfig.pointsExpiryDays as number) ?? 365

  if (!Number.isFinite(validityDays) || validityDays <= 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'points_expiry_disabled',
      duration_ms: Date.now() - started,
    })
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const nowMs = Date.now()
  const validityMs = validityDays * MS_PER_DAY
  // 只掃 createdAt > now - 2×validityDays 的 txns（舊 batch 應早就 expire 過）
  const fifoCutoff = new Date(nowMs - 2 * validityMs).toISOString()

  let processed = 0
  let usersExpired = 0
  let totalExpired = 0
  const errors: Array<{ userId: string; error: string }> = []

  const PAGE = 50
  let page = 1
  let hasMore = true

  while (hasMore) {
    const usersResult = await payload.find({
      collection: 'users',
      limit: PAGE,
      page,
      depth: 0,
      sort: 'createdAt',
    })

    for (const u of usersResult.docs) {
      processed++
      const userData = u as unknown as LooseRecord
      const userId = typeof userData.id === 'string' ? userData.id : String(userData.id)

      try {
        const txnsResult = await payload.find({
          collection: 'points-transactions',
          where: {
            and: [
              { user: { equals: userId } },
              { createdAt: { greater_than_equal: fifoCutoff } },
            ],
          } satisfies Where,
          sort: 'createdAt',
          pagination: false,
          depth: 0,
        })

        const fifoTxns: FifoTxn[] = (txnsResult.docs as unknown as LooseRecord[])
          .filter((d) => typeof d.createdAt === 'string' && typeof d.amount === 'number')
          .map((d) => ({
            id: (d.id as string | number),
            amount: d.amount as number,
            createdAt: d.createdAt as string,
          }))

        const expired = computeExpiredAmount(fifoTxns, validityMs, nowMs)
        if (expired <= 0) continue

        const currentBalance = (userData.points as number) ?? 0
        const newBalance = Math.max(0, currentBalance - expired)

        await (payload.create as Function)({
          collection: 'points-transactions',
          data: {
            user: userId,
            amount: -expired,
            type: 'expire',
            source: 'points_expiry',
            description: `${validityDays} 天有效期過期（${expired} 點）`,
            balance: newBalance,
          } as unknown as Record<string, unknown>,
        })

        await (payload.update as Function)({
          collection: 'users',
          id: userId,
          data: { points: newBalance } as unknown as Record<string, unknown>,
        })

        usersExpired++
        totalExpired += expired
      } catch (err) {
        errors.push({
          userId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    hasMore = usersResult.hasNextPage ?? false
    page++
    if (page > 200) {
      // 10,000 users 保底（200 × 50），避免意外無限迴圈
      break
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    usersExpired,
    totalExpired,
    validityDays,
    errors: errors.slice(0, 20),
    duration_ms: Date.now() - started,
  })
}

/**
 * FIFO — 計算「已經過期且仍有餘額」的點數總量。
 * 結構與 account/points/page.tsx computeExpiringPoints 相同，但判斷條件改成
 * 「batch.createdAtMs + validityMs <= now」（已過期）。
 */
function computeExpiredAmount(
  txns: FifoTxn[],
  validityMs: number,
  nowMs: number,
): number {
  if (txns.length === 0) return 0

  const sorted = [...txns]
    .filter((t) => t.amount !== 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const batches: { createdAtMs: number; remaining: number }[] = []
  for (const t of sorted) {
    const ts = new Date(t.createdAt).getTime()
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

  const expired = batches.filter(
    (b) => b.remaining > 0 && b.createdAtMs + validityMs <= nowMs,
  )
  return expired.reduce((sum, b) => sum + b.remaining, 0)
}
