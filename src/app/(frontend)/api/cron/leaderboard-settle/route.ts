import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { settleDueLeaderboards } from '@/lib/games/leaderboardSettle'

/**
 * POST /api/cron/leaderboard-settle
 * 發放排行榜每日 / 每週 / 每月前三名額外獎勵（跨週/跨月自動偵測）。
 * 由 prod crontab（outage fallback）/ GitHub Actions 每日 TPE 00:xx 觸發。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail
  try {
    const result = await settleDueLeaderboards()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[cron/leaderboard-settle] error:', e)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
