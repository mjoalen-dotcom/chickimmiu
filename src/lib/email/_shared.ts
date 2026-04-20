import type { Payload } from 'payload'

/**
 * 訂單 email 共用工具 — 給 orderConfirmation / orderShipped / orderCancelled /
 * orderRefunded / adminNewOrderAlert 共用的型別 + helper + CKMU HTML wrapper。
 *
 * 這支檔案**不直接寄信**，只負責：
 *   - shape 定義（OrderItem / ShippingAddress / ShippingMethod）
 *   - utility (ntd 金額 / escapeHtml / renderItemsTable / renderAddress)
 *   - 顧客 email 抓取（從 order.customer relationship）
 *   - emailWrapper — 統一 CKMU header + footer
 *
 * 寄信動作由個別 send<Kind>Email() 負責。
 */

export type OrderItem = {
  productName?: string
  variant?: string
  sku?: string
  quantity?: number
  unitPrice?: number
  subtotal?: number
}

export type ShippingAddress = {
  recipientName?: string
  phone?: string
  zipCode?: string
  city?: string
  district?: string
  address?: string
}

export type ShippingMethod = {
  methodName?: string
  carrier?: string
  convenienceStore?: { storeName?: string; storeId?: string; storeAddress?: string }
  estimatedDays?: string
  trackingNumber?: string
  trackingUrl?: string
}

export const ntd = (n: number | undefined): string =>
  `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const paymentLabelMap: Record<string, string> = {
  paypal: 'PayPal',
  ecpay: '綠界科技 ECPay',
  newebpay: '藍新支付 NewebPay',
  linepay: 'LINE Pay',
  cash_cod: '現金 — 宅配貨到付款',
  cash_meetup: '現金 — 到辦公室取貨付款',
}

export function renderItemsTable(items: OrderItem[]): string {
  const rows = items
    .map((it) => {
      const name = escapeHtml(String(it.productName || '商品'))
      const variant = it.variant
        ? `<div style="color:#999;font-size:12px;margin-top:2px">${escapeHtml(it.variant)}</div>`
        : ''
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

export function renderAddress(
  addr: ShippingAddress | undefined,
  ship: ShippingMethod | undefined,
): string {
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

export function renderTracking(ship: ShippingMethod | undefined): string {
  if (!ship?.trackingNumber) return ''
  const num = escapeHtml(ship.trackingNumber)
  const url = ship.trackingUrl ? escapeHtml(ship.trackingUrl) : null
  return `<div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0">
  <div style="color:#666;font-size:12px;margin-bottom:4px">物流追蹤號</div>
  <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:14px;font-weight:600;color:#c9a961">
    ${num}
  </div>
  ${url ? `<div style="margin-top:8px"><a href="${url}" style="color:#c9a961;text-decoration:none;font-size:13px">點我查詢物流進度 →</a></div>` : ''}
</div>`
}

export async function getCustomerEmailFromOrder(
  payload: Payload,
  order: Record<string, unknown>,
): Promise<{ email?: string; name?: string }> {
  const customer = order.customer as
    | string
    | number
    | { id?: string | number; email?: string; name?: string }
    | undefined
  if (typeof customer === 'object' && customer?.email) {
    return { email: customer.email, name: customer.name }
  }
  if (customer) {
    const customerId =
      typeof customer === 'string' || typeof customer === 'number'
        ? String(customer)
        : String(customer.id ?? '')
    if (customerId) {
      try {
        const fresh = await payload.findByID({ collection: 'users', id: customerId })
        return {
          email: (fresh.email as string | undefined) || undefined,
          name: (fresh.name as string | undefined) || undefined,
        }
      } catch (err) {
        console.error('[email/_shared] 找不到顧客:', err)
      }
    }
  }
  return {}
}

/** 統一 CKMU email HTML wrapper — 外層 header + footer，content 塞 middle。 */
export function emailWrapper(options: {
  headline: string
  preheader?: string
  content: string
}): string {
  const { headline, preheader = '', content } = options
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>${preheader ? `<meta name="description" content="${escapeHtml(preheader)}"/>` : ''}</head>
<body style="margin:0;padding:0;background:#faf6ec;font-family:-apple-system,'Helvetica Neue',Arial,'Microsoft JhengHei',sans-serif;color:#333">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="text-align:center;padding:24px 0">
    <div style="font-size:11px;letter-spacing:0.3em;color:#c9a961">CHIC KIM &amp; MIU</div>
    <div style="font-size:22px;font-weight:300;margin-top:8px">${escapeHtml(headline)}</div>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
${content}
  </div>

  <p style="text-align:center;color:#999;font-size:12px;margin:24px 0 8px;line-height:1.6">
    若有任何訂單疑問，請至「我的帳戶 &gt; 客服中心」聯繫我們。<br/>
    此信件由系統自動發送，請勿直接回覆。
  </p>
  <p style="text-align:center;color:#bbb;font-size:11px;margin:0">CHIC KIM &amp; MIU · chickimmiu.com</p>
</div>
</body></html>`
}

export function orderAccountUrl(orderId?: string | number): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(
    /\/$/,
    '',
  )
  return orderId ? `${base}/account/orders/${orderId}` : `${base}/account/orders`
}

export function adminOrderUrl(orderId: string | number): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(
    /\/$/,
    '',
  )
  return `${base}/admin/collections/orders/${orderId}`
}
