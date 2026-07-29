import type { Payload } from 'payload'
import { emailWrapper } from './_shared'

/**
 * Admin 發票重試失敗警示（admin）
 *
 * 觸發：/api/cron/retry-invoices 一輪重試後仍有失敗發票時。
 * 收件人 = OrderSettings.notifications.adminAlertEmails（共用訂單的 admin 通知列表）。
 * 電子發票有 48 小時開立上傳時限，失敗必須有人工介入的訊號。
 *
 * Fire-and-forget：caller 用 .catch 接。
 */

function adminInvoicesUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(
    /\/$/,
    '',
  )
  return `${base}/admin/collections/invoices?where[status][equals]=failed`
}

export async function sendAdminInvoiceRetryAlert(
  payload: Payload,
  result: { retried: number; succeeded: number; failed: number },
  toEmails: string[],
): Promise<void> {
  if (!toEmails || toEmails.length === 0) return

  // 全部 failed 存量（含已達重試上限、需人工處理的張數）給 admin 完整視角
  let failedBacklog = 0
  try {
    const backlog = await payload.count({
      collection: 'invoices',
      where: { status: { equals: 'failed' } },
    })
    failedBacklog = backlog.totalDocs
  } catch {
    failedBacklog = 0
  }

  const subject = `【CKMU 後台】電子發票開立重試失敗 ${result.failed} 張，請人工處理`
  const preheader = `本輪重試 ${result.retried} 張：成功 ${result.succeeded}、失敗 ${result.failed}；failed 存量 ${failedBacklog} 張`

  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      系統剛完成一輪電子發票自動重試，仍有發票開立失敗。<br />
      提醒：B2C 電子發票有 <strong>48 小時</strong>開立上傳時限，重試 3 次仍失敗的發票不會再自動重試，請儘速人工處理（後台重開或至綠界廠商後台補開）。
    </p>

    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0">
      <div style="font-size:12px;color:#999;margin-bottom:6px">本輪重試</div>
      <div style="font-size:15px;font-weight:600">${result.retried} 張（成功 ${result.succeeded}／失敗 ${result.failed}）</div>
      <div style="font-size:12px;color:#999;margin:12px 0 6px">目前 failed 存量（含已達重試上限）</div>
      <div style="font-size:15px;font-weight:600;color:#c0392b">${failedBacklog} 張</div>
    </div>

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${adminInvoicesUrl()}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看失敗發票</a>
    </div>`

  await payload.sendEmail({
    to: toEmails.join(','),
    subject,
    html: emailWrapper({
      headline: '電子發票重試失敗警示',
      preheader,
      content,
    }),
  })
}
