import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { verifyCronAuth } from '@/lib/cron/auth'
import { calculateTier, TIER_LEVELS } from '@/lib/crm/tierEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type LooseRecord = Record<string, unknown>

/**
 * /api/cron/annual-tier-reset
 *
 * 每年 1/1 排程：
 *   1. 掃所有 customer 會員，把 `annualSpend` 歸零
 *   2. 依 `lifetimeSpend` + 歸零後的 `annualSpend` 重新計算 `memberTier`
 *      → 歷史累計夠的會員等級不變（calculateTier 用 max）
 *      → 只靠本年度衝到高等級、但 lifetime 不足的會員 **會降等**
 *
 * 升等由 Orders 付款 hook 即時處理，此 cron 不做升等。
 *
 * 觸發方式：外部 cron job 打
 *   POST /api/cron/annual-tier-reset
 *   Authorization: Bearer <CRON_SECRET>
 * 建議每年 1/1 00:05 跑（避開 00:00 各種排程尖峰）
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const payload = await getPayload({ config })

  // 預先把所有 tier slug → id 的對照表撈出來，避免 N+1
  const tiersResult = await payload.find({
    collection: 'membership-tiers',
    limit: 100,
    depth: 0,
  })
  const tierSlugToId = new Map<string, string | number>()
  for (const t of tiersResult.docs) {
    const slug = (t as unknown as LooseRecord).slug
    const id = (t as unknown as LooseRecord).id
    if (typeof slug === 'string' && (typeof id === 'string' || typeof id === 'number')) {
      tierSlugToId.set(slug, id)
    }
  }

  let scanned = 0
  let reset = 0
  let downgraded = 0
  const errors: Array<{ userId: string; error: string }> = []

  // 分頁掃全體 customer。封測規模 <10k，一次掃 500 per page。
  const PAGE_SIZE = 500
  let page = 1
  while (true) {
    const usersResult = await payload.find({
      collection: 'users',
      where: { role: { equals: 'customer' } } satisfies Where,
      limit: PAGE_SIZE,
      page,
      depth: 0,
    })
    if (usersResult.docs.length === 0) break

    for (const raw of usersResult.docs) {
      const u = raw as unknown as LooseRecord
      const userId = u.id as string | number
      scanned++

      try {
        const lifetimeSpend = Number(u.lifetimeSpend ?? 0) || 0
        const annualSpend = Number(u.annualSpend ?? 0) || 0

        // 歸零後用 annual=0 重算
        const newTierSlug = calculateTier(lifetimeSpend, 0)
        const rawOld = u.memberTier
        const oldTierSlug =
          typeof rawOld === 'string'
            ? rawOld
            : ((rawOld as unknown as LooseRecord)?.slug as string) || 'ordinary'
        const oldLevel = TIER_LEVELS[oldTierSlug] ?? 0
        const newLevel = TIER_LEVELS[newTierSlug] ?? 0

        const data: Record<string, unknown> = { annualSpend: 0 }
        if (newLevel < oldLevel) {
          const newTierId = tierSlugToId.get(newTierSlug)
          if (newTierId != null) {
            data.memberTier = newTierId
            downgraded++
          }
        }

        // 只有本來 annualSpend>0 或需要降等才 write
        if (annualSpend > 0 || data.memberTier != null) {
          await (payload.update as Function)({
            collection: 'users',
            id: userId,
            data,
          })
          reset++
        }
      } catch (err) {
        errors.push({
          userId: String(userId),
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (usersResult.docs.length < PAGE_SIZE) break
    page++
  }

  return NextResponse.json({
    ok: true,
    scanned,
    reset,
    downgraded,
    errors: errors.slice(0, 20),
    duration_ms: Date.now() - started,
  })
}
