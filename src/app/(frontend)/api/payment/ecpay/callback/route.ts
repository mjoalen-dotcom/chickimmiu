import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { loadEcpayConfig, verifyAioCheckMacValue } from '@/lib/payment/ecpay'

/**
 * POST /api/payment/ecpay/callback — 綠界 server-to-server 付款結果通知
 * （AioCheckOut 的 ReturnURL）。這裡是**唯一**把訂單標成已付款的地方；
 * 顧客導回的 OrderResultURL（/result）純導頁、不改狀態。
 *
 * - 驗 CheckMacValue，不過就拒收（0|CheckMacValue Error）。
 * - RtnCode=1 → 訂單 paymentStatus:paid + 記 TradeNo。已付款信 / 點數 /
 *   銷量 / 佣金全掛在 Orders.ts 既有的 unpaid→paid hooks，這裡不重寫。
 * - 冪等：同一訂單重送 callback，已 paid 直接回 1|OK 不重觸發。
 * - 處理完回純文字 `1|OK`（綠界收不到會重試多次）。
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let payloadLogger: { info: (m: string) => void; warn: (m: string) => void } = console
  try {
    const text = await req.text()
    const params: Record<string, string> = {}
    new URLSearchParams(text).forEach((v, k) => {
      params[k] = v
    })

    const payload = await getPayload({ config })
    payloadLogger = payload.logger

    const cfg = loadEcpayConfig()
    if (!verifyAioCheckMacValue(params, cfg.hashKey, cfg.hashIV)) {
      payloadLogger.warn(`[ecpay] callback MAC 驗證失敗: ${JSON.stringify(params)}`)
      return new Response('0|CheckMacValue Error', { status: 400 })
    }

    // 保留原始回傳做對帳（pm2 log 可查）
    payloadLogger.info(`[ecpay] callback raw: ${JSON.stringify(params)}`)

    const orderNumber = params.CustomField1 || ''
    if (!orderNumber) {
      return new Response('0|Missing CustomField1', { status: 400 })
    }

    const found = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
    })
    const order = found.docs[0] as
      | { id: number | string; paymentStatus?: string | null }
      | undefined
    if (!order) {
      payloadLogger.warn(`[ecpay] callback 查無訂單 orderNumber=${orderNumber}`)
      return new Response('0|Order Not Found', { status: 404 })
    }

    if (params.RtnCode === '1') {
      if (order.paymentStatus !== 'paid') {
        await payload.update({
          collection: 'orders',
          id: order.id,
          data: {
            paymentStatus: 'paid',
            paymentTransactionId: params.TradeNo || undefined,
          },
        })
        payloadLogger.info(
          `[ecpay] order=${orderNumber} 標記已付款 TradeNo=${params.TradeNo || '-'}`,
        )
      }
    } else {
      // 非成功碼（取號、失敗等）只記錄；訂單維持 unpaid 由自動取消機制處理
      payloadLogger.info(
        `[ecpay] order=${orderNumber} 非成功通知 RtnCode=${params.RtnCode} RtnMsg=${params.RtnMsg || ''}`,
      )
    }

    return new Response('1|OK')
  } catch (err) {
    payloadLogger.warn(`[ecpay] callback error: ${String(err)}`)
    return new Response('0|Server Error', { status: 500 })
  }
}
