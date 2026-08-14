import type { Payload } from 'payload'
import {
  emailWrapper,
  escapeHtml,
  getCustomerEmailFromOrder,
  orderViewUrl,
  type OrderItem,
} from './_shared'
import { renderEmailFromTemplate } from './renderFromTemplate'

/**
 * 送達通知信（status → delivered 時觸發；讀 OrderSettings.notifications.sendDeliveredEmail）
 *
 * Fire-and-forget。鼓勵留評價 / 回購。
 * 後台模板（eventKey order_delivered）優先；無 / 停用 / 出錯 → fallback 內建 HTML。
 */
export async function sendOrderDeliveredEmail(
  payload: Payload,
  order: Record<string, unknown>,
): Promise<void> {
  const { email, name } = await getCustomerEmailFromOrder(payload, order)
  if (!email) {
    console.warn(`[orderDelivered] 訂單 ${order.orderNumber} 無顧客 email，略過`)
    return
  }

  const orderNumber = String(order.orderNumber || '')
  const orderId = order.id as string | number | undefined
  const items = (order.items as OrderItem[] | undefined) || []
  const itemCount = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0)

  const preheader = `您於 ${orderNumber} 訂購的商品已送達`
  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>${escapeHtml(orderNumber)}</strong>（${itemCount} 件商品）已完成配送。<br/>
      希望您喜歡這次的選品！若方便，歡迎到訂單頁留下穿搭評價，分享給其他會員。
    </p>

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(orderViewUrl(order))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a>
    </div>

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      如商品有任何瑕疵，請在簽收後 7 日內透過「我的帳戶 &gt; 我的訂單」申請退換貨。
    </p>`

  const orderButton = `<div style="text-align:center;margin:24px 0 8px"><a href="${escapeHtml(orderViewUrl(order))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a></div>`
  const tpl = await renderEmailFromTemplate(payload, 'order_delivered', {
    customerName: escapeHtml(name || '會員'),
    orderNumber: escapeHtml(orderNumber),
    itemCount: String(itemCount),
    orderButton,
  })

  await payload.sendEmail({
    to: email,
    subject: tpl?.subject ?? `【CHIC KIM & MIU】訂單已送達 ${orderNumber}`,
    html: tpl?.html ?? emailWrapper({ headline: '您的訂單已送達', preheader, content }),
  })
}
