import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { verifyCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type LooseRecord = Record<string, unknown>

/**
 * /api/cron/streak-decay
 *
 * 找 consecutiveCheckIns > 0 且 lastCheckInDate 早於 (TPE 今天 - 1) 的 user，
 * 把 consecutiveCheckIns 重設為 0。
 *
 * 時區注意：gameEngine.ts getTpeDateString() 已建立 TPE YYYY-MM-DD 慣例。
 * 本 cron 固定每日 16:00 UTC（= TPE 00:00）跑，判定「昨天還沒簽到」= 連續斷掉。
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const payload = await getPayload({ config })

  // 以 TPE (UTC+8) 計算「昨天」的日期字串。gameEngine 存的是 YYYY-MM-DD 格式。
  const todayTpe = getTpeDateString(new Date())
  const yesterdayTpe = getTpeDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))

  let processed = 0
  let reset = 0
  const errors: Array<{ userId: string; error: string }> = []

  const PAGE = 50
  let page = 1
  let hasMore = true

  while (hasMore) {
    const result = await payload.find({
      collection: 'users',
      where: { consecutiveCheckIns: { greater_than: 0 } } satisfies Where,
      limit: PAGE,
      page,
      depth: 0,
      sort: 'createdAt',
    })

    for (const u of result.docs) {
      processed++
      const userData = u as unknown as LooseRecord
      const userId = typeof userData.id === 'string' ? userData.id : String(userData.id)
      const last = (userData.lastCheckInDate as string) || ''

      // 今天 / 昨天簽到過都算連續；其他一律斷
      if (last === todayTpe || last === yesterdayTpe) continue

      try {
        await (payload.update as Function)({
          collection: 'users',
          id: userId,
          data: { consecutiveCheckIns: 0 } as unknown as Record<string, unknown>,
        })
        reset++
      } catch (err) {
        errors.push({
          userId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    hasMore = result.hasNextPage ?? false
    page++
    if (page > 200) break
  }

  return NextResponse.json({
    ok: true,
    todayTpe,
    yesterdayTpe,
    processed,
    reset,
    errors: errors.slice(0, 20),
    duration_ms: Date.now() - started,
  })
}

/**
 * 轉換 UTC Date 為 Asia/Taipei (UTC+8) 的 YYYY-MM-DD 字串。
 * 與 src/lib/games/gameEngine.ts getTpeDateString 行為一致（不 import 避免耦合 server action 檔）。
 */
function getTpeDateString(d: Date): string {
  const utcMs = d.getTime()
  const tpeMs = utcMs + 8 * 60 * 60 * 1000
  const tpe = new Date(tpeMs)
  const y = tpe.getUTCFullYear()
  const m = String(tpe.getUTCMonth() + 1).padStart(2, '0')
  const day = String(tpe.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
