import type { Payload } from 'payload'
import { emailWrapper, escapeHtml, ntd } from './_shared'
import { renderEmailFromTemplate } from './renderFromTemplate'
import type { SubDoc, PlanDoc } from '../subscription/activate'

/**
 * 訂閱收據信（開通 kind='first' / 每期續扣 kind='renewal'）。
 * Fire-and-forget：caller 用 .catch 接，不擋 callback 回應。
 */
export async function sendSubscriptionReceiptEmail(
  payload: Payload,
  sub: SubDoc,
  plan: PlanDoc | null,
  opts: { kind: 'first' | 'renewal'; creditGranted: number },
): Promise<void> {
  const userId = typeof sub.user === 'object' ? sub.user.id : sub.user
  const user = (await payload.findByID({ collection: 'users', id: userId, depth: 0 })) as unknown as {
    email?: string
    name?: string
  }
  if (!user?.email) {
    console.warn(`[subscriptionReceipt] sub=${sub.id} 無會員 email，略過`)
    return
  }

  const planName = plan?.name || '訂閱方案'
  const periods = Number(sub.ecpay?.totalSuccessTimes) || 1
  const statusLine = opts.kind === 'first' ? '訂閱已開通' : `第 ${periods} 期扣款成功`
  const validUntil = sub.currentPeriodEnd ? sub.currentPeriodEnd.slice(0, 10) : '—'
  const streak = String(sub.streakMonths ?? 0)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(/\/$/, '')

  const creditLine =
    opts.creditGranted > 0
      ? `<div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;line-height:1.8"><div style="color:#666">本期購物金已入帳：</div><div>• ${ntd(opts.creditGranted)}</div></div>`
      : ''
  const subscriptionButton = `<div style="text-align:center;margin:24px 0 8px"><a href="${siteUrl}/account/subscription" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">管理訂閱</a></div>`

  const subject = `【CHIC KIM & MIU】訂閱收據 — ${planName}`
  const preheader = `${statusLine}，權益有效至 ${validUntil}`
  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(user.name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的 <strong>${escapeHtml(planName)}</strong> ${escapeHtml(statusLine)}，本期金額
      <strong style="color:#c9a961">${ntd(sub.amount)}</strong>。<br/>
      會員權益有效至 <strong>${escapeHtml(validUntil)}</strong>，目前已連續訂閱 ${escapeHtml(streak)} 個月。
    </p>

    ${creditLine}

    ${subscriptionButton}

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      您可隨時於「我的訂閱」查看權益或取消訂閱；取消後已付期間權益仍保留至到期日。
    </p>`

  const tpl = await renderEmailFromTemplate(payload, 'subscription_receipt', {
    customerName: escapeHtml(user.name || '會員'),
    planName: escapeHtml(planName),
    statusLine: escapeHtml(statusLine),
    amount: ntd(sub.amount),
    validUntil: escapeHtml(validUntil),
    streakMonths: escapeHtml(streak),
    creditLine,
    subscriptionButton,
  })

  await payload.sendEmail({
    to: user.email,
    subject: tpl?.subject ?? subject,
    html: tpl?.html ?? emailWrapper({ headline: '訂閱收據', preheader, content }),
  })
}
