import type { Payload } from 'payload'
import {
  adminOrderUrl,
  emailWrapper,
  escapeHtml,
  ntd,
  paymentLabelMap,
  type OrderItem,
  type ShippingAddress,
  type ShippingMethod,
} from './_shared'

/**
 * Admin 新單通知信（Orders create 時觸發；讀 OrderSettings.notifications.sendAdminNewOrderAlert
 * + adminAlertEmails）
 *
 * 一次送給多個 admin 信箱（OrderSettings.notifications.adminAlertEmails）。
 * Fire-and-forget。
 */
export async function sendAdminNewOrderAlert(
  payload: Payload,
  order: Record<string, unknown>,
  recipients: string[],
): Promise<void> {
  if (!recipients || recipients.length === 0) {
    console.warn('[adminNewOrderAlert] 無收件人，略過')
    return
  }

  const orderNumber = String(order.orderNumber || '')
  const orderId = order.id as string | number | undefined
  const items = (order.items as OrderItem[] | undefined) || []
  const total = order.total as number | undefined
  const subtotal = order.subtotal as number | undefined
  const paymentMethod = order.paymentMethod as string | undefined
  const paymentStatus = order.paymentStatus as string | undefined
  const shippingMethod = order.shippingMethod as ShippingMethod | undefined
  const shippingAddress = order.shippingAddress as ShippingAddress | undefined
  const customerNote = order.customerNote as string | undefined
  const itemCount = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0)

  // 讀顧客 email + name — admin alert 需要知道是誰下的單
  let customerEmail = ''
  let customerName = ''
  const customer = order.customer as
    | string
    | number
    | { id?: string | number; email?: string; name?: string }
    | undefined
  if (typeof customer === 'object' && customer) {
    customerEmail = customer.email || ''
    customerName = customer.name || ''
  } else if (customer != null) {
    try {
      const fresh = await payload.findByID({ collection: 'users', id: String(customer) })
      customerEmail = (fresh.email as string | undefined) || ''
      customerName = (fresh.name as string | undefined) || ''
    } catch (err) {
      console.error('[adminNewOrderAlert] 查顧客失敗:', err)
    }
  }

  const subject = `[新單] ${orderNumber} · ${ntd(total)} · ${customerName || '會員'}`
  const preheader = `${customerName || '會員'} 剛下一張 ${ntd(total)} 訂單`

  const paymentLabel = paymentMethod
    ? paymentLabelMap[paymentMethod] || paymentMethod
    : '未指定'

  const shippingLabel = shippingMethod?.methodName || '未指定'
  const addrLine =
    shippingMethod?.convenienceStore?.storeName ||
    `${shippingAddress?.city || ''}${shippingAddress?.district || ''} ${shippingAddress?.address || ''}`

  const itemsList = items
    .slice(0, 10)
    .map(
      (it) =>
        `<li style="margin:4px 0;font-size:13px;color:#555">${escapeHtml(String(it.productName || ''))} x${it.quantity ?? 0} · ${ntd(it.subtotal)}</li>`,
    )
    .join('')
  const moreItems = items.length > 10 ? `<li style="color:#999;font-size:12px">…及另外 ${items.length - 10} 筆</li>` : ''

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">收到一筆新訂單，請盡快處理。</p>

    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0;font-size:14px;line-height:1.8">
      <div><strong style="color:#c9a961">${escapeHtml(orderNumber)}</strong></div>
      <div style="margin-top:8px">
        顧客：${escapeHtml(customerName || '會員')} ${customerEmail ? `&lt;${escapeHtml(customerEmail)}&gt;` : ''}<br/>
        件數：${itemCount} 件<br/>
        商品小計：${ntd(subtotal)}<br/>
        訂單金額：<strong style="color:#c9a961">${ntd(total)}</strong><br/>
        付款：${escapeHtml(paymentLabel)}（${escapeHtml(paymentStatus || 'unpaid')}）<br/>
        配送：${escapeHtml(shippingLabel)}<br/>
        地址：${escapeHtml(addrLine)}
      </div>
    </div>

    ${
      items.length > 0
        ? `<div style="margin:16px 0">
      <div style="font-size:13px;color:#666;margin-bottom:6px">商品清單：</div>
      <ul style="margin:0;padding:0 0 0 18px">${itemsList}${moreItems}</ul>
    </div>`
        : ''
    }

    ${customerNote ? `<div style="background:#fff8e7;padding:12px;border-radius:8px;font-size:13px;color:#666;margin:16px 0"><strong>顧客備註：</strong> ${escapeHtml(customerNote)}</div>` : ''}

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${orderId != null ? escapeHtml(adminOrderUrl(orderId)) : '#'}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">開啟後台訂單</a>
    </div>`

  // 逐一寄，任一失敗不影響其他（for loop 隔離錯）
  for (const to of recipients) {
    try {
      await payload.sendEmail({
        to,
        subject,
        html: emailWrapper({ headline: '新訂單通知', preheader, content }),
      })
    } catch (err) {
      console.error(`[adminNewOrderAlert] 寄給 ${to} 失敗:`, err)
    }
  }
}
