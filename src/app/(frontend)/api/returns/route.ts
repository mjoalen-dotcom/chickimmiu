import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/returns
 *   body: {
 *     orderId: number | string,
 *     items: Array<{
 *       product: number | string,   // products.id
 *       variant?: string,            // '顏色 / 尺寸' 快照
 *       quantity: number,            // 1..line.quantity
 *       reason: 'defective' | 'wrong_size' | 'color_mismatch'
 *               | 'wrong_item' | 'not_wanted' | 'other',
 *       reasonDetail?: string,
 *     }>,
 *     photos?: Array<{ image: number | string }>  // optional media ids
 *   }
 *
 * 會員提交退貨申請。
 *   - 必須登入
 *   - order.customer 必須是 session user（IDOR guard）
 *   - order.status 須是 shipped / delivered（尚未出貨不能退）
 *   - items 至少 1 筆、每筆 quantity >= 1
 *   - Returns collection 的 create access 已是 !!user，這裡不用 overrideAccess；
 *     但為了確保 customer 欄位不能被 client 偽造為他人，server 端覆寫 customer=user.id。
 *
 * 成功：201 回 { ok: true, returnId, returnNumber }
 *   後續 email / admin alert 由 Returns.afterChange hook 負責。
 */

const VALID_REASONS = new Set([
  'defective',
  'wrong_size',
  'color_mismatch',
  'wrong_item',
  'not_wanted',
  'other',
])

type IncomingItem = {
  product?: unknown
  variant?: unknown
  quantity?: unknown
  reason?: unknown
  reasonDetail?: unknown
}

type IncomingPhoto = {
  image?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const headers = request.headers
  const { user } = await payload.auth({ headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    orderId?: unknown
    items?: unknown
    photos?: unknown
  }
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

  // Fetch + IDOR check
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
        message: '僅已出貨或已送達的訂單可申請退貨',
        status,
      },
      { status: 409 },
    )
  }

  const orderItems =
    (order.items as Array<Record<string, unknown>> | undefined) ?? []

  // Validate each item
  const cleanItems: Array<{
    product: number | string
    variant?: string
    quantity: number
    reason: string
    reasonDetail?: string
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
    const quantity =
      typeof raw?.quantity === 'number' ? Math.floor(raw.quantity) : NaN
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      return NextResponse.json({ error: 'item_quantity_invalid' }, { status: 400 })
    }
    const reason = typeof raw?.reason === 'string' ? raw.reason : ''
    if (!VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: 'item_reason_invalid' }, { status: 400 })
    }
    const variant =
      typeof raw?.variant === 'string' && raw.variant.trim()
        ? raw.variant.trim().slice(0, 200)
        : undefined
    const reasonDetail =
      typeof raw?.reasonDetail === 'string' && raw.reasonDetail.trim()
        ? raw.reasonDetail.trim().slice(0, 1000)
        : undefined

    // Validate against order — quantity must not exceed the line's ordered qty
    // (variant is a snapshot string, so only loose-match; use product+variant pair)
    const matching = orderItems.find((li) => {
      const liProduct = li.product
      const liProductId =
        typeof liProduct === 'object' && liProduct !== null
          ? (liProduct as Record<string, unknown>).id
          : liProduct
      if (String(liProductId ?? '') !== String(productId)) return false
      if (!variant) return true
      const liVariant = String(li.variant ?? '')
      return liVariant === variant
    })
    if (!matching) {
      return NextResponse.json(
        { error: 'item_not_in_order', product: productId, variant },
        { status: 400 },
      )
    }
    const orderedQty = Number(matching.quantity ?? 0) || 0
    if (quantity > orderedQty) {
      return NextResponse.json(
        { error: 'item_quantity_exceeds_order', product: productId, variant, ordered: orderedQty },
        { status: 400 },
      )
    }

    cleanItems.push({
      product: productId,
      ...(variant ? { variant } : {}),
      quantity,
      reason,
      ...(reasonDetail ? { reasonDetail } : {}),
    })
  }

  // Photos (optional, cap 5)
  const cleanPhotos: Array<{ image: number | string }> = []
  if (Array.isArray(body.photos)) {
    for (const raw of (body.photos as IncomingPhoto[]).slice(0, 5)) {
      const img = raw?.image
      const imageId =
        typeof img === 'number'
          ? img
          : typeof img === 'string' && img.trim()
            ? img
            : null
      if (imageId) cleanPhotos.push({ image: imageId })
    }
  }

  try {
    const created = (await (payload.create as Function)({
      collection: 'returns',
      data: {
        order: orderId,
        customer: Number(user.id),
        items: cleanItems,
        ...(cleanPhotos.length > 0 ? { photos: cleanPhotos } : {}),
        status: 'pending',
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return NextResponse.json(
      {
        ok: true,
        returnId: created.id,
        returnNumber: created.returnNumber,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[api/returns] create failed:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
