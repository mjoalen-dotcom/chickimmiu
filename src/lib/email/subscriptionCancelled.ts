import type { Payload } from 'payload'
import { emailWrapper, escapeHtml } from './_shared'
import { renderEmailFromTemplate } from './renderFromTemplate'
import type { SubDoc } from '../subscription/activate'

/**
 * 訂閱取消通知信（會員自行取消時）。權益保留至 currentPeriodEnd。
 * Fire-and-forget：caller 用 .catch 接。
 */
export async function sendSubscriptionCancelledEmail(
  payload: Payload,
  sub: SubDoc,
): Promise<void> {
  const userId = typeof sub.user === 'object' ? sub.user.id : sub.user
  const user = (await payload.findByID({ collection: 'customers', id: userId, depth: 0 })) as unknown as {
    email?: string
    name?: string
  }
  if (!user?.email) {
    console.warn(`[subscriptionCancelled] sub=${sub.id} 無會員 email，略過`)
    return
  }

  let planName = '訂閱方案'
  try {
    const planId = typeof sub.plan === 'object' ? sub.plan.id : sub.plan
    const plan = (await payload.findByID({
      collection: 'subscription-plans',
      id: planId,
      depth: 0,
    })) as unknown as { name?: string }
    if (plan?.name) planName = plan.name
  } catch {
    /* 方案已刪仍可寄 */
  }

  const validUntil = sub.currentPeriodEnd ? sub.currentPeriodEnd.slice(0, 10) : '—'
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(/\/$/, '')
  const subscriptionButton = `<div style="text-align:center;margin:24px 0 8px"><a href="${siteUrl}/account/subscription" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂閱</a></div>`

  const subject = `【CHIC KIM & MIU】訂閱已取消 — ${planName}`
  const preheader = `權益保留至 ${validUntil}，期待再次相見`
  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(user.name || '會員')} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的 <strong>${escapeHtml(planName)}</strong> 訂閱已取消，後續將不再扣款。<br/>
      已付期間的會員權益仍保留至 <strong>${escapeHtml(validUntil)}</strong>。
    </p>

    ${subscriptionButton}

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      隨時歡迎回來——重新訂閱即可再次啟用全部會員權益。
    </p>`

  const tpl = await renderEmailFromTemplate(payload, 'subscription_cancelled', {
    customerName: escapeHtml(user.name || '會員'),
    planName: escapeHtml(planName),
    validUntil: escapeHtml(validUntil),
    subscriptionButton,
  })

  await payload.sendEmail({
    to: user.email,
    subject: tpl?.subject ?? subject,
    html: tpl?.html ?? emailWrapper({ headline: '訂閱已取消', preheader, content }),
  })
}
