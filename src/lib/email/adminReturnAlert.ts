import type { Payload } from 'payload'
import { emailWrapper, escapeHtml } from './_shared'

/**
 * Admin 新退貨 / 換貨申請通知（admin）
 *
 * 觸發：Returns / Exchanges collection afterChange，operation === 'create'。
 * 用 OrderSettings.notifications.adminAlertEmails 當收件人（共用訂單的 admin 通知列表）。
 *
 * Fire-and-forget：caller 用 .catch 接。
 */

type Kind = 'return' | 'exchange'

function adminRecordUrl(kind: Kind, recordId: string | number): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(
    /\/$/,
    '',
  )
  const seg = kind === 'return' ? 'returns' : 'exchanges'
  return `${base}/admin/collections/${seg}/${recordId}`
}

const REASON_LABEL: Record<string, string> = {
  defective: '商品瑕疵',
  wrong_size: '尺寸不合',
  color_mismatch: '顏色與圖片不符',
  wrong_item: '收到錯誤商品',
  not_wanted: '不喜歡 / 不需要',
  other: '其他',
}

export async function sendAdminReturnAlert(
  payload: Payload,
  record: Record<string, unknown>,
  kind: Kind,
  toEmails: string[],
): Promise<void> {
  if (!toEmails || toEmails.length === 0) return

  const noun = kind === 'return' ? '退貨' : '換貨'
  const recordNumber = String(
    record[kind === 'return' ? 'returnNumber' : 'exchangeNumber'] || '',
  )
  const recordId = record.id as string | number | undefined
  if (!recordId) return

  // Pull order for orderNumber + customer name
  const orderRef = record.order as
    | string
    | number
    | Record<string, unknown>
    | undefined
  let orderNumber = ''
  if (typeof orderRef === 'object' && orderRef !== null) {
    orderNumber = String(orderRef.orderNumber || '')
  } else if (orderRef != null) {
    try {
      const order = (await payload.findByID({
        collection: 'orders',
        id: orderRef as string | number,
        depth: 0,
      })) as unknown as Record<string, unknown>
      orderNumber = String(order?.orderNumber || '')
    } catch {
      orderNumber = ''
    }
  }

  // Pull customer name
  const customerRef = record.customer as
    | string
    | number
    | Record<string, unknown>
    | undefined
  let customerName = '—'
  if (typeof customerRef === 'object' && customerRef !== null) {
    customerName = String(customerRef.name || customerRef.email || '—')
  } else if (customerRef != null) {
    try {
      const u = (await payload.findByID({
        collection: 'users',
        id: customerRef as string | number,
        depth: 0,
      })) as unknown as Record<string, unknown>
      customerName = String(u?.name || u?.email || '—')
    } catch {
      customerName = '—'
    }
  }

  const items = (record.items as Array<Record<string, unknown>> | undefined) || []
  const itemRows = items
    .slice(0, 20) // cap admin display
    .map((it) => {
      const variant = String(
        it.variant || it.originalVariant || '—',
      )
      const newVariant = kind === 'exchange' ? String(it.newVariant || '—') : null
      const qty = (it.quantity as number) ?? 0
      const reason = REASON_LABEL[String(it.reason || '')] || String(it.reason || '—')
      const detail = String(it.reasonDetail || '')
      const detailRow = detail
        ? `<tr><td colspan="3" style="padding:4px 8px 10px;color:#666;font-size:12px;border-bottom:1px solid #eee">備註：${escapeHtml(detail)}</td></tr>`
        : ''
      const newCol = newVariant
        ? `<td style="padding:8px;border-bottom:1px solid #eee;color:#c9a961">→ ${escapeHtml(newVariant)}</td>`
        : ''
      return `<tr>
  <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(variant)}${newCol ? '' : ''}</td>
  ${newCol}
  <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">x${qty}</td>
  <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(reason)}</td>
</tr>${detailRow}`
    })
    .join('\n')

  const tableHeader =
    kind === 'exchange'
      ? `<tr style="border-bottom:2px solid #c9a961;color:#666">
          <th style="padding:8px;text-align:left;font-size:13px">原款式</th>
          <th style="padding:8px;text-align:left;font-size:13px">新款式</th>
          <th style="padding:8px;text-align:center;font-size:13px;width:60px">數量</th>
          <th style="padding:8px;text-align:left;font-size:13px;width:140px">原因</th>
        </tr>`
      : `<tr style="border-bottom:2px solid #c9a961;color:#666">
          <th style="padding:8px;text-align:left;font-size:13px">款式</th>
          <th style="padding:8px;text-align:center;font-size:13px;width:60px">數量</th>
          <th style="padding:8px;text-align:left;font-size:13px;width:140px">原因</th>
        </tr>`

  const subject = `【CKMU 後台】新${noun}申請 ${recordNumber}`
  const preheader = `會員「${customerName}」剛提交${noun}單 ${recordNumber}，原訂單 ${orderNumber}`

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      有會員剛提交新的${noun}申請，請至後台審核：
    </p>

    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0">
      <div style="font-size:12px;color:#999;margin-bottom:6px">${escapeHtml(kind === 'return' ? '退貨單號' : '換貨單號')}</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:15px;font-weight:600;color:#c9a961">
        ${escapeHtml(recordNumber)}
      </div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">原始訂單</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:14px">${escapeHtml(orderNumber)}</div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">申請會員</div>
      <div style="font-size:14px">${escapeHtml(customerName)}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>${tableHeader}</thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(adminRecordUrl(kind, recordId))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">進後台審核</a>
    </div>`

  await payload.sendEmail({
    to: toEmails.join(','),
    subject,
    html: emailWrapper({
      headline: `新${noun}申請待審核`,
      preheader,
      content,
    }),
  })
}
