import { NextResponse } from 'next/server'
import { timingSafeEqual, createHash } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit } from '@/lib/rateLimit'

/**
 * POST /api/orders/lookup —— 訂單編號 + 聯絡信箱 查訂單（WO-BP002 追加）
 * ─────────────────────────────────────────────────────────────────
 * 訪客沒有帳號可以查單（臨時帳號用合成信箱、session 只有 2 小時），
 * 這支是訪客的查詢入口；會員用自己的註冊信箱一樣查得到。
 *
 * 防濫用：
 * - 每個 IP 10 次 / 10 分鐘（訂單編號是流水號，可被枚舉）
 * - 找不到訂單、信箱不符 → **同一個** 404 回應（不透露訂單是否存在）
 * - 信箱比對走固定長度雜湊 + timingSafeEqual，不因字串長度提早返回
 * - 只回顧客自己填過的資料，電話遮成 09xx-***-678
 */
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]!
  }
  return 'unknown'
}

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
  error: '查無此訂單，請確認訂單編號與聯絡信箱是否正確',
  code: 'NOT_FOUND',
} as const

export async function POST(req: Request) {
  let body: { orderNumber?: unknown; email?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ success: false, error: '請求格式錯誤', code: 'INVALID_BODY' }, { status: 400 })
  }

  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!orderNumber || !email) {
    return NextResponse.json(
      { success: false, error: '請填寫訂單編號與聯絡信箱', code: 'VALIDATION_FAILED' },
      { status: 400 },
    )
  }

  const rate = checkRateLimit(`order-lookup:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
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
    const customer = order.customer as { email?: string } | string | number | undefined
    const memberEmail =
      customer && typeof customer === 'object' && typeof customer.email === 'string' ? customer.email : ''
    const ok = (guestEmail && emailMatches(guestEmail, email)) || (memberEmail && emailMatches(memberEmail, email))
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
