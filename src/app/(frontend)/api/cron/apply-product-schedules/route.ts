import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'
import { runApplyProductSchedules } from '@/lib/products/applySchedules'

/**
 * POST /api/cron/apply-product-schedules
 * 商品限時上下架：draft+publishAt<=now → published；published+unpublishAt<=now → archived。
 * 由 prod crontab（outage fallback）/ GitHub Actions 每 10 分鐘觸發。
 * 與後台 endpoint /api/products/apply-schedules 共用同一條邏輯（此處用 CRON_SECRET）。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail
  try {
    const payload = await getPayload({ config })
    const result = await runApplyProductSchedules(payload)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[cron/apply-product-schedules] error:', e)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
