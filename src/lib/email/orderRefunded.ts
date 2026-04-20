import type { Payload } from 'payload'
import {
  emailWrapper,
  escapeHtml,
  getCustomerEmailFromOrder,
  ntd,
  orderAccountUrl,
} from './_shared'

/**
 * 退款通知信（status → refunded 時觸發）
 *
 * Fire-and-forget。實際退款由 Refunds collection 處理；本信只做通知。
 */
export async function sendOrderRefundedEmail(
  payload: Payload,
  order: Record<string, unknown>,
): Promise<void> {
  const { email, name } = await getCustomerEmailFromOrder(payload, order)
  if (!email) {
    console.warn(`[orderRefunded] 訂單 ${order.orderNumber} 無顧客 email，略過`)
    return
  }

  const orderNumber = String(order.orderNumber || '')
  const orderId = order.id as string | number | undefined
  const total = order.total as number | undefined
  const refundAmount = (order.refundAmount as number | undefined) ?? total
  const paymentMethod = order.paymentMethod as string | undefined

  const subject = `【CHIC KIM & MIU】退款已處理 ${orderNumber}`
  const preheader = `您於 ${orderNumber} 的退款 ${ntd(refundAmount)} 已處理`

  const paymentLabelMap: Record<string, string> = {
    paypal: '原付款帳戶 (PayPal)',
    ecpay: '原付款帳戶 (綠界 ECPay)',
    newebpay: '原付款帳戶 (藍新)',
    linepay: '原付款帳戶 (LINE Pay)',
    cash_cod: '購物金（貨到付款無法退至原付款帳戶）',
    cash_meetup: '購物金（面交付款無法退至原付款帳戶）',
  }
  const refundTarget = paymentMethod ? paymentLabelMap[paymentMethod] || paymentMethod : '原付款方式'

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>${escapeHtml(orderNumber)}</strong> 退款已處理完成。
    </p>

    <div style="background:#fff8e7;padding:16px;border-radius:8px;margin:16px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:8px">
        <span style="color:#666">退款金額</span>
        <span style="font-size:20px;font-weight:600;color:#c9a961">${ntd(refundAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:#666">
        <span>退款至</span>
        <span>${escapeHtml(refundTarget)}</span>
      </div>
    </div>

    <p style="font-size:13px;color:#666;line-height:1.6;margin:16px 0">
      信用卡退款約需 <strong>5-10 個工作日</strong> 顯示於帳單；ATM / 電子錢包約 <strong>1-3 個工作日</strong>。購物金則即時入帳。
    </p>

    <p style="font-size:14px;line-height:1.6;margin:16px 0">
      若超過預期時間仍未收到退款，請透過客服中心協助查詢。感謝您的支持。
    </p>

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(orderAccountUrl(orderId))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a>
    </div>`

  await payload.sendEmail({
    to: email,
    subject,
    html: emailWrapper({ headline: '退款已處理', preheader, content }),
  })
}
