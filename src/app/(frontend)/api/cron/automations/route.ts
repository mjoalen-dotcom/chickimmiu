import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { verifyCronAuth } from '@/lib/cron/auth'
import { triggerJourney } from '@/lib/crm/automationEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LooseRecord = Record<string, unknown>

/**
 * /api/cron/automations
 *
 * 掃 `automation-journeys` where isActive=true AND triggerType IN ['schedule','condition']，
 * 依據 triggerEvent 判斷受眾並觸發旅程。event-type 旅程（user_registered 等）由 app hook 觸發，
 * 不在此 cron 範圍。
 *
 * 發信動作在 email adapter 未接通前只 console.log（automationEngine.executeStep），
 * 整個 cron 不會因為發信失敗而爆掉。
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const payload = await getPayload({ config })

  // 受眾掃描上限，避免失控
  const USER_SCAN_LIMIT = 500

  const journeysResult = await payload.find({
    collection: 'automation-journeys',
    where: {
      and: [
        { isActive: { equals: true } },
        { triggerType: { in: ['schedule', 'condition'] } },
      ],
    } satisfies Where,
    limit: 100,
    depth: 0,
  })

  let processed = 0
  let skipped = 0
  let triggered = 0
  const errors: Array<{ journey: string; error: string }> = []

  for (const raw of journeysResult.docs) {
    const journey = raw as unknown as LooseRecord
    const slug = String(journey.slug ?? '')
    const event = String(journey.triggerEvent ?? '')

    try {
      const userIds = await resolveTargetUserIds(payload, event, USER_SCAN_LIMIT)
      if (userIds === null) {
        // event 在此 cron 不處理（由 app hook 觸發）
        skipped++
        continue
      }
      processed++

      for (const uid of userIds) {
        try {
          await triggerJourney(slug, { userId: uid, event, data: { source: 'cron' } })
          triggered++
        } catch (err) {
          errors.push({ journey: slug, error: err instanceof Error ? err.message : String(err) })
        }
      }
    } catch (err) {
      errors.push({ journey: slug, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    ok: true,
    journeys_total: journeysResult.docs.length,
    processed,
    skipped,
    triggered,
    errors: errors.slice(0, 20),
    duration_ms: Date.now() - started,
  })
}

/**
 * 依據 triggerEvent 回傳要觸發旅程的 userIds。
 * 回傳 null 表示這個 event 不在 cron 範圍（應由 app hook 觸發）。
 */
async function resolveTargetUserIds(
  payload: Awaited<ReturnType<typeof getPayload>>,
  event: string,
  limit: number,
): Promise<string[] | null> {
  // 事件型：由 app hook 觸發，cron 略過
  const eventOnly = new Set([
    'user_registered',
    'first_purchase',
    'order_placed',
    'cart_abandoned',
    'tier_upgraded',
    'new_product_launch',
    'credit_score_changed',
    'credit_low_60',
    'credit_low_30',
    'consecutive_returns',
    'good_customer',
    'tier_gap_reminder',
  ])
  if (eventOnly.has(event)) return null

  // 沉睡 N 天：最近 N 天未下單（且 createdAt > N 天前）
  const dormantMatch = event.match(/^dormant_(\d+)d$/)
  if (dormantMatch) {
    const days = Number.parseInt(dormantMatch[1] ?? '30', 10)
    return await findDormantUsers(payload, days, limit)
  }

  // 生日月：birthday 月份 = 本月
  if (event === 'birthday_month') {
    return await findBirthdayUsers(payload, limit)
  }

  // 點數即將過期：此 cron 範圍先不掃（由 /api/cron/expire-points 掃，會建 expire tx；
  // 觸發旅程需要另外的「即將過期」邏輯，留 TODO。）
  if (event === 'points_expiring') {
    return []
  }

  // VIP 關懷：tier 屬 gold+
  if (event === 'vip_care') {
    const result = await payload.find({
      collection: 'users',
      where: { tier: { in: ['gold', 'platinum', 'diamond'] } } satisfies Where,
      limit,
      depth: 0,
    })
    return result.docs.map((d) => String((d as unknown as LooseRecord).id))
  }

  // 未知事件：不處理
  return null
}

async function findDormantUsers(
  payload: Awaited<ReturnType<typeof getPayload>>,
  days: number,
  limit: number,
): Promise<string[]> {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - days * MS_PER_DAY).toISOString()

  // 從 orders 聚合 last order per user 難，用簡化策略：
  // 1) 找 createdAt > cutoff 且 status != cancelled 的訂單 → 這些 user 不算沉睡
  // 2) 從 users 掃（createdAt > cutoff + N 天保底避免剛註冊就中）→ 排除 1
  const recentOrders = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { createdAt: { greater_than: cutoff } },
        { status: { not_equals: 'cancelled' } },
      ],
    } satisfies Where,
    limit: 5000,
    depth: 0,
    pagination: false,
  })
  const activeUserIds = new Set<string>()
  for (const o of recentOrders.docs) {
    const c = (o as unknown as LooseRecord).customer
    if (typeof c === 'string' || typeof c === 'number') activeUserIds.add(String(c))
  }

  const registeredBefore = new Date(Date.now() - days * MS_PER_DAY).toISOString()
  const usersResult = await payload.find({
    collection: 'users',
    where: { createdAt: { less_than: registeredBefore } } satisfies Where,
    limit,
    depth: 0,
  })
  return usersResult.docs
    .map((u) => String((u as unknown as LooseRecord).id))
    .filter((id) => !activeUserIds.has(id))
}

async function findBirthdayUsers(
  payload: Awaited<ReturnType<typeof getPayload>>,
  limit: number,
): Promise<string[]> {
  // Payload SQLite 不支援 MONTH(birthday) 這種表達式。
  // 用 createdAt-independent 掃全部然後在 JS 內 filter（生產規模下 users 通常 <10k）。
  const month = new Date().getMonth() + 1
  const result = await payload.find({
    collection: 'users',
    where: { birthday: { exists: true } } satisfies Where,
    limit: 5000,
    depth: 0,
    pagination: false,
  })
  const matches: string[] = []
  for (const u of result.docs) {
    const d = (u as unknown as LooseRecord).birthday
    if (typeof d !== 'string') continue
    const parsed = new Date(d)
    if (Number.isNaN(parsed.getTime())) continue
    if (parsed.getMonth() + 1 === month) {
      matches.push(String((u as unknown as LooseRecord).id))
      if (matches.length >= limit) break
    }
  }
  return matches
}
