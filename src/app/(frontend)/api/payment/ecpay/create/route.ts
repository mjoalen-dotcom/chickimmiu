import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { loadEcpayConfig, buildAioCheckoutParams } from '@/lib/payment/ecpay'

/**
 * POST /api/payment/ecpay/create — §4 二段式建單的第二段。
 * checkout 先 POST /api/orders 建 unpaid/pending 訂單，再打這支拿
 * AioCheckOut 表單參數，由前端 auto-submit 導向綠界付款頁。
 *
 * 只有訂單本人（登入 cookie）能為自己的 ecpay 未付款訂單產生付款表單。
 * prod 憑證未設 → 503（絕不用測試商店收真錢）。
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { orderNumber?: string } | null
    const orderNumber = body?.orderNumber?.trim()
    if (!orderNumber) {
      return NextResponse.json({ error: '缺少訂單編號' }, { status: 400 })
    }

    const cfg = loadEcpayConfig()
    if (!cfg.isConfigured) {
      return NextResponse.json(
        { error: '線上金流尚未開通，請改用其他付款方式或聯繫客服' },
        { status: 503 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const found = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
    })
    const order = found.docs[0] as
      | {
          id: number | string
          customer?: number | string | { id?: number | string } | null
          paymentMethod?: string | null
          paymentStatus?: string | null
          status?: string | null
          total?: number | null
          items?: Array<{ productName?: string | null }> | null
        }
      | undefined
    if (!order) {
      return NextResponse.json({ error: '查無此訂單' }, { status: 404 })
    }

    const customerId =
      typeof order.customer === 'object' && order.customer
        ? order.customer.id
        : order.customer
    if (String(customerId) !== String(user.id)) {
      return NextResponse.json({ error: '無權限操作此訂單' }, { status: 403 })
    }

    if (order.paymentMethod !== 'ecpay') {
      return NextResponse.json({ error: '此訂單非綠界付款方式' }, { status: 400 })
    }
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: '此訂單已完成付款' }, { status: 400 })
    }
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json({ error: '此訂單已取消，請重新下單' }, { status: 400 })
    }
    const total = typeof order.total === 'number' ? order.total : 0
    if (total < 1) {
      return NextResponse.json({ error: '訂單金額異常，請聯繫客服' }, { status: 400 })
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '')
    const params = buildAioCheckoutParams(cfg, {
      orderId: order.id,
      orderNumber,
      totalAmount: total,
      itemNames: (order.items ?? [])
        .map((i) => (i?.productName || '').trim())
        .filter(Boolean),
      siteUrl,
    })

    payload.logger.info(
      `[ecpay] create checkout form order=${orderNumber} tradeNo=${params.MerchantTradeNo} amount=${params.TotalAmount} sandbox=${cfg.sandbox}`,
    )

    return NextResponse.json({ action: cfg.checkoutUrl, params, sandbox: cfg.sandbox })
  } catch (err) {
    console.error('[ecpay] create route error:', err)
    return NextResponse.json({ error: '付款頁建立失敗，請稍後再試' }, { status: 500 })
  }
}
