import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { settleExpiredRooms } from '@/lib/games/socialGameActions'

/**
 * POST /api/cron/settle-style-rooms
 * 結算過期的穿搭社交房：active/voting → 依得票結算發獎；waiting → 標過期。
 * 由 prod crontab（outage fallback）/ GitHub Actions 每日觸發。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail
  try {
    const result = await settleExpiredRooms()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[cron/settle-style-rooms] error:', e)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
