import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  loadEcpayConfig,
  verifyAioCheckMacValue,
  SUBSCRIPTION_CUSTOM_PREFIX,
} from '@/lib/payment/ecpay'
import {
  renewSubscription,
  recordFailedPeriod,
  type SubDoc,
} from '@/lib/subscription/activate'
import { sendSubscriptionReceiptEmail } from '@/lib/email/subscriptionReceipt'

/**
 * POST /api/subscription/ecpay/period-callback — 定期定額**第二期起**
 * 每期授權結果（PeriodReturnURL；?p=5631）。
 *
 * payload 欄位：MerchantTradeNo / RtnCode / Amount / gwsr(小寫) /
 * ProcessDate / AuthCode / TotalSuccessTimes / CustomField1-4 /
 * SimulatePaid(後台模擬=1) / CheckMacValue（同 AIO SHA256 驗法）。
 *
 * 冪等靠 authLog gwsr；成功 → renewSubscription（延權益+streak+發放）；
 * 失敗 → 只記 authLog（綠界連續失敗 6 次自動停用後續）。回 1|OK。
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
      logger.warn(`[subscription] period-callback MAC 驗證失敗: ${JSON.stringify(params)}`)
      return new Response('0|CheckMacValue Error', { status: 400 })
    }

    logger.info(`[subscription] period callback raw: ${JSON.stringify(params)}`)

    // 優先 CustomField1=SUB:<id>；缺漏時用母交易號回查
    let sub: SubDoc | null = null
    const custom = params.CustomField1 || ''
    if (custom.startsWith(SUBSCRIPTION_CUSTOM_PREFIX)) {
      try {
        sub = (await payload.findByID({
          collection: 'user-subscriptions',
          id: custom.slice(SUBSCRIPTION_CUSTOM_PREFIX.length),
          depth: 0,
        })) as unknown as SubDoc
      } catch {
        sub = null
      }
    }
    if (!sub && params.MerchantTradeNo) {
      const found = await payload.find({
        collection: 'user-subscriptions',
        where: { 'ecpay.merchantTradeNo': { equals: params.MerchantTradeNo } },
        limit: 1,
        depth: 0,
      })
      sub = (found.docs[0] as unknown as SubDoc) || null
    }
    if (!sub) {
      logger.warn(
        `[subscription] period-callback 查無訂閱 CustomField1=${custom} tradeNo=${params.MerchantTradeNo}`,
      )
      return new Response('0|Subscription Not Found', { status: 404 })
    }

    const ev = {
      gwsr: params.gwsr || params.Gwsr || '',
      rtnCode: params.RtnCode || '',
      amount: Number(params.Amount) || sub.amount,
      processDate: params.ProcessDate,
    }

    if (params.RtnCode === '1') {
      const result = await renewSubscription(payload, sub, ev)
      if (result.applied) {
        logger.info(
          `[subscription] sub=${sub.id} 續期成功 #${result.sub.ecpay?.totalSuccessTimes} streak=${result.sub.streakMonths} periodEnd=${result.sub.currentPeriodEnd} credit=${result.creditGranted}${params.SimulatePaid === '1' ? '（模擬付款）' : ''}`,
        )
        sendSubscriptionReceiptEmail(payload, result.sub, result.plan, {
          kind: 'renewal',
          creditGranted: result.creditGranted,
        }).catch((err) => console.error('[subscription] 續扣收據寄送失敗:', err))
      }
    } else {
      await recordFailedPeriod(payload, sub, ev)
      logger.warn(
        `[subscription] sub=${sub.id} 期授權失敗 RtnCode=${params.RtnCode} RtnMsg=${params.RtnMsg || ''}`,
      )
    }

    return new Response('1|OK')
  } catch (err) {
    logger.warn(`[subscription] period-callback error: ${String(err)}`)
    return new Response('0|Server Error', { status: 500 })
  }
}
