import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/exchanges
 *   body: {
 *     orderId: number | string,
 *     items: Array<{
 *       product: number | string,
 *       originalVariant: string,     // required — 原款式
 *       newVariant: string,          // required — 想換成
 *       quantity: number,
 *       reason: 'wrong_size' | 'color_mismatch' | 'defective' | 'other',
 *     }>
 *   }
 *
 * 會員提交換貨申請。驗證規則參考 /api/returns（只是沒有 photos，有 newVariant）。
 *   - 必須登入
 *   - order 必須屬於該 user
 *   - order.status 須是 shipped / delivered
 *   - 每筆 item：product 必須在原訂單、originalVariant 必須對得上、newVariant 不可等於
 *     originalVariant（否則沒意義），quantity 不能超過原單數量
 */

const VALID_REASONS = new Set([
  'wrong_size',
  'color_mismatch',
  'defective',
  'other',
])

type IncomingItem = {
  product?: unknown
  originalVariant?: unknown
  newVariant?: unknown
  quantity?: unknown
  reason?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const headers = request.headers
  const { user } = await payload.auth({ headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { orderId?: unknown; items?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const orderIdRaw = body.orderId
  const orderId =
    typeof orderIdRaw === 'number'
      ? orderIdRaw
      : typeof orderIdRaw === 'string' && orderIdRaw.trim()
        ? orderIdRaw
        : null
  if (!orderId) {
    return NextResponse.json({ error: 'order_id_required' }, { status: 400 })
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items_required' }, { status: 400 })
  }
  if (body.items.length > 20) {
    return NextResponse.json({ error: 'too_many_items' }, { status: 400 })
  }

  let order: Record<string, unknown>
  try {
    order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }

  const customerRef = order.customer
  const customerId =
    typeof customerRef === 'object' && customerRef !== null
      ? (customerRef as Record<string, unknown>).id
      : customerRef
  if (String(customerId ?? '') !== String(user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const status = String(order.status ?? '')
  if (status !== 'shipped' && status !== 'delivered') {
    return NextResponse.json(
      {
        error: 'invalid_order_status',
        message: '僅已出貨或已送達的訂單可申請換貨',
        status,
      },
      { status: 409 },
    )
  }

  const orderItems =
    (order.items as Array<Record<string, unknown>> | undefined) ?? []

  const cleanItems: Array<{
    product: number | string
    originalVariant: string
    newVariant: string
    quantity: number
    reason: string
  }> = []
  for (const raw of body.items as IncomingItem[]) {
    const productRaw = raw?.product
    const productId =
      typeof productRaw === 'number'
        ? productRaw
        : typeof productRaw === 'string' && productRaw.trim()
          ? productRaw
          : null
    if (!productId) {
      return NextResponse.json({ error: 'item_product_required' }, { status: 400 })
    }
    const originalVariant =
      typeof raw?.originalVariant === 'string' && raw.originalVariant.trim()
        ? raw.originalVariant.trim().slice(0, 200)
        : ''
    const newVariant =
      typeof raw?.newVariant === 'string' && raw.newVariant.trim()
        ? raw.newVariant.trim().slice(0, 200)
        : ''
    if (!originalVariant || !newVariant) {
      return NextResponse.json({ error: 'variants_required' }, { status: 400 })
    }
    if (originalVariant === newVariant) {
      return NextResponse.json({ error: 'variants_must_differ' }, { status: 400 })
    }
    const quantity =
      typeof raw?.quantity === 'number' ? Math.floor(raw.quantity) : NaN
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      return NextResponse.json({ error: 'item_quantity_invalid' }, { status: 400 })
    }
    const reason = typeof raw?.reason === 'string' ? raw.reason : ''
    if (!VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: 'item_reason_invalid' }, { status: 400 })
    }

    // Validate originalVariant exists in order
    const matching = orderItems.find((li) => {
      const liProduct = li.product
      const liProductId =
        typeof liProduct === 'object' && liProduct !== null
          ? (liProduct as Record<string, unknown>).id
          : liProduct
      if (String(liProductId ?? '') !== String(productId)) return false
      const liVariant = String(li.variant ?? '')
      return liVariant === originalVariant
    })
    if (!matching) {
      return NextResponse.json(
        { error: 'item_not_in_order', product: productId, variant: originalVariant },
        { status: 400 },
      )
    }
    const orderedQty = Number(matching.quantity ?? 0) || 0
    if (quantity > orderedQty) {
      return NextResponse.json(
        {
          error: 'item_quantity_exceeds_order',
          product: productId,
          variant: originalVariant,
          ordered: orderedQty,
        },
        { status: 400 },
      )
    }

    cleanItems.push({
      product: productId,
      originalVariant,
      newVariant,
      quantity,
      reason,
    })
  }

  try {
    const created = (await (payload.create as Function)({
      collection: 'exchanges',
      data: {
        order: orderId,
        customer: Number(user.id),
        items: cleanItems,
        status: 'pending',
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return NextResponse.json(
      {
        ok: true,
        exchangeId: created.id,
        exchangeNumber: created.exchangeNumber,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[api/exchanges] create failed:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
