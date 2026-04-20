import type { Payload, Where } from 'payload'

/**
 * 自動取消未付款訂單
 * ─────────────────
 * 掃 `paymentStatus=unpaid AND status=pending AND createdAt < now - minutes`
 * 的訂單，逐筆改成 status=cancelled。由 /api/cron/auto-cancel-orders 呼叫。
 *
 * Cancelled 後 Orders.afterChange 會自動回補庫存（既有邏輯），所以這裡
 * 不直接操作庫存，只改 status/cancelReason。
 */
export async function runAutoCancelUnpaid(
  payload: Payload,
  minutes: number,
): Promise<{
  cancelled: number
  scanned: number
  errors: Array<{ orderId: unknown; error: string }>
}> {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { cancelled: 0, scanned: 0, errors: [] }
  }

  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString()

  const unpaid = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { paymentStatus: { equals: 'unpaid' } },
        { status: { equals: 'pending' } },
        { createdAt: { less_than: cutoff } },
      ],
    } satisfies Where,
    limit: 500,
    depth: 0,
    pagination: false,
  })

  let cancelled = 0
  const errors: Array<{ orderId: unknown; error: string }> = []
  for (const doc of unpaid.docs) {
    const id = (doc as unknown as { id?: unknown }).id
    if (id == null) continue
    try {
      await (payload.update as unknown as (args: Record<string, unknown>) => Promise<unknown>)({
        collection: 'orders',
        id,
        data: {
          status: 'cancelled',
          adminNote: `自動取消：下單後 ${minutes} 分鐘內未付款`,
        },
        overrideAccess: true,
      })
      cancelled++
    } catch (err) {
      errors.push({
        orderId: id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { cancelled, scanned: unpaid.docs.length, errors }
}
