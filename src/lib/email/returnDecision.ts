import type { Payload } from 'payload'
import {
  emailWrapper,
  escapeHtml,
  getCustomerEmailFromOrder,
  ntd,
} from './_shared'

/**
 * 退貨 / 換貨審核結果信（customer）
 *
 * 觸發：Returns / Exchanges collection afterChange，status 變為：
 *   - 'approved'  → 審核通過
 *   - 'rejected'  → 未通過
 *   - 'refunded'  (returns only) / 'completed' (exchanges only) → 完成
 *
 * 單一入口 sendReturnDecisionEmail，依 kind + status 產出對應文案。
 *
 * Fire-and-forget：caller 用 .catch 接。
 */

type Kind = 'return' | 'exchange'
type Decision = 'approved' | 'rejected' | 'finalized' // finalized = refunded (return) or completed (exchange)

const SEG: Record<Kind, string> = { return: 'returns', exchange: 'exchanges' }
const NOUN: Record<Kind, string> = { return: '退貨', exchange: '換貨' }

function recordUrl(kind: Kind, recordId?: string | number): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(
    /\/$/,
    '',
  )
  return recordId
    ? `${base}/account/${SEG[kind]}/${recordId}`
    : `${base}/account/${SEG[kind]}`
}

function headlineFor(kind: Kind, decision: Decision): string {
  const noun = NOUN[kind]
  if (decision === 'approved') return `您的${noun}申請已核准`
  if (decision === 'rejected') return `您的${noun}申請結果通知`
  // finalized
  return kind === 'return' ? '您的退款已完成' : '您的換貨已完成'
}

function subjectFor(
  kind: Kind,
  decision: Decision,
  recordNumber: string,
): string {
  const noun = NOUN[kind]
  if (decision === 'approved')
    return `【CHIC KIM & MIU】${noun}申請已核准 ${recordNumber}`
  if (decision === 'rejected')
    return `【CHIC KIM & MIU】${noun}申請結果通知 ${recordNumber}`
  return kind === 'return'
    ? `【CHIC KIM & MIU】退款已完成 ${recordNumber}`
    : `【CHIC KIM & MIU】換貨已完成 ${recordNumber}`
}

function bodyFor(
  kind: Kind,
  decision: Decision,
  opts: {
    recordNumber: string
    orderNumber: string
    refundAmount?: number
    refundMethod?: string
    newTrackingNumber?: string
    adminNote?: string
    recordId?: string | number
  },
): string {
  const noun = NOUN[kind]
  const {
    recordNumber,
    orderNumber,
    refundAmount,
    refundMethod,
    newTrackingNumber,
    adminNote,
    recordId,
  } = opts

  const header = `    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0">
      <div style="font-size:12px;color:#999;margin-bottom:6px">${escapeHtml(kind === 'return' ? '退貨單號' : '換貨單號')}</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:15px;font-weight:600;color:#c9a961">
        ${escapeHtml(recordNumber)}
      </div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">原始訂單</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:14px">${escapeHtml(orderNumber)}</div>
    </div>`

  const adminNoteBlock = adminNote
    ? `    <div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:#666;line-height:1.7">
      <div style="font-size:12px;color:#999;margin-bottom:6px">審核備註</div>
      <div>${escapeHtml(adminNote).replace(/\n/g, '<br/>')}</div>
    </div>`
    : ''

  const cta = `    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(recordUrl(kind, recordId))}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看${noun}進度</a>
    </div>`

  if (decision === 'approved') {
    const nextStep =
      kind === 'return'
        ? `請將退貨商品於 7 天內寄回下列地址：<br/><strong>台北市信義區 (待告知確認寄送地址)</strong><br/>我們收到退貨後會儘快完成退款。`
        : `請將原商品於 7 天內寄回下列地址：<br/><strong>台北市信義區 (待告知確認寄送地址)</strong><br/>我們收到後會將新款式寄出給您。`
    return `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的${noun}申請已審核通過。感謝您的耐心等候。
    </p>
${header}
    <p style="font-size:13px;color:#666;line-height:1.7;margin:16px 0">${nextStep}</p>
${adminNoteBlock}
${cta}`
  }

  if (decision === 'rejected') {
    return `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      感謝您的申請。很遺憾，您的${noun}申請經審核後未能通過。
    </p>
${header}
${adminNoteBlock}
    <p style="font-size:13px;color:#666;line-height:1.7;margin:16px 0">
      若您對審核結果有任何疑問，歡迎至「我的帳戶 &gt; 客服中心」與我們聯繫，我們將儘快協助您。
    </p>
${cta}`
  }

  // finalized
  if (kind === 'return') {
    const amountLine =
      typeof refundAmount === 'number' && refundAmount > 0
        ? `<div style="font-size:12px;color:#999;margin:12px 0 6px">退款金額</div>
      <div style="font-size:16px;font-weight:600;color:#c9a961">${ntd(refundAmount)}</div>`
        : ''
    const methodLabel =
      refundMethod === 'original'
        ? '原路退回'
        : refundMethod === 'credit'
          ? '購物金'
          : refundMethod === 'bank_transfer'
            ? '銀行轉帳'
            : ''
    const methodLine = methodLabel
      ? `<div style="font-size:12px;color:#999;margin:12px 0 6px">退款方式</div>
      <div style="font-size:14px">${escapeHtml(methodLabel)}</div>`
      : ''

    return `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的退款已完成，感謝您的耐心等候。
    </p>
    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0">
      <div style="font-size:12px;color:#999;margin-bottom:6px">退貨單號</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:15px;font-weight:600;color:#c9a961">
        ${escapeHtml(recordNumber)}
      </div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">原始訂單</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:14px">${escapeHtml(orderNumber)}</div>
      ${amountLine}
      ${methodLine}
    </div>
${adminNoteBlock}
    <p style="font-size:13px;color:#666;line-height:1.7;margin:16px 0">
      若為原路退回，款項通常 3～10 個工作天內入帳，實際時間請依發卡銀行 / 付款平台為準。
    </p>
${cta}`
  }

  // exchange finalized
  const trackingLine = newTrackingNumber
    ? `<div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0">
      <div style="color:#666;font-size:12px;margin-bottom:4px">新品物流追蹤號</div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:14px;font-weight:600;color:#c9a961">
        ${escapeHtml(newTrackingNumber)}
      </div>
    </div>`
    : ''
  return `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的換貨申請已處理完成，新款式商品已寄出。
    </p>
${header}
    ${trackingLine}
${adminNoteBlock}
${cta}`
}

export async function sendReturnDecisionEmail(
  payload: Payload,
  record: Record<string, unknown>,
  kind: Kind,
  decision: Decision,
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
    console.warn(`[${kind}Decision] 找不到 order，略過`)
    return
  }

  const { email } = await getCustomerEmailFromOrder(payload, order)
  if (!email) {
    console.warn(`[${kind}Decision] 無顧客 email，略過`)
    return
  }

  const recordNumber = String(
    record[kind === 'return' ? 'returnNumber' : 'exchangeNumber'] || '',
  )
  const recordId = record.id as string | number | undefined
  const orderNumber = String(order.orderNumber || '')

  const refundAmount = record.refundAmount as number | undefined
  const refundMethod = record.refundMethod as string | undefined
  const newTrackingNumber = record.newTrackingNumber as string | undefined
  const adminNote = record.adminNote as string | undefined

  const headline = headlineFor(kind, decision)
  const subject = subjectFor(kind, decision, recordNumber)
  const preheader = `${NOUN[kind]}單 ${recordNumber} 最新進度`
  const content = bodyFor(kind, decision, {
    recordNumber,
    orderNumber,
    refundAmount,
    refundMethod,
    newTrackingNumber,
    adminNote,
    recordId,
  })

  await payload.sendEmail({
    to: email,
    subject,
    html: emailWrapper({ headline, preheader, content }),
  })
}
