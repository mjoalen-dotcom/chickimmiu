import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getSelfServiceEligibility } from '@/lib/commerce/orderSelfService'

/**
 * POST /api/account/orders/[id]/cancel
 *
 * Customer-initiated cancellation. Eligible only when the order is still
 * 'pending' and within the 30-minute self-service window (see
 * `lib/commerce/orderSelfService`). The actual reversals (revoke cards,
 * reverse pending rewards, send cancellation email) are handled by the
 * existing Orders.ts afterChange hooks — we just flip status.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let order: Record<string, unknown>
  try {
    order = (await payload.findByID({
      collection: 'orders',
      id,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const rawCustomer = order.customer
  const customerId =
    typeof rawCustomer === 'string'
      ? rawCustomer
      : (rawCustomer as Record<string, unknown> | null)?.id
  if (String(customerId ?? '') !== String(user.id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const eligibility = getSelfServiceEligibility(order)
  if (!eligibility.canCancel) {
    return NextResponse.json(
      { error: 'not_eligible', message: eligibility.reason ?? '此訂單目前無法自助取消' },
      { status: 409 },
    )
  }

  try {
    await payload.update({
      collection: 'orders',
      id,
      data: { status: 'cancelled' },
      overrideAccess: true,
      user,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'cancel_failed',
        message: err instanceof Error ? err.message : '取消訂單失敗，請稍後再試',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
