import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getSelfServiceEligibility } from '@/lib/commerce/orderSelfService'

/**
 * PATCH /api/account/orders/[id]/edit-address
 *
 * Customer-initiated shipping-address edit. Eligible only when the order is
 * still 'pending', within the 30-minute self-service window, AND not a
 * convenience-store pickup (those have an ECPay-issued logistics number tied
 * to the chosen storeId — changing requires customer service).
 *
 * Body shape (all strings):
 *   { recipientName, phone, zipCode?, city, district?, address }
 */

const TRIM_LIMITS = {
  recipientName: 50,
  phone: 20,
  zipCode: 10,
  city: 20,
  district: 30,
  address: 200,
} as const

type AddressInput = {
  recipientName?: unknown
  phone?: unknown
  zipCode?: unknown
  city?: unknown
  district?: unknown
  address?: unknown
}

function sanitize(raw: AddressInput): {
  recipientName: string
  phone: string
  zipCode: string
  city: string
  district: string
  address: string
} | null {
  const pick = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) : ''

  const out = {
    recipientName: pick(raw.recipientName, TRIM_LIMITS.recipientName),
    phone: pick(raw.phone, TRIM_LIMITS.phone),
    zipCode: pick(raw.zipCode, TRIM_LIMITS.zipCode),
    city: pick(raw.city, TRIM_LIMITS.city),
    district: pick(raw.district, TRIM_LIMITS.district),
    address: pick(raw.address, TRIM_LIMITS.address),
  }
  if (!out.recipientName || !out.phone || !out.city || !out.address) return null
  return out
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: AddressInput
  try {
    body = (await request.json()) as AddressInput
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const sanitized = sanitize(body)
  if (!sanitized) {
    return NextResponse.json(
      { error: 'invalid_address', message: '收件人姓名、電話、縣市、地址為必填' },
      { status: 400 },
    )
  }

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
  if (!eligibility.canEditAddress) {
    return NextResponse.json(
      { error: 'not_eligible', message: eligibility.reason ?? '此訂單目前無法自助修改地址' },
      { status: 409 },
    )
  }

  try {
    await payload.update({
      collection: 'orders',
      id,
      data: { shippingAddress: sanitized },
      overrideAccess: true,
      user,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'update_failed',
        message: err instanceof Error ? err.message : '修改地址失敗，請稍後再試',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, shippingAddress: sanitized })
}
