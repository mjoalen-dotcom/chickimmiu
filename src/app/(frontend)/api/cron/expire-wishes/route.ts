import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { expireOpenWishes } from '@/lib/games/socialGameActions'

/**
 * POST /api/cron/expire-wishes
 * 掃描穿搭許願池中「已過期但仍開放」的願望，退還 seeker 預扣的 bountyPoints 並標 expired。
 * 由 prod crontab（outage fallback）/ GitHub Actions 每日觸發。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail
  try {
    const result = await expireOpenWishes()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[cron/expire-wishes] error:', e)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
