import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'
import { loadEcpayLogisticsConfig, carrierToLogisticsSubType } from '@/lib/logistics/ecpayLogisticsMap'
import { carrierToHomeSubType, verifyLogisticsCallback } from '@/lib/logistics/ecpayExpress'
import { classifyLogisticsStatus, nextOrderStatus } from '@/lib/logistics/logisticsStatusMap'

/**
 * /api/logistics/ecpay/status — /Express/Create、/Express/ReturnHome 的
 * ServerReplyURL。綠界物流狀態變動（貨到門市、買家取貨、退回、
 * 逆物流貨態…）server-to-server POST 過來（form-urlencoded + MD5
 * CheckMacValue）。驗章後：
 *   1. 最新貨態寫進 shippingMethod.logisticsStatus（一律）。
 *   2. 退貨類貨態（325 / returning / returned）同步寫
 *      shippingMethod.returnLogisticsStatus。
 *   3. 里程碑自動流轉訂單狀態（OrderSettings.statusFlow.
 *      autoStatusFromLogistics，預設開）：買家取貨/宅配配完 →
 *      delivered（觸發送達通知信 hook）、退回完成 → returned。
 *      冪等 + 不倒退（logisticsStatusMap.nextOrderStatus 把關）。
 *   一律回 `1|OK` 免綠界重送（驗章失敗除外）。
 *
 * 訂單對應：MerchantTradeNo 格式 CKL{orderId}T{ts}（ecpayExpress
 * buildLogisticsTradeNo），直接 parse orderId；失敗再用
 * AllPayLogisticsID 反查（逆物流通知帶原正向單號，也走這條）。
 */
export const dynamic = 'force-dynamic'

const ok = () => new Response('1|OK', { headers: { 'Content-Type': 'text/plain' } })

/** 逆物流/退貨類貨態 → 同步寫 returnLogisticsStatus */
const RETURN_FLOW_CODES = new Set(['325'])

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
    const rtnCode = String(params.RtnCode || '')
    const statusLine = [rtnCode, params.RtnMsg || '', params.UpdateStatusDate || '']
      .join('|')
      .slice(0, 300)

    // 里程碑判定：優先用通知帶的 LogisticsSubType，缺了再從 carrier 推
    const subType =
      String(params.LogisticsSubType || '') ||
      carrierToHomeSubType(String(sm.carrier || '')) ||
      carrierToLogisticsSubType(cfg, String(sm.carrier || '')) ||
      ''
    const milestone = subType ? classifyLogisticsStatus(subType, rtnCode) : null

    const nextShippingMethod: NonNullable<Order['shippingMethod']> = {
      ...sm,
      logisticsStatus: statusLine,
    }
    // 某些子類型（如全家）寄貨編號在後續通知才配號——補寫
    if (!sm.cvsPaymentNo && params.CVSPaymentNo) {
      nextShippingMethod.cvsPaymentNo = params.CVSPaymentNo
      if (params.CVSValidationNo) nextShippingMethod.cvsValidationNo = params.CVSValidationNo
    }
    // 退貨類貨態同步寫 returnLogisticsStatus（宅配 ReturnHome 建單後
    // 的逆物流通知、超商未取退回都收斂到這欄）
    if (milestone === 'returning' || milestone === 'returned' || RETURN_FLOW_CODES.has(rtnCode)) {
      nextShippingMethod.returnLogisticsStatus = statusLine
    }

    // 自動流轉（總開關預設開；nextOrderStatus 冪等 + 不倒退）
    let statusUpdate: Record<string, unknown> = {}
    if (milestone) {
      const settings = (await payload
        .findGlobal({ slug: 'order-settings' })
        .catch(() => null)) as Record<string, unknown> | null
      const statusFlow = (settings?.statusFlow || {}) as { autoStatusFromLogistics?: boolean }
      const autoEnabled = statusFlow.autoStatusFromLogistics !== false
      if (autoEnabled) {
        const next = nextOrderStatus(milestone, String(order.status || ''))
        if (next) {
          statusUpdate = { status: next }
          console.info(
            `[ecpay-logistics] 訂單 ${order.orderNumber} 貨態 ${rtnCode}（${subType}）→ 狀態 ${order.status} → ${next}`,
          )
        }
      }
    }

    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        shippingMethod: nextShippingMethod,
        ...(!order.trackingNumber && params.CVSPaymentNo
          ? { trackingNumber: params.CVSPaymentNo }
          : {}),
        ...statusUpdate,
      },
    })
  } catch (err) {
    // 落庫失敗也回 1|OK：狀態通知非關鍵路徑，錯誤靠 log 追
    console.error('[ecpay-logistics] status callback error:', err)
  }
  return ok()
}
