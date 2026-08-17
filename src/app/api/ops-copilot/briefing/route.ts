/**
 * GET  /api/ops-copilot/briefing        產生營運日報（會建立 pending 提案）
 * GET  /api/ops-copilot/briefing?dry=1  只掃描不寫入（純預覽，不建提案）
 *
 * 只給 admin。掃描本身可能跑幾秒（要掃訂單算銷速），前端要顯示 loading。
 */

import { NextResponse } from 'next/server'

import { generateBriefing } from '@/lib/ops-copilot/briefing'
import { requireAdmin } from '../_auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const dry = new URL(req.url).searchParams.get('dry') === '1'

  try {
    const briefing = await generateBriefing(auth.payload, { persist: !dry })
    return NextResponse.json(briefing)
  } catch (err) {
    console.error('[ops-copilot] briefing failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '日報產生失敗' },
      { status: 500 },
    )
  }
}
