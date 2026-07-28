import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'
import { loadEcpayLogisticsConfig } from '@/lib/logistics/ecpayLogisticsMap'
import {
  buildReturnHomeParams,
  carrierToHomeSubType,
  createReturnHome,
  formatLogisticsTradeDate,
  isValidHomeName,
  normalizeCellPhone,
  sanitizeLogisticsName,
} from '@/lib/logistics/ecpayExpress'

/**
 * POST /api/admin/orders/return-ship — 宅配退貨（綠界 /Express/ReturnHome，僅黑貓）。
 * 對已發號的宅配訂單建「逆物流託運單」：黑貓去顧客地址收退貨、
 * 送回商家（訂單設定→宅配託運寄件人）。成功只回 1|OK（綠界不回
 * 新單號），之後貨態由逆物流狀態通知打回 /api/logistics/ecpay/status，
 * 以原 AllPayLogisticsID 對回訂單、寫進 returnLogisticsStatus。
 *
 * 超商 C2C 沒有逆物流 API：買家未取會自動退回寄件門市（7-11 可在
 * 發號時帶 ReturnStoreID 指定退貨門市，訂單設定可填），這支只擋不做。
 */

type Body = { orderNumbers?: string[] }

type ResultRow = { orderNumber: string; reason?: string }

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
      { error: '綠界物流憑證尚未設定（ECPAY_LOGISTICS_*），無法建退貨單' },
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
  }
  const merchantName = String(home.senderName || '').trim()
  const merchantCellPhone = normalizeCellPhone(home.senderCellPhone || '')
  const merchantZipCode = String(home.senderZipCode || '').trim()
  const merchantAddress = String(home.senderAddress || '').trim()
  if (!merchantName || !merchantCellPhone || !merchantZipCode || merchantAddress.length < 6) {
    return Response.json(
      { error: '請先到「訂單設定 → 宅配託運寄件人」填齊名稱/手機/郵遞區號/地址（退貨收件人用這組）' },
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

      const sm = order.shippingMethod ?? {}
      const carrier = String(sm.carrier || '')
      if (!carrierToHomeSubType(carrier)) {
        skipped.push({
          orderNumber,
          reason: ['711', 'family', 'hilife'].includes(carrier)
            ? '超商 C2C 無逆物流 API：買家未取會自動退回寄件門市（7-11 退貨門市在訂單設定指定）'
            : `carrier=${carrier || '(空)'} 不是綠界宅配，無法建退貨單`,
        })
        continue
      }
      if (carrier === 'post') {
        skipped.push({ orderNumber, reason: '綠界逆物流僅支援黑貓（TCAT），郵政退貨請人工處理' })
        continue
      }
      if (!sm.ecpayLogisticsId) {
        skipped.push({ orderNumber, reason: '此訂單沒發過號（無 AllPayLogisticsID），無法建退貨單' })
        continue
      }
      if (sm.returnLogisticsId) {
        skipped.push({ orderNumber, reason: `已建過退貨單（${sm.returnLogisticsId}），不重覆建立` })
        continue
      }

      const addr = order.shippingAddress ?? {}
      const customerName = sanitizeLogisticsName(String(addr.recipientName || ''))
      const customerCellPhone = normalizeCellPhone(String(addr.phone || ''))
      const customerZipCode = String(addr.zipCode || '').trim()
      const customerAddress = [addr.city, addr.district, addr.address]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .join('')
      if (!customerName || !customerCellPhone) {
        skipped.push({ orderNumber, reason: '顧客姓名或手機格式不符，無法當退貨寄件人' })
        continue
      }
      if (!isValidHomeName(customerName)) {
        skipped.push({
          orderNumber,
          reason: `顧客姓名「${customerName}」不符宅配規格（4~10 字元）`,
        })
        continue
      }
      if (!customerZipCode || customerAddress.length < 6) {
        skipped.push({ orderNumber, reason: '顧客地址/郵遞區號不齊，無法建退貨單' })
        continue
      }

      const goodsAmount = Math.min(Math.max(Math.round(Number(order.total) || 0), 1), 20000)
      const params = buildReturnHomeParams(cfg, {
        allPayLogisticsID: sm.ecpayLogisticsId,
        goodsAmount,
        goodsName: orderNumber,
        senderName: customerName,
        senderCellPhone: customerCellPhone,
        senderZipCode: customerZipCode,
        senderAddress: customerAddress,
        receiverName: merchantName,
        receiverCellPhone: merchantCellPhone,
        receiverZipCode: merchantZipCode,
        receiverAddress: merchantAddress,
        temperature: home.temperature || '0001',
        specification: home.specification || '0001',
        serverReplyURL,
        remark: `退貨 ${orderNumber}`,
      })
      const result = await createReturnHome(cfg, params)
      if (!result.ok) {
        skipped.push({ orderNumber, reason: `綠界退貨建單失敗：${result.error}` })
        continue
      }

      // ReturnHome 成功只回 1|OK，沒有新單號——標記建立時間，
      // 後續貨態靠逆物流狀態通知（同一支 status callback）補寫。
      const stamp = formatLogisticsTradeDate()
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: {
          shippingMethod: {
            ...sm,
            returnLogisticsId: `RH@${stamp}`,
            returnLogisticsStatus: `已建立退貨託運單|${stamp}`,
          },
        },
      })

      succeeded.push({ orderNumber })
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
