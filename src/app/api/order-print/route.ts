/**
 * Order Print API - Generates printable packing slip / check sheet
 * GET /api/order-print?id=123       — Single order packing slip (HTML)
 * GET /api/order-print?mode=pickup  — Pickup summary report (HTML)
 * GET /api/order-print?mode=pickup&status=processing — Filter by status
 */
import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'

interface OrderItem {
  productName?: string
  variant?: string
  sku?: string
  quantity?: number
  unitPrice?: number
  subtotal?: number
}

interface ShippingAddr {
  recipientName?: string
  phone?: string
  zipCode?: string
  city?: string
  district?: string
  address?: string
}

interface ShippingMethod {
  methodName?: string
  carrier?: string
  convenienceStore?: {
    storeName?: string
    storeId?: string
    storeAddress?: string
  }
}

function formatNTD(n: number) { return `NT$ ${n.toLocaleString('zh-TW')}` }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function pageStyles() {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Noto Sans TC', 'PingFang TC', sans-serif; font-size: 12px; color: #1a1f36; background: #fff; }
      .slip { width: 210mm; max-width: 100%; margin: 0 auto; padding: 20px; page-break-after: always; }
      .slip:last-child { page-break-after: avoid; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C19A5B; padding-bottom: 12px; margin-bottom: 16px; }
      .brand { font-size: 18px; font-weight: 800; color: #C19A5B; letter-spacing: 0.1em; }
      .brand-sub { font-size: 10px; color: #888; margin-top: 2px; }
      .order-num { font-size: 14px; font-weight: 700; text-align: right; }
      .order-date { font-size: 10px; color: #666; margin-top: 2px; }
      .section { margin-bottom: 14px; }
      .section-title { font-size: 11px; font-weight: 700; color: #C19A5B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 11px; }
      .info-label { color: #888; font-weight: 500; }
      .info-value { font-weight: 600; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #f5f3ee; border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 10px; }
      td { border: 1px solid #ddd; padding: 5px 8px; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .totals { margin-top: 8px; text-align: right; }
      .totals .row { display: flex; justify-content: flex-end; gap: 20px; padding: 2px 0; font-size: 11px; }
      .totals .total-final { font-size: 14px; font-weight: 700; border-top: 2px solid #C19A5B; padding-top: 4px; margin-top: 4px; }
      .check-row { display: flex; gap: 30px; margin-top: 12px; font-size: 11px; }
      .check-box { width: 14px; height: 14px; border: 1.5px solid #888; display: inline-block; margin-right: 4px; vertical-align: middle; }
      .footer { margin-top: 20px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 9px; color: #888; text-align: center; }
      .notes { background: #fafaf7; border: 1px solid #eee; border-radius: 4px; padding: 8px; font-size: 10px; margin-top: 6px; }
      @media print {
        body { font-size: 11px; }
        .no-print { display: none; }
        .slip { padding: 10px; }
      }
      .pickup-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      .pickup-table th { background: #1a1f36; color: #fff; padding: 8px 10px; font-size: 11px; border: 1px solid #1a1f36; }
      .pickup-table td { padding: 6px 10px; border: 1px solid #ddd; font-size: 11px; }
      .pickup-table tr:nth-child(even) { background: #f9f8f5; }
      .print-btn { position: fixed; top: 10px; right: 10px; background: #C19A5B; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; z-index: 999; font-weight: 600; }
    </style>
  `
}

function renderSingleOrder(doc: Record<string, unknown>) {
  const orderNumber = (doc.orderNumber as string) || ''
  const createdAt = (doc.createdAt as string) || ''
  const items = (doc.items as OrderItem[]) || []
  const shipping = (doc.shippingAddress as ShippingAddr) || {}
  const shippingMethod = (doc.shippingMethod as ShippingMethod) || {}
  const customer = doc.customer as Record<string, unknown> | undefined
  const customerName = (customer?.name as string) || (shipping.recipientName || '')
  const customerEmail = (customer?.email as string) || ''
  const status = (doc.status as string) || ''
  const paymentMethod = (doc.paymentMethod as string) || ''
  const trackingNumber = (doc.trackingNumber as string) || ''
  const customerNote = (doc.customerNote as string) || ''
  const adminNote = (doc.adminNote as string) || ''

  const subtotal = (doc.subtotal as number) || 0
  const discount = (doc.discountAmount as number) || 0
  const shippingFee = (doc.shippingFee as number) || 0
  const total = (doc.total as number) || 0
  const pointsUsed = (doc.pointsUsed as number) || 0
  const creditUsed = (doc.creditUsed as number) || 0

  const store = shippingMethod.convenienceStore

  return `
    <div class="slip">
      <div class="header">
        <div>
          <div class="brand">CHIC KIM &amp; MIU</div>
          <div class="brand-sub">Packing Slip / Check Sheet</div>
        </div>
        <div>
          <div class="order-num">${orderNumber}</div>
          <div class="order-date">${createdAt ? formatDate(createdAt) : ''}</div>
          <div style="font-size:10px;margin-top:2px;color:#888">Status: ${status}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Customer / Shipping Info</div>
        <div class="info-grid">
          <div><span class="info-label">Name:</span> <span class="info-value">${shipping.recipientName || customerName}</span></div>
          <div><span class="info-label">Phone:</span> <span class="info-value">${shipping.phone || ''}</span></div>
          <div><span class="info-label">Email:</span> <span class="info-value">${customerEmail}</span></div>
          <div><span class="info-label">Payment:</span> <span class="info-value">${paymentMethod}</span></div>
          <div style="grid-column:1/-1"><span class="info-label">Address:</span> <span class="info-value">${shipping.zipCode || ''} ${shipping.city || ''} ${shipping.district || ''} ${shipping.address || ''}</span></div>
          ${shippingMethod.methodName ? `<div><span class="info-label">Shipping:</span> <span class="info-value">${shippingMethod.methodName}</span></div>` : ''}
          ${store?.storeName ? `<div><span class="info-label">Store:</span> <span class="info-value">${store.storeName} (${store.storeId || ''})</span></div>` : ''}
          ${store?.storeAddress ? `<div style="grid-column:1/-1"><span class="info-label">Store Addr:</span> <span class="info-value">${store.storeAddress}</span></div>` : ''}
          ${trackingNumber ? `<div><span class="info-label">Tracking:</span> <span class="info-value">${trackingNumber}</span></div>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Order Items</div>
        <table>
          <thead>
            <tr>
              <th style="width:5%">#</th>
              <th style="width:35%">Product</th>
              <th style="width:15%">Variant</th>
              <th style="width:12%">SKU</th>
              <th class="text-center" style="width:8%">Qty</th>
              <th class="text-right" style="width:12%">Price</th>
              <th class="text-right" style="width:13%">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td>${item.productName || ''}</td>
                <td>${item.variant || ''}</td>
                <td style="font-family:monospace;font-size:10px">${item.sku || ''}</td>
                <td class="text-center" style="font-weight:700">${item.quantity || 0}</td>
                <td class="text-right">${formatNTD(item.unitPrice || 0)}</td>
                <td class="text-right">${formatNTD(item.subtotal || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="row"><span>Subtotal:</span> <span>${formatNTD(subtotal)}</span></div>
          ${discount > 0 ? `<div class="row"><span>Discount:</span> <span style="color:#c62828">-${formatNTD(discount)}</span></div>` : ''}
          ${pointsUsed > 0 ? `<div class="row"><span>Points Used:</span> <span>-${pointsUsed} pts</span></div>` : ''}
          ${creditUsed > 0 ? `<div class="row"><span>Credit Used:</span> <span>-${formatNTD(creditUsed)}</span></div>` : ''}
          <div class="row"><span>Shipping:</span> <span>${formatNTD(shippingFee)}</span></div>
          <div class="row total-final"><span>Total:</span> <span>${formatNTD(total)}</span></div>
        </div>
      </div>

      ${customerNote ? `<div class="section"><div class="section-title">Customer Note</div><div class="notes">${customerNote}</div></div>` : ''}
      ${adminNote ? `<div class="section"><div class="section-title">Admin Note (Internal)</div><div class="notes">${adminNote}</div></div>` : ''}

      <div class="check-row">
        <div><span class="check-box"></span> Items Verified</div>
        <div><span class="check-box"></span> Packed</div>
        <div><span class="check-box"></span> Label Attached</div>
        <div><span class="check-box"></span> Shipped</div>
        <div style="margin-left:auto">Packed by: ____________</div>
      </div>

      <div class="footer">
        CHIC KIM &amp; MIU &mdash; Printed ${new Date().toLocaleDateString('zh-TW')} &mdash; Internal use only
      </div>
    </div>
  `
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const orderId = searchParams.get('id')
    const statusFilter = searchParams.get('status')

    // ── Mode: Pickup Summary Report ──
    if (mode === 'pickup') {
      const whereClause: Where = statusFilter
        ? { status: { equals: statusFilter } }
        : { status: { in: ['pending', 'processing'] } }

      const orders = await payload.find({
        collection: 'orders',
        where: whereClause,
        limit: 500,
        depth: 1,
        sort: '-createdAt',
      })

      const docs = orders.docs as unknown as Array<Record<string, unknown>>

      // Group by shipping method / carrier
      const groups: Record<string, Array<Record<string, unknown>>> = {}
      for (const doc of docs) {
        const sm = (doc.shippingMethod as ShippingMethod) || {}
        const key = sm.methodName || sm.carrier || 'Other'
        if (!groups[key]) groups[key] = []
        groups[key].push(doc)
      }

      const totalItems = docs.reduce((sum, doc) => {
        const items = (doc.items as OrderItem[]) || []
        return sum + items.reduce((s, i) => s + (i.quantity || 0), 0)
      }, 0)

      let groupsHtml = ''
      for (const [groupName, groupDocs] of Object.entries(groups)) {
        groupsHtml += `
          <h3 style="margin:20px 0 8px;font-size:14px;color:#C19A5B;border-bottom:2px solid #C19A5B;padding-bottom:4px">
            ${groupName} (${groupDocs.length} orders)
          </h3>
          <table class="pickup-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Order #</th>
                <th>Recipient</th>
                <th>Phone</th>
                <th>Store / Address</th>
                <th>Items</th>
                <th>Total</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              ${groupDocs.map((doc, i) => {
                const shipping = (doc.shippingAddress as ShippingAddr) || {}
                const sm = (doc.shippingMethod as ShippingMethod) || {}
                const store = sm.convenienceStore
                const items = (doc.items as OrderItem[]) || []
                const itemCount = items.reduce((s, it) => s + (it.quantity || 0), 0)
                const addr = store?.storeName
                  ? `${store.storeName} (${store.storeId || ''})`
                  : `${shipping.city || ''} ${shipping.district || ''} ${shipping.address || ''}`
                return `
                  <tr>
                    <td class="text-center">${i + 1}</td>
                    <td style="font-family:monospace;font-weight:600">${doc.orderNumber || ''}</td>
                    <td>${shipping.recipientName || ''}</td>
                    <td>${shipping.phone || ''}</td>
                    <td>${addr}</td>
                    <td class="text-center">${itemCount}</td>
                    <td class="text-right" style="font-weight:600">${formatNTD((doc.total as number) || 0)}</td>
                    <td class="text-center"><span class="check-box"></span></td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        `
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pickup Summary - CHIC KIM &amp; MIU</title>${pageStyles()}</head><body>
        <button class="print-btn no-print" onclick="window.print()">Print</button>
        <div style="max-width:210mm;margin:0 auto;padding:20px">
          <div class="header">
            <div>
              <div class="brand">CHIC KIM &amp; MIU</div>
              <div class="brand-sub">Pickup Summary Report</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;font-weight:600">${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div style="font-size:11px;color:#666">${docs.length} orders / ${totalItems} items</div>
              <div style="font-size:10px;color:#888">Status: ${statusFilter || 'pending + processing'}</div>
            </div>
          </div>
          ${groupsHtml}
          <div class="footer" style="margin-top:30px">
            CHIC KIM &amp; MIU &mdash; Generated ${new Date().toLocaleString('zh-TW')} &mdash; Internal use only
          </div>
        </div>
      </body></html>`

      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // ── Mode: Single Order Print ──
    if (orderId) {
      const doc = await payload.findByID({ collection: 'orders', id: parseInt(orderId), depth: 2 })
      if (!doc) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${(doc as unknown as Record<string, unknown>).orderNumber} - CHIC KIM &amp; MIU</title>${pageStyles()}</head><body>
        <button class="print-btn no-print" onclick="window.print()">Print</button>
        ${renderSingleOrder(doc as unknown as Record<string, unknown>)}
      </body></html>`

      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // ── Mode: Batch print multiple orders ──
    const ids = searchParams.get('ids')
    if (ids) {
      const idList = ids.split(',').map(id => parseInt(id.trim())).filter(Boolean)
      const slips: string[] = []
      for (const id of idList) {
        try {
          const doc = await payload.findByID({ collection: 'orders', id, depth: 2 })
          slips.push(renderSingleOrder(doc as unknown as Record<string, unknown>))
        } catch { /* skip */ }
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Batch Print - CHIC KIM &amp; MIU</title>${pageStyles()}</head><body>
        <button class="print-btn no-print" onclick="window.print()">Print All (${slips.length})</button>
        ${slips.join('')}
      </body></html>`

      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    return NextResponse.json({ error: 'Provide ?id=<orderId> or ?mode=pickup' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
