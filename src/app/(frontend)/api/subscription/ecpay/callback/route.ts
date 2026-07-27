import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  loadEcpayConfig,
  verifyAioCheckMacValue,
  SUBSCRIPTION_CUSTOM_PREFIX,
} from '@/lib/payment/ecpay'
import { activateSubscription, type SubDoc } from '@/lib/subscription/activate'
import { sendSubscriptionReceiptEmail } from '@/lib/email/subscriptionReceipt'

/**
 * POST /api/subscription/ecpay/callback — 定期定額**首期**授權結果
 * （AioCheckOut 的 ReturnURL，一般 AIO 付款通知格式）。
 * 第二期起走 /period-callback（PeriodReturnURL）。
 *
 * 驗 CheckMacValue → CustomField1=SUB:<id> 回查 → RtnCode=1 →
 * activateSubscription（開通 + 權益發放，冪等靠 authLog gwsr）→ 1|OK。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let logger: { info: (m: string) => void; warn: (m: string) => void } = console
  try {
    const text = await req.text()
    const params: Record<string, string> = {}
    new URLSearchParams(text).forEach((v, k) => {
      params[k] = v
    })

    const payload = await getPayload({ config })
    logger = payload.logger

    const cfg = loadEcpayConfig()
    if (!verifyAioCheckMacValue(params, cfg.hashKey, cfg.hashIV)) {
      logger.warn(`[subscription] callback MAC 驗證失敗: ${JSON.stringify(params)}`)
      return new Response('0|CheckMacValue Error', { status: 400 })
    }

    logger.info(`[subscription] first-auth callback raw: ${JSON.stringify(params)}`)

    const custom = params.CustomField1 || ''
    if (!custom.startsWith(SUBSCRIPTION_CUSTOM_PREFIX)) {
      return new Response('0|Missing CustomField1', { status: 400 })
    }
    const subId = custom.slice(SUBSCRIPTION_CUSTOM_PREFIX.length)

    let sub: SubDoc
    try {
      sub = (await payload.findByID({
        collection: 'user-subscriptions',
        id: subId,
        depth: 0,
      })) as unknown as SubDoc
    } catch {
      logger.warn(`[subscription] callback 查無訂閱 id=${subId}`)
      return new Response('0|Subscription Not Found', { status: 404 })
    }

    if (params.RtnCode === '1') {
      const result = await activateSubscription(
        payload,
        sub,
        {
          // 一般 AIO 首期通知的授權單號欄位是 gwsr（NeedExtraPaidInfo=Y 才有）；
          // 沒帶時用 TradeNo 當冪等鍵
          gwsr: params.gwsr || params.TradeNo || '',
          rtnCode: params.RtnCode,
          amount: Number(params.TradeAmt) || sub.amount,
          processDate: params.PaymentDate,
        },
        params.MerchantTradeNo || sub.ecpay?.merchantTradeNo || '',
      )
      if (result.applied) {
        logger.info(
          `[subscription] sub=${subId} 開通成功 periodEnd=${result.sub.currentPeriodEnd} credit=${result.creditGranted}`,
        )
        sendSubscriptionReceiptEmail(payload, result.sub, result.plan, {
          kind: 'first',
          creditGranted: result.creditGranted,
        }).catch((err) => console.error('[subscription] 開通信寄送失敗:', err))
      }
    } else {
      logger.info(
        `[subscription] sub=${subId} 首期授權失敗 RtnCode=${params.RtnCode} RtnMsg=${params.RtnMsg || ''}`,
      )
    }

    return new Response('1|OK')
  } catch (err) {
    logger.warn(`[subscription] callback error: ${String(err)}`)
    return new Response('0|Server Error', { status: 500 })
  }
}
