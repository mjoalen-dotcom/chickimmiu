import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'
import { loadEcpayLogisticsConfig } from '@/lib/logistics/ecpayLogisticsMap'
import { buildCvsPrintForm } from '@/lib/logistics/ecpayExpress'

/**
 * POST /api/admin/orders/cvs-ship/print — C2C 託運單標籤列印表單參數。
 * 發號結果列的「列印」按鈕用：回 { action, params }，前端開新視窗
 * form POST 到綠界列印頁（CSP form-action 已放行 logistics*.ecpay.com.tw）。
 */

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return Response.json({ error: '權限不足' }, { status: 403 })
  }

  let body: { orderNumber?: string }
  try {
    body = (await req.json()) as { orderNumber?: string }
  } catch {
    return Response.json({ error: '無效的請求內容' }, { status: 400 })
  }
  const orderNumber = String(body.orderNumber || '').trim()
  if (!orderNumber) {
    return Response.json({ error: '缺訂單編號' }, { status: 400 })
  }

  const cfg = loadEcpayLogisticsConfig()
  if (!cfg.isConfigured) {
    return Response.json({ error: '綠界物流憑證尚未設定' }, { status: 503 })
  }

  const found = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
  })
  const order = found.docs[0] as Order | undefined
  if (!order) {
    return Response.json({ error: '訂單不存在' }, { status: 404 })
  }
  const sm = order.shippingMethod ?? {}
  if (!sm.ecpayLogisticsId || !sm.cvsPaymentNo) {
    return Response.json({ error: '此訂單尚未發號，請先跑「超商發號」' }, { status: 400 })
  }

  try {
    const form = buildCvsPrintForm(cfg, {
      carrier: String(sm.carrier || ''),
      allPayLogisticsID: sm.ecpayLogisticsId,
      cvsPaymentNo: sm.cvsPaymentNo,
      cvsValidationNo: sm.cvsValidationNo || undefined,
    })
    return Response.json(form)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    )
  }
}
