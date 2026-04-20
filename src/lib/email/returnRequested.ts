import type { Payload } from 'payload'
import {
  emailWrapper,
  escapeHtml,
  getCustomerEmailFromOrder,
} from './_shared'

/**
 * 退貨 / 換貨申請確認信（customer）
 *
 * 觸發：Returns / Exchanges collection afterChange，operation === 'create'。
 * 內容：告知申請已收到、單號、待審核狀態、後續流程。
 *
 * Fire-and-forget：caller 用 .catch 接，不擋 collection 寫入。
 */

type Kind = 'return' | 'exchange'

const KIND_LABEL: Record<Kind, { noun: string; number: string; subjectVerb: string }> = {
  return: { noun: '退貨', number: '退貨單號', subjectVerb: '退貨申請已收到' },
  exchange: { noun: '換貨', number: '換貨單號', subjectVerb: '換貨申請已收到' },
}

function orderRecordUrl(
  kind: Kind,
  recordId?: string | number,
): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(
    /\/$/,
    '',
  )
  const seg = kind === 'return' ? 'returns' : 'exchanges'
  return recordId ? `${base}/account/${seg}/${recordId}` : `${base}/account/${seg}`
}

export async function sendReturnRequestedEmail(
  payload: Payload,
  record: Record<string, unknown>,
  kind: Kind,
): Promise<void> {
  const orderRef = record.order as
    | string
    | number
    | Record<string, unknown>
    | undefined
  let order: Record<string, unknown> | null = null
  if (typeof orderRef === 'object' && orderRef !== null) {
    order = orderRef
  } else if (orderRef != null) {
    try {
      order = (await payload.findByID({
        collection: 'orders',
        id: orderRef as string | number,
        depth: 1,
      })) as unknown as Record<string, unknown>
    } catch {
      order = null
    }
  }
  if (!order) {
    console.warn(`[${kind}Requested] 找不到 order，略過`)
    return
  }

  const { email, name } = await getCustomerEmailFromOrder(payload, order)
  if (!email) {
    console.warn(`[${kind}Requested] 無顧客 email，略過`)
    return
  }

  const labels = KIND_LABEL[kind]
  const recordNumber = String(
    record[kind === 'return' ? 'returnNumber' : 'exchangeNumber'] || '',
  )
  const recordId = record.id as string | number | undefined
  const orderNumber = String(order.orderNumber || '')

  const items = (record.items as Array<Record<string, unknown>> | undefined) || []
  const itemCount = items.reduce(
    (sum, it) => sum + ((it.quantity as number) ?? 0),
    0,
  )

  const subject = `【CHIC KIM & MIU】${labels.subjectVerb} ${recordNumber}`
  const preheader = `您的${labels.noun}申請 ${recordNumber}（共 ${itemCount} 件）已成功送出，我們將在 3 個工作天內審核。`

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      我們已收到您的${labels.noun}申請：
    </p>

    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0">
      <div style="font-size:12px;color:#999;margin-bottom:6px">${escapeHtml(labels.number)}</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:15px;font-weight:600;color:#c9a961">
        ${escapeHtml(recordNumber)}
      </div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">原始訂單</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:14px">${escapeHtml(orderNumber)}</div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">${labels.noun}件數</div>
      <div style="font-size:14px">${itemCount} 件</div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">目前狀態</div>
      <div style="font-size:14px;color:#c9a961">待審核</div>
    </div>

    <p style="font-size:13px;color:#666;line-height:1.7;margin:16px 0">
      我們會在 3 個工作天內完成審核。審核結果（核准 / 拒絕）會再以 email 通知，您也可以隨時至「我的帳戶」查看進度。
    </p>

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(orderRecordUrl(kind, recordId))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看${labels.noun}進度</a>
    </div>`

  await payload.sendEmail({
    to: email,
    subject,
    html: emailWrapper({
      headline: `您的${labels.noun}申請已收到`,
      preheader,
      content,
    }),
  })
}
