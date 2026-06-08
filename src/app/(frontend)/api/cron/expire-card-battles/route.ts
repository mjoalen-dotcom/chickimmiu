import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { expireStaleRooms } from '@/lib/games/cardBattleEngine'

/**
 * POST /api/cron/expire-card-battles
 * 把超過 24h 仍 waiting 的卡牌對戰房間標記過期（expireStaleRooms 自建 payload）。
 * 由 prod crontab（outage fallback）/ GitHub Actions 每日觸發。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail
  try {
    const expired = await expireStaleRooms()
    return NextResponse.json({ success: true, expired })
  } catch (e) {
    console.error('[cron/expire-card-battles] error:', e)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
