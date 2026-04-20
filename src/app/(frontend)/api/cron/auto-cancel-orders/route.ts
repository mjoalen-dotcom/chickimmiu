import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'
import { runAutoCancelUnpaid } from '@/lib/commerce/orderAutoCancel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * /api/cron/auto-cancel-orders
 *
 * 讀 OrderSettings.autoActions.autoCancelUnpaidMinutes：
 *   - 0：cron no-op
 *   - N > 0：把 status=pending + paymentStatus=unpaid + createdAt < now-N 的訂單
 *     改為 cancelled
 *
 * 建議排程：每 10 分鐘一次（granularity 允許 cron.autoCancelUnpaidMinutes 最低 10 分鐘）。
 * Payload Orders.afterChange 會自動庫存回補，所以這裡不直接改庫存。
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const payload = await getPayload({ config })

  const orderSettings = (await payload.findGlobal({
    slug: 'order-settings',
    depth: 0,
  })) as unknown as Record<string, unknown>
  const autoActions = (orderSettings.autoActions ?? {}) as Record<string, unknown>
  const minutes = (autoActions.autoCancelUnpaidMinutes as number) ?? 0

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'auto_cancel_disabled',
      duration_ms: Date.now() - started,
    })
  }

  const result = await runAutoCancelUnpaid(payload, minutes)

  return NextResponse.json({
    ok: true,
    minutes,
    ...result,
    errors: result.errors.slice(0, 20),
    duration_ms: Date.now() - started,
  })
}
