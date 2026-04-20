import type { Payload } from 'payload'
import {
  emailWrapper,
  escapeHtml,
  getCustomerEmailFromOrder,
  ntd,
  orderAccountUrl,
  renderAddress,
  renderTracking,
  type OrderItem,
  type ShippingAddress,
  type ShippingMethod,
} from './_shared'

/**
 * 出貨通知信（status → shipped 時觸發；讀 OrderSettings.notifications.sendShippedEmail）
 *
 * Fire-and-forget：caller 用 .catch 接，不擋訂單寫入。
 */
export async function sendOrderShippedEmail(
  payload: Payload,
  order: Record<string, unknown>,
): Promise<void> {
  const { email, name } = await getCustomerEmailFromOrder(payload, order)
  if (!email) {
    console.warn(`[orderShipped] 訂單 ${order.orderNumber} 無顧客 email，略過`)
    return
  }

  const orderNumber = String(order.orderNumber || '')
  const orderId = order.id as string | number | undefined
  const items = (order.items as OrderItem[] | undefined) || []
  const total = order.total as number | undefined
  const shippingMethod = order.shippingMethod as ShippingMethod | undefined
  const shippingAddress = order.shippingAddress as ShippingAddress | undefined
  const itemCount = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0)

  const subject = `【CHIC KIM & MIU】訂單已出貨 ${orderNumber}`
  const preheader = `您於 ${orderNumber} 訂購的 ${itemCount} 件商品已出貨`

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>${escapeHtml(orderNumber)}</strong> 已出貨，共 ${itemCount} 件商品將由物流送達。<br/>
      請留意配送時間，並備妥收件準備。
    </p>

    ${renderTracking(shippingMethod)}

    ${renderAddress(shippingAddress, shippingMethod)}

    <div style="margin:16px 0;padding:12px 16px;background:#fafafa;border-radius:8px;font-size:13px;color:#666">
      訂單金額：<strong style="color:#c9a961">${ntd(total)}</strong>
    </div>

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(orderAccountUrl(orderId))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a>
    </div>

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      若商品有任何損壞或瑕疵，請在簽收後 7 日內透過「我的帳戶 &gt; 我的訂單」申請退換貨。
    </p>`

  await payload.sendEmail({
    to: email,
    subject,
    html: emailWrapper({ headline: '您的訂單已出貨', preheader, content }),
  })
}
