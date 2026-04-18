import { NextResponse } from 'next/server'

import { verifyCronAuth } from '@/lib/cron/auth'
import { runDailySegmentation } from '@/lib/crm/segmentationEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 分群計算對每個 user 都要跑多個 find，大戶可能會慢。給足 5 分鐘。
export const maxDuration = 300

/**
 * /api/cron/segments
 *
 * 遍歷所有 users 重算 MemberSegment（10 大分群）。
 * 演算法細節見 src/lib/crm/segmentationEngine.ts runDailySegmentation。
 * 每 50 人一頁分批，單一會員計算失敗不中斷整批。
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  try {
    const result = await runDailySegmentation()
    return NextResponse.json({
      ok: true,
      processed: result.processed,
      changed: result.changed,
      distribution: result.distribution,
      duration_ms: Date.now() - started,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/segments] failed:', err)
    return NextResponse.json(
      { ok: false, error: message, duration_ms: Date.now() - started },
      { status: 500 },
    )
  }
}
