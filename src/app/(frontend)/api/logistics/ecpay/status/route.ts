import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'
import { loadEcpayLogisticsConfig } from '@/lib/logistics/ecpayLogisticsMap'
import { verifyLogisticsCallback } from '@/lib/logistics/ecpayExpress'

/**
 * /api/logistics/ecpay/status — /Express/Create 的 ServerReplyURL。
 * 綠界物流狀態變動（貨到門市、退回、代收入帳…）server-to-server POST
 * 過來（form-urlencoded + MD5 CheckMacValue）。驗章後把最新狀態寫進
 * shippingMethod.logisticsStatus；一律回 `1|OK` 免綠界重送。
 *
 * 訂單對應：MerchantTradeNo 格式 CKL{orderId}T{ts}（ecpayExpress
 * buildLogisticsTradeNo），直接 parse orderId；失敗再用
 * AllPayLogisticsID 反查。
 */
export const dynamic = 'force-dynamic'

const ok = () => new Response('1|OK', { headers: { 'Content-Type': 'text/plain' } })

export async function POST(req: NextRequest) {
  const params: Record<string, string> = {}
  try {
    const text = await req.text()
    new URLSearchParams(text).forEach((v, k) => {
      params[k] = v
    })
  } catch {
    return ok()
  }

  const cfg = loadEcpayLogisticsConfig()
  if (!verifyLogisticsCallback(cfg, params)) {
    console.warn('[ecpay-logistics] status callback CheckMacValue 驗證失敗:', params)
    // 驗章失敗不回 1|OK，讓綠界知道沒收妥（也擋亂打的請求）
    return new Response('0|CheckMacValue mismatch', { headers: { 'Content-Type': 'text/plain' } })
  }

  try {
    const payload = await getPayload({ config })
    let order: Order | undefined

    const m = /^CKL(\d+)T/.exec(params.MerchantTradeNo || '')
    if (m) {
      order = (await payload
        .findByID({ collection: 'orders', id: Number(m[1]), depth: 0 })
        .catch(() => undefined)) as Order | undefined
    }
    if (!order && params.AllPayLogisticsID) {
      const found = await payload.find({
        collection: 'orders',
        where: { 'shippingMethod.ecpayLogisticsId': { equals: params.AllPayLogisticsID } },
        limit: 1,
        depth: 0,
      })
      order = found.docs[0] as Order | undefined
    }
    if (!order) {
      console.warn('[ecpay-logistics] status callback 找不到訂單:', params.MerchantTradeNo, params.AllPayLogisticsID)
      return ok()
    }

    const sm = order.shippingMethod ?? {}
    const statusLine = [params.RtnCode || '', params.RtnMsg || '', params.UpdateStatusDate || '']
      .join('|')
      .slice(0, 300)

    const nextShippingMethod: NonNullable<Order['shippingMethod']> = {
      ...sm,
      logisticsStatus: statusLine,
    }
    // 某些子類型（如全家）寄貨編號在後續通知才配號——補寫
    if (!sm.cvsPaymentNo && params.CVSPaymentNo) {
      nextShippingMethod.cvsPaymentNo = params.CVSPaymentNo
      if (params.CVSValidationNo) nextShippingMethod.cvsValidationNo = params.CVSValidationNo
    }

    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        shippingMethod: nextShippingMethod,
        ...(!order.trackingNumber && params.CVSPaymentNo
          ? { trackingNumber: params.CVSPaymentNo }
          : {}),
      },
    })
  } catch (err) {
    // 落庫失敗也回 1|OK：狀態通知非關鍵路徑，錯誤靠 log 追
    console.error('[ecpay-logistics] status callback error:', err)
  }
  return ok()
}
