import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { runDailyBirthdayScheduler } from '@/lib/marketing/birthdayEngine'

/**
 * POST /api/cron/birthday
 * 每日跑生日 5 階段排程（runDailyBirthdayScheduler 自建 payload）。
 * 由 prod crontab（outage fallback）/ GitHub Actions 每日觸發。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail
  try {
    const result = await runDailyBirthdayScheduler()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[cron/birthday] error:', e)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
