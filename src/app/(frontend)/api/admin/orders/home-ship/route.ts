import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'
import { loadEcpayLogisticsConfig } from '@/lib/logistics/ecpayLogisticsMap'
import {
  buildHomeCreateParams,
  carrierToHomeSubType,
  createCvsShipment,
  isValidHomeName,
  normalizeCellPhone,
  sanitizeLogisticsName,
} from '@/lib/logistics/ecpayExpress'

/**
 * POST /api/admin/orders/home-ship — 宅配訂單批次「發號」（綠界 HOME）。
 * OrderBulkShipPanel 宅配發號 tab 用：對每張 tcat/post 訂單打
 * /Express/Create 建託運單，回寫 AllPayLogisticsID / BookingNote
 * （=追蹤碼），標 shipped（觸發既有出貨通知信 hook）。
 *
 * 門檻（照 cvs-ship）：admin only、已 shipped/delivered/cancelled/refunded
 * 跳過、已發號不重覆。宅配額外門檻：收件地址+郵遞區號必填、
 * 寄件人（訂單設定→宅配託運寄件人）四欄齊、姓名 4~10 字元規格、
 * TCAT 代收上限 20000、POST 不可代收（cash_cod 未付款單直接跳過）。
 * 新竹物流（hct）綠界不支援——請走一般批次出貨人工填單號。
 */

type Body = { orderNumbers?: string[] }

type ResultRow = {
  orderNumber: string
  reason?: string
  allPayLogisticsID?: string
  bookingNote?: string
}

const TCAT_COD_MAX = 20000

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
  const home = (settings?.homeShipping || {}) as {
    senderName?: string
    senderCellPhone?: string
    senderZipCode?: string
    senderAddress?: string
    temperature?: string
    specification?: string
    defaultGoodsWeight?: number
  }
  const senderName = String(home.senderName || '').trim()
  const senderCellPhone = normalizeCellPhone(home.senderCellPhone || '')
  const senderZipCode = String(home.senderZipCode || '').trim()
  const senderAddress = String(home.senderAddress || '').trim()
  if (!senderName || !senderCellPhone || !senderZipCode || senderAddress.length < 6) {
    return Response.json(
      { error: '請先到「訂單設定 → 宅配託運寄件人」填齊名稱/手機/郵遞區號/地址（地址至少 6 字）' },
      { status: 400 },
    )
  }
  if (!isValidHomeName(senderName)) {
    return Response.json(
      { error: `寄件人名稱「${senderName}」不符宅配規格（4~10 字元，中文以 2 字元計）` },
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
      if (status === 'cancelled' || status === 'refunded' || status === 'returned') {
        skipped.push({ orderNumber, reason: `${status} 訂單不可出貨` })
        continue
      }

      const shippingMethod = order.shippingMethod ?? {}
      const carrier = String(shippingMethod.carrier || '')
      if (!carrierToHomeSubType(carrier)) {
        skipped.push({
          orderNumber,
          reason:
            carrier === 'hct'
              ? '新竹物流綠界不支援發號，請用一般批次出貨填單號'
              : `carrier=${carrier || '(空)'} 不是綠界宅配（tcat/post）`,
        })
        continue
      }
      if (shippingMethod.ecpayLogisticsId) {
        skipped.push({
          orderNumber,
          reason: `已發號（${shippingMethod.ecpayLogisticsId}），不重覆建立`,
        })
        continue
      }

      const addr = order.shippingAddress ?? {}
      const receiverZipCode = String(addr.zipCode || '').trim()
      const receiverAddress = [addr.city, addr.district, addr.address]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .join('')
      if (!receiverZipCode) {
        skipped.push({ orderNumber, reason: '缺收件郵遞區號（宅配必填），請先補在訂單收件地址' })
        continue
      }
      if (receiverAddress.length < 6) {
        skipped.push({ orderNumber, reason: `收件地址過短（${receiverAddress || '空'}）` })
        continue
      }

      const receiverName = sanitizeLogisticsName(String(addr.recipientName || ''))
      const receiverCellPhone = normalizeCellPhone(String(addr.phone || ''))
      if (!receiverName || !receiverCellPhone) {
        skipped.push({ orderNumber, reason: '收件人姓名或手機格式不符（手機須 09 開頭 10 碼）' })
        continue
      }
      if (!isValidHomeName(receiverName)) {
        skipped.push({
          orderNumber,
          reason: `收件人姓名「${receiverName}」不符宅配規格（4~10 字元，中文以 2 字元計）`,
        })
        continue
      }

      const goodsAmount = Math.round(Number(order.total) || 0)
      const isCollection =
        String(order.paymentMethod || '').startsWith('cash') && order.paymentStatus !== 'paid'
      if (carrier === 'post' && isCollection) {
        skipped.push({ orderNumber, reason: '中華郵政不支援代收貨款（貨到付款單請改黑貓或先收款）' })
        continue
      }
      if (isCollection && goodsAmount > TCAT_COD_MAX) {
        skipped.push({ orderNumber, reason: `代收金額 ${goodsAmount} 超過黑貓上限 ${TCAT_COD_MAX}` })
        continue
      }
      if (goodsAmount < 1) {
        skipped.push({ orderNumber, reason: `金額 ${goodsAmount} 不可小於 1` })
        continue
      }

      const params = buildHomeCreateParams(cfg, {
        orderId: order.id,
        carrier,
        goodsAmount,
        isCollection,
        goodsName: orderNumber,
        senderName,
        senderCellPhone,
        senderZipCode,
        senderAddress,
        receiverName,
        receiverCellPhone,
        receiverZipCode,
        receiverAddress,
        goodsWeight: Number(home.defaultGoodsWeight) || 1,
        temperature: home.temperature || '0001',
        specification: home.specification || '0001',
        serverReplyURL,
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
          },
          trackingNumber: result.bookingNote || result.allPayLogisticsID,
          status: 'shipped',
        },
      })

      succeeded.push({
        orderNumber,
        allPayLogisticsID: result.allPayLogisticsID,
        bookingNote: result.bookingNote,
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
