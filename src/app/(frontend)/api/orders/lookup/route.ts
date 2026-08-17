import { NextResponse } from 'next/server'
import { timingSafeEqual, createHash } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit, clientIpForRateLimit } from '@/lib/rateLimit'
import { parseLookupIdentifier, phoneMatches } from '@/lib/commerce/orderLookup'

/**
 * POST /api/orders/lookup —— 訂單編號 + 手機（或信箱）查訂單（WO-BP002 追加）
 * ─────────────────────────────────────────────────────────────────
 * 訪客沒有帳號可以查單（臨時帳號用合成信箱、session 只有 2 小時），
 * 這支是訪客的查詢入口。識別碼吃**手機或信箱**：台灣顧客記得自己的手機，
 * 卻常忘記結帳時填的是哪個信箱 —— 手機比對的是訂單上的收件人電話
 * （寄貨三原則之一，一定有值）。會員用註冊信箱或手機一樣查得到。
 *
 * 防濫用：
 * - 每個 IP 10 次 / 10 分鐘（訂單編號是流水號，可被枚舉）
 * - 找不到訂單、信箱不符 → **同一個** 404 回應（不透露訂單是否存在）
 * - 信箱比對走固定長度雜湊 + timingSafeEqual，不因字串長度提早返回
 * - 只回顧客自己填過的資料，電話遮成 09xx-***-678
 */
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60_000


/** 長度固定的比較，避免以字串長度側漏 */
function emailMatches(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a.trim().toLowerCase()).digest()
  const hb = createHash('sha256').update(b.trim().toLowerCase()).digest()
  return timingSafeEqual(ha, hb)
}

function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `${digits.slice(0, 4)}-***-${digits.slice(-3)}`
}

const NOT_FOUND = {
  success: false,
  error: '查無此訂單，請確認訂單編號與手機號碼（或聯絡信箱）是否正確',
  code: 'NOT_FOUND',
} as const

export async function POST(req: Request) {
  let body: { orderNumber?: unknown; identifier?: unknown; email?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ success: false, error: '請求格式錯誤', code: 'INVALID_BODY' }, { status: 400 })
  }

  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : ''
  // `identifier` 是新欄位（手機或信箱擇一）；`email` 保留相容舊呼叫端
  const rawIdentifier =
    typeof body.identifier === 'string' && body.identifier.trim()
      ? body.identifier
      : typeof body.email === 'string'
        ? body.email
        : ''
  const identifier = parseLookupIdentifier(rawIdentifier)
  if (!orderNumber || !identifier) {
    return NextResponse.json(
      { success: false, error: '請填寫訂單編號與手機號碼（或聯絡信箱）', code: 'VALIDATION_FAILED' },
      { status: 400 },
    )
  }

  const rate = checkRateLimit(`order-lookup:${clientIpForRateLimit(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: '查詢次數過多，請稍後再試', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    )
  }

  try {
    const payload = await getPayload({ config })
    const found = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 1, // 帶出 customer 以便比對會員信箱
      overrideAccess: true,
    })
    const order = found.docs[0] as unknown as Record<string, unknown> | undefined
    if (!order) return NextResponse.json(NOT_FOUND, { status: 404 })

    const guestEmail = typeof order.guestEmail === 'string' ? order.guestEmail : ''
    const customer = order.customer as { email?: string; phone?: string } | string | number | undefined
    const memberEmail =
      customer && typeof customer === 'object' && typeof customer.email === 'string' ? customer.email : ''
    const memberPhone =
      customer && typeof customer === 'object' && typeof customer.phone === 'string' ? customer.phone : ''
    const orderPhone = ((order.shippingAddress ?? {}) as Record<string, unknown>).phone as string | undefined

    const ok =
      identifier.kind === 'email'
        ? Boolean(
            (guestEmail && emailMatches(guestEmail, identifier.value)) ||
              (memberEmail && emailMatches(memberEmail, identifier.value)),
          )
        : // 手機：比訂單上的收件人電話，其次比會員資料上的手機
          phoneMatches(orderPhone, identifier.value) || phoneMatches(memberPhone, identifier.value)
    if (!ok) return NextResponse.json(NOT_FOUND, { status: 404 })

    const items = (Array.isArray(order.items) ? order.items : []) as Array<Record<string, unknown>>
    const ship = (order.shippingMethod ?? {}) as Record<string, unknown>
    const addr = (order.shippingAddress ?? {}) as Record<string, unknown>

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        items: items.map((i) => ({
          productName: i.productName,
          variant: i.variant,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
          isGift: Boolean(i.isGift),
        })),
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        shippingFee: order.shippingFee,
        codFee: order.codFee,
        total: order.total,
        shipping: {
          methodName: ship.methodName,
          carrier: ship.carrier,
          trackingNumber: ship.trackingNumber,
          estimatedDays: ship.estimatedDays,
          storeName: (ship.convenienceStore as Record<string, unknown> | undefined)?.storeName,
        },
        recipient: {
          name: addr.recipientName,
          phone: maskPhone(addr.phone as string | undefined),
          city: addr.city,
          district: addr.district,
          address: addr.address,
        },
      },
    })
  } catch (err) {
    console.error('[orders/lookup] failed', err)
    return NextResponse.json(
      { success: false, error: '查詢失敗，請稍後再試', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
