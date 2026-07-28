import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'
import { loadEcpayLogisticsConfig } from '@/lib/logistics/ecpayLogisticsMap'
import { buildHomePrintForm, carrierToHomeSubType } from '@/lib/logistics/ecpayExpress'

/**
 * POST /api/admin/orders/home-ship/print — 宅配託運單列印表單參數。
 * 回 { action, params }，前端開新視窗 form POST 到綠界
 * /helper/printTradeDocument（CSP form-action 已放行 logistics*.ecpay.com.tw）。
 * 支援一次帶多張（orderNumbers）合併列印——僅限同為宅配（TCAT/POST）的單。
 */

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return Response.json({ error: '權限不足' }, { status: 403 })
  }

  let body: { orderNumber?: string; orderNumbers?: string[] }
  try {
    body = (await req.json()) as { orderNumber?: string; orderNumbers?: string[] }
  } catch {
    return Response.json({ error: '無效的請求內容' }, { status: 400 })
  }
  const orderNumbers = (body.orderNumbers || (body.orderNumber ? [body.orderNumber] : []))
    .map((n) => String(n || '').trim())
    .filter(Boolean)
  if (orderNumbers.length === 0) {
    return Response.json({ error: '缺訂單編號' }, { status: 400 })
  }

  const cfg = loadEcpayLogisticsConfig()
  if (!cfg.isConfigured) {
    return Response.json({ error: '綠界物流憑證尚未設定' }, { status: 503 })
  }

  const ids: string[] = []
  for (const orderNumber of orderNumbers) {
    const found = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      depth: 0,
    })
    const order = found.docs[0] as Order | undefined
    if (!order) {
      return Response.json({ error: `訂單 ${orderNumber} 不存在` }, { status: 404 })
    }
    const sm = order.shippingMethod ?? {}
    if (!carrierToHomeSubType(String(sm.carrier || ''))) {
      return Response.json(
        { error: `訂單 ${orderNumber} 不是綠界宅配（carrier=${sm.carrier || '空'}）` },
        { status: 400 },
      )
    }
    if (!sm.ecpayLogisticsId) {
      return Response.json(
        { error: `訂單 ${orderNumber} 尚未發號，請先跑「宅配發號」` },
        { status: 400 },
      )
    }
    ids.push(sm.ecpayLogisticsId)
  }

  try {
    return Response.json(buildHomePrintForm(cfg, ids))
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    )
  }
}
