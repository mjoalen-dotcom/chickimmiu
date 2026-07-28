import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'
import { loadEcpayLogisticsConfig, carrierToLogisticsSubType } from '@/lib/logistics/ecpayLogisticsMap'
import {
  buildCvsCreateParams,
  createCvsShipment,
  normalizeCellPhone,
  sanitizeLogisticsName,
} from '@/lib/logistics/ecpayExpress'

/**
 * POST /api/admin/orders/cvs-ship — 超商取貨訂單批次「發號」。
 * OrderBulkShipPanel 第三個 tab 用：對每張單打綠界 /Express/Create
 * 建 C2C 託運單，回寫 AllPayLogisticsID / CVSPaymentNo（=追蹤碼）/
 * CVSValidationNo，標 shipped（觸發既有出貨通知信 hook）。
 *
 * 與 bulk-ship 相同的門檻：admin only、shipped/delivered/cancelled/refunded 跳過。
 * 額外門檻：carrier 必須是超商、storeId 必填、金額 1~19999、
 * 已有 ecpayLogisticsId 的不重覆發號、寄件人手機沒設不發。
 */

type Body = { orderNumbers?: string[] }

type ResultRow = {
  orderNumber: string
  reason?: string
  cvsPaymentNo?: string
  cvsValidationNo?: string
  allPayLogisticsID?: string
}

const GOODS_AMOUNT_MAX = 19999

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return Response.json({ error: '權限不足' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: '無效的請求內容' }, { status: 400 })
  }
  const orderNumbers = (body.orderNumbers || []).map((n) => String(n || '').trim()).filter(Boolean)
  if (orderNumbers.length === 0) {
    return Response.json({ error: '沒有可處理的訂單編號' }, { status: 400 })
  }

  const cfg = loadEcpayLogisticsConfig()
  if (!cfg.isConfigured) {
    return Response.json(
      { error: '綠界物流憑證尚未設定（ECPAY_LOGISTICS_*），無法發號' },
      { status: 503 },
    )
  }

  const settings = (await payload
    .findGlobal({ slug: 'order-settings' })
    .catch(() => null)) as Record<string, unknown> | null
  const cvsShipping = (settings?.cvsShipping || {}) as {
    senderName?: string
    senderCellPhone?: string
    returnStoreId?: string
  }
  const senderName = sanitizeLogisticsName(cvsShipping.senderName || '')
  const senderCellPhone = normalizeCellPhone(cvsShipping.senderCellPhone || '')
  if (!senderName || !senderCellPhone) {
    return Response.json(
      { error: '請先到「訂單設定 → 超商託運寄件人」填寄件人名稱與手機（09 開頭 10 碼）' },
      { status: 400 },
    )
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '')
  const serverReplyURL = `${siteUrl}/api/logistics/ecpay/status`

  const succeeded: ResultRow[] = []
  const skipped: ResultRow[] = []

  for (const orderNumber of orderNumbers) {
    try {
      const found = await payload.find({
        collection: 'orders',
        where: { orderNumber: { equals: orderNumber } },
        limit: 1,
        depth: 0,
      })
      const order = found.docs[0] as Order | undefined
      if (!order) {
        skipped.push({ orderNumber, reason: '訂單不存在' })
        continue
      }
      const status = order.status as string
      if (status === 'shipped' || status === 'delivered') {
        skipped.push({ orderNumber, reason: `已是 ${status} 狀態` })
        continue
      }
      if (status === 'cancelled' || status === 'refunded') {
        skipped.push({ orderNumber, reason: `${status} 訂單不可出貨` })
        continue
      }

      const shippingMethod = order.shippingMethod ?? {}
      const carrier = String(shippingMethod.carrier || '')
      if (!carrierToLogisticsSubType(cfg, carrier)) {
        skipped.push({ orderNumber, reason: `carrier=${carrier || '(空)'} 不是超商取貨` })
        continue
      }
      if (shippingMethod.ecpayLogisticsId) {
        skipped.push({
          orderNumber,
          reason: `已發號（${shippingMethod.ecpayLogisticsId}），不重覆建立`,
        })
        continue
      }
      const storeId = String(shippingMethod.convenienceStore?.storeId || '').trim()
      if (!storeId) {
        skipped.push({ orderNumber, reason: '缺門市代號（convenienceStore.storeId）' })
        continue
      }

      const goodsAmount = Math.round(Number(order.total) || 0)
      if (goodsAmount < 1 || goodsAmount > GOODS_AMOUNT_MAX) {
        skipped.push({ orderNumber, reason: `金額 ${goodsAmount} 超出超商託運範圍 1~${GOODS_AMOUNT_MAX}` })
        continue
      }

      const receiverName = sanitizeLogisticsName(String(order.shippingAddress?.recipientName || ''))
      const receiverCellPhone = normalizeCellPhone(String(order.shippingAddress?.phone || ''))
      if (!receiverName || !receiverCellPhone) {
        skipped.push({ orderNumber, reason: '取貨人姓名或手機格式不符（手機須 09 開頭 10 碼）' })
        continue
      }

      // 取貨付款（superstore 代收）：現金類付款方式且尚未付款
      const isCollection =
        String(order.paymentMethod || '').startsWith('cash') && order.paymentStatus !== 'paid'

      const params = buildCvsCreateParams(cfg, {
        orderId: order.id,
        carrier,
        goodsAmount,
        isCollection,
        goodsName: orderNumber,
        senderName,
        senderCellPhone,
        receiverName,
        receiverCellPhone,
        receiverStoreId: storeId,
        serverReplyURL,
        returnStoreId: String(cvsShipping.returnStoreId || '').trim() || undefined,
      })
      const result = await createCvsShipment(cfg, params)
      if (!result.ok) {
        skipped.push({ orderNumber, reason: `綠界發號失敗：${result.error}` })
        continue
      }

      await payload.update({
        collection: 'orders',
        id: order.id,
        data: {
          shippingMethod: {
            ...shippingMethod,
            ecpayLogisticsId: result.allPayLogisticsID,
            cvsPaymentNo: result.cvsPaymentNo,
            cvsValidationNo: result.cvsValidationNo,
          },
          trackingNumber: result.cvsPaymentNo || result.allPayLogisticsID,
          status: 'shipped',
        },
      })

      succeeded.push({
        orderNumber,
        allPayLogisticsID: result.allPayLogisticsID,
        cvsPaymentNo: result.cvsPaymentNo,
        cvsValidationNo: result.cvsValidationNo,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      skipped.push({ orderNumber, reason: msg })
    }
  }

  return Response.json({
    succeededCount: succeeded.length,
    skippedCount: skipped.length,
    succeeded,
    skipped,
  })
}
