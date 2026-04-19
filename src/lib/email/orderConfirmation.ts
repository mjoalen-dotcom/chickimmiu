import type { Payload } from 'payload'

/**
 * 寄送訂單確認信給顧客（status: pending → processing 時觸發）
 *
 * 用 payload.sendEmail 透過已掛的 Resend adapter 寄出；若 RESEND_API_KEY 未設，
 * payload.config.ts 的 consoleFallback 會把信件內容印到 server log。
 *
 * Fire-and-forget：caller 用 .catch 接，不擋訂單寫入。
 */

type OrderItem = {
  productName?: string
  variant?: string
  sku?: string
  quantity?: number
  unitPrice?: number
  subtotal?: number
}

type ShippingAddress = {
  recipientName?: string
  phone?: string
  zipCode?: string
  city?: string
  district?: string
  address?: string
}

type ShippingMethod = {
  methodName?: string
  carrier?: string
  convenienceStore?: { storeName?: string; storeId?: string; storeAddress?: string }
  estimatedDays?: string
}

const ntd = (n: number | undefined) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function renderItemsTable(items: OrderItem[]): string {
  const rows = items
    .map((it) => {
      const name = escapeHtml(String(it.productName || '商品'))
      const variant = it.variant ? `<div style="color:#999;font-size:12px;margin-top:2px">${escapeHtml(it.variant)}</div>` : ''
      const qty = it.quantity ?? 0
      const sub = ntd(it.subtotal)
      return `<tr>
  <td style="padding:12px 8px;border-bottom:1px solid #eee">${name}${variant}</td>
  <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:center">x${qty}</td>
  <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right">${sub}</td>
</tr>`
    })
    .join('\n')
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">
<thead><tr style="border-bottom:2px solid #c9a961;color:#666">
  <th style="padding:8px;text-align:left;font-size:13px">商品</th>
  <th style="padding:8px;text-align:center;font-size:13px;width:60px">數量</th>
  <th style="padding:8px;text-align:right;font-size:13px;width:100px">小計</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`
}

function renderAddress(addr: ShippingAddress | undefined, ship: ShippingMethod | undefined): string {
  if (!addr && !ship) return ''
  const a = addr || {}
  const s = ship || {}
  const cs = s.convenienceStore
  const isStore = cs?.storeName || cs?.storeId
  const addrLine = isStore
    ? `${escapeHtml(cs?.storeName || '')} ${escapeHtml(cs?.storeId || '')}<br/>${escapeHtml(cs?.storeAddress || '')}`
    : `${escapeHtml(a.zipCode || '')} ${escapeHtml(a.city || '')}${escapeHtml(a.district || '')} ${escapeHtml(a.address || '')}`
  return `<div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0">
  <div style="color:#666;font-size:12px;margin-bottom:6px">配送資訊</div>
  <div style="font-size:14px;line-height:1.6">
    <strong>${escapeHtml(a.recipientName || '')}</strong> ${escapeHtml(a.phone || '')}<br/>
    ${addrLine}
    ${s.methodName ? `<div style="color:#999;font-size:12px;margin-top:6px">${escapeHtml(s.methodName)}${s.estimatedDays ? `・預計 ${escapeHtml(s.estimatedDays)}` : ''}</div>` : ''}
  </div>
</div>`
}

export async function sendOrderConfirmationEmail(
  payload: Payload,
  order: Record<string, unknown>,
): Promise<void> {
  // 取顧客 email — order.customer 可能是 ID 或 populated object
  const customer = order.customer as string | { id?: string; email?: string; name?: string } | undefined
  let email: string | undefined
  let name: string | undefined
  if (typeof customer === 'object' && customer?.email) {
    email = customer.email
    name = customer.name
  } else if (customer) {
    const customerId = typeof customer === 'string' ? customer : customer.id
    if (customerId) {
      try {
        const fresh = await payload.findByID({ collection: 'users', id: customerId })
        email = (fresh.email as string | undefined) || undefined
        name = (fresh.name as string | undefined) || undefined
      } catch (err) {
        console.error('[orderConfirmation] 找不到顧客:', err)
      }
    }
  }

  if (!email) {
    console.warn(`[orderConfirmation] 訂單 ${order.orderNumber} 無顧客 email，略過`)
    return
  }

  const orderNumber = String(order.orderNumber || '')
  const items = (order.items as OrderItem[] | undefined) || []
  const subtotal = order.subtotal as number | undefined
  const discountAmount = order.discountAmount as number | undefined
  const shippingFee = order.shippingFee as number | undefined
  const codFee = order.codFee as number | undefined
  const pointsUsed = order.pointsUsed as number | undefined
  const creditUsed = order.creditUsed as number | undefined
  const total = order.total as number | undefined
  const paymentMethod = order.paymentMethod as string | undefined
  const customerNote = order.customerNote as string | undefined

  const paymentLabelMap: Record<string, string> = {
    paypal: 'PayPal',
    ecpay: '綠界科技 ECPay',
    newebpay: '藍新支付 NewebPay',
    linepay: 'LINE Pay',
    cash_cod: '現金 — 宅配貨到付款',
    cash_meetup: '現金 — 面交付款',
  }

  const subject = `【CHIC KIM & MIU】訂單確認 ${orderNumber}`
  const accountUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(/\/$/, '') +
    '/account/orders'

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#faf6ec;font-family:-apple-system,'Helvetica Neue',Arial,'Microsoft JhengHei',sans-serif;color:#333">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="text-align:center;padding:24px 0">
    <div style="font-size:11px;letter-spacing:0.3em;color:#c9a961">CHIC KIM &amp; MIU</div>
    <div style="font-size:22px;font-weight:300;margin-top:8px">訂單已確認</div>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      感謝您於 CHIC KIM &amp; MIU 訂購，訂單 <strong>${escapeHtml(orderNumber)}</strong> 已收到付款並開始處理。<br/>
      以下為您的訂單明細，請核對是否正確：
    </p>

    ${renderItemsTable(items)}

    <div style="margin:16px 0;padding:12px 0;border-top:1px solid #eee;font-size:14px">
      <div style="display:flex;justify-content:space-between;margin:4px 0"><span>商品小計</span><span>${ntd(subtotal)}</span></div>
      ${discountAmount ? `<div style="display:flex;justify-content:space-between;margin:4px 0;color:#999"><span>折扣</span><span>- ${ntd(discountAmount)}</span></div>` : ''}
      ${shippingFee ? `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>運費</span><span>${ntd(shippingFee)}</span></div>` : ''}
      ${codFee ? `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>COD 手續費</span><span>${ntd(codFee)}</span></div>` : ''}
      ${pointsUsed ? `<div style="display:flex;justify-content:space-between;margin:4px 0;color:#999"><span>使用點數</span><span>- ${pointsUsed}</span></div>` : ''}
      ${creditUsed ? `<div style="display:flex;justify-content:space-between;margin:4px 0;color:#999"><span>使用購物金</span><span>- ${ntd(creditUsed)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;margin:8px 0 0;padding-top:8px;border-top:1px solid #eee;font-weight:600;font-size:16px">
        <span>應付總額</span><span style="color:#c9a961">${ntd(total)}</span>
      </div>
    </div>

    ${paymentMethod ? `<div style="font-size:13px;color:#666;margin:8px 0">付款方式：${escapeHtml(paymentLabelMap[paymentMethod] || paymentMethod)}</div>` : ''}

    ${renderAddress(order.shippingAddress as ShippingAddress | undefined, order.shippingMethod as ShippingMethod | undefined)}

    ${customerNote ? `<div style="background:#fff8e7;padding:12px;border-radius:8px;font-size:13px;color:#666;margin:16px 0"><strong>顧客備註：</strong> ${escapeHtml(customerNote)}</div>` : ''}

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a>
    </div>
  </div>

  <p style="text-align:center;color:#999;font-size:12px;margin:24px 0 8px;line-height:1.6">
    若有任何訂單疑問，請至「我的帳戶 &gt; 客服中心」聯繫我們。<br/>
    此信件由系統自動發送，請勿直接回覆。
  </p>
  <p style="text-align:center;color:#bbb;font-size:11px;margin:0">CHIC KIM &amp; MIU · chickimmiu.com</p>
</div>
</body></html>`

  await payload.sendEmail({
    to: email,
    subject,
    html,
  })
}
