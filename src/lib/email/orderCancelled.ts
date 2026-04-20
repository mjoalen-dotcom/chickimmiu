import type { Payload } from 'payload'
import {
  emailWrapper,
  escapeHtml,
  getCustomerEmailFromOrder,
  ntd,
  orderAccountUrl,
  type OrderItem,
} from './_shared'

/**
 * 訂單取消通知信（status → cancelled 時觸發，無 toggle 控制 — 取消屬重大事件一律寄）
 *
 * Fire-and-forget。會提示已扣的點數 / 購物金是否退還（由 Orders cancel hook 處理
 * 實際退款；本信只做通知）。
 */
export async function sendOrderCancelledEmail(
  payload: Payload,
  order: Record<string, unknown>,
): Promise<void> {
  const { email, name } = await getCustomerEmailFromOrder(payload, order)
  if (!email) {
    console.warn(`[orderCancelled] 訂單 ${order.orderNumber} 無顧客 email，略過`)
    return
  }

  const orderNumber = String(order.orderNumber || '')
  const orderId = order.id as string | number | undefined
  const items = (order.items as OrderItem[] | undefined) || []
  const total = order.total as number | undefined
  const pointsUsed = order.pointsUsed as number | undefined
  const creditUsed = order.creditUsed as number | undefined
  const cancelReason = order.cancelReason as string | undefined
  const itemCount = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0)

  const subject = `【CHIC KIM & MIU】訂單已取消 ${orderNumber}`
  const preheader = `您於 ${orderNumber} 訂購的訂單已取消`

  const refundNote =
    pointsUsed || creditUsed
      ? `<div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;line-height:1.8">
      <div style="color:#666;margin-bottom:6px">已使用資源將退還至您的帳戶：</div>
      ${pointsUsed ? `<div>• 點數 ${pointsUsed} 點</div>` : ''}
      ${creditUsed ? `<div>• 購物金 ${ntd(creditUsed)}</div>` : ''}
      <div style="color:#999;font-size:12px;margin-top:8px">實際入帳時間取決於退款流程，約 1-3 個工作日。</div>
    </div>`
      : ''

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>${escapeHtml(orderNumber)}</strong>（${itemCount} 件商品・${ntd(total)}）已取消處理。
    </p>

    ${cancelReason ? `<div style="background:#fafafa;padding:12px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:#666"><strong>取消原因：</strong> ${escapeHtml(cancelReason)}</div>` : ''}

    ${refundNote}

    <p style="font-size:14px;line-height:1.6;margin:16px 0">
      若此次取消並非您本人操作，請立即與客服聯繫。造成不便敬請見諒。
    </p>

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(orderAccountUrl(orderId))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a>
    </div>`

  await payload.sendEmail({
    to: email,
    subject,
    html: emailWrapper({ headline: '訂單已取消', preheader, content }),
  })
}
