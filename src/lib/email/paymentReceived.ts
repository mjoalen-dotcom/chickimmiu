import type { Payload } from 'payload'
import {
  emailWrapper,
  escapeHtml,
  getCustomerEmailFromOrder,
  ntd,
  orderViewUrl,
  paymentLabelMap,
} from './_shared'
import { renderEmailFromTemplate } from './renderFromTemplate'

/**
 * 付款完成信（paymentStatus unpaid→paid 時觸發）。
 * 線上金流 callback 回填與 admin 手動標記已付款都會走到；與 create 時的
 * 訂單確認信互補——確認信在未付款當下只說「訂單已成立」，這封才宣告收款。
 *
 * Fire-and-forget：caller 用 .catch 接，不擋訂單寫入。
 */
export async function sendPaymentReceivedEmail(
  payload: Payload,
  order: Record<string, unknown>,
): Promise<void> {
  const { email, name } = await getCustomerEmailFromOrder(payload, order)
  if (!email) {
    console.warn(`[paymentReceived] 訂單 ${order.orderNumber} 無顧客 email，略過`)
    return
  }

  const orderNumber = String(order.orderNumber || '')
  const orderId = order.id as string | number | undefined
  const total = order.total as number | undefined
  const method = String(order.paymentMethod || '')
  const paymentLabel = paymentLabelMap[method] || method

  const subject = `【CHIC KIM & MIU】已收到付款 ${orderNumber}`
  const preheader = `訂單 ${orderNumber} 付款完成，我們將盡快為您安排出貨`

  const paymentLine = paymentLabel
    ? `<div style="font-size:13px;color:#666;margin:8px 0">付款方式：${escapeHtml(paymentLabel)}</div>`
    : ''
  const orderButton = `<div style="text-align:center;margin:24px 0 8px"><a href="${escapeHtml(orderViewUrl(order))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a></div>`

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      我們已收到您訂單 <strong>${escapeHtml(orderNumber)}</strong> 的付款
      <strong style="color:#c9a961">${ntd(total)}</strong>，將盡快為您安排出貨。<br/>
      出貨後會再以 Email 通知您物流資訊。
    </p>

    ${paymentLine}

    ${orderButton}

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      點數與會員回饋已同步入帳，可在「我的帳戶」查看。
    </p>`

  // 後台模板優先；無 / 停用 / 出錯 → fallback 上面的 hardcoded content
  const tpl = await renderEmailFromTemplate(payload, 'payment_received', {
    customerName: escapeHtml(name || '會員'),
    orderNumber: escapeHtml(orderNumber),
    total: ntd(total),
    paymentLine,
    orderButton,
  })

  await payload.sendEmail({
    to: email,
    subject: tpl?.subject ?? subject,
    html: tpl?.html ?? emailWrapper({ headline: '付款完成', preheader, content }),
  })
}
