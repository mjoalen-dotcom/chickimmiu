import type { Payload } from 'payload'
import { emailWrapper, escapeHtml, ntd } from './_shared'
import { renderEmailFromTemplate } from './renderFromTemplate'

/**
 * 會員歡迎信（customerRegister 建帳成功後觸發）
 *
 * Fire-and-forget：caller 用 .catch 接，不擋註冊。
 * 交易信性質（legitimate interest）→ 不檢查行銷退訂。
 * 後台模板（eventKey welcome）優先；無 / 停用 / 出錯 → fallback 內建 HTML。
 *
 * 註冊禮（點數 / 購物金）由 customerRegister 實際發放，本信只「告知」金額；
 * 讀 LoyaltySettings.signupReward best-effort，讀失敗 → 不顯示禮物區塊（不擋寄信）。
 */
export async function sendWelcomeEmail(
  payload: Payload,
  user: { id: string | number; email?: string; name?: string },
): Promise<void> {
  const email = user.email
  if (!email) {
    console.warn('[welcome] 會員無 email，略過歡迎信')
    return
  }
  const name = user.name || '會員'
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(/\/$/, '')
  const accountUrl = `${siteUrl}/account`

  // 註冊禮金額（best-effort）
  let rewardBlock = ''
  try {
    const loyalty = (await payload.findGlobal({ slug: 'loyalty-settings', depth: 0 })) as
      | { signupReward?: { enabled?: boolean; points?: number; shoppingCredit?: number } }
      | undefined
    const reward = loyalty?.signupReward
    const pts = Math.max(0, Math.floor(Number(reward?.points ?? 0)))
    const credit = Math.max(0, Math.floor(Number(reward?.shoppingCredit ?? 0)))
    if (reward?.enabled !== false && (pts > 0 || credit > 0)) {
      rewardBlock = `<div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;line-height:1.8">
      <div style="color:#666;margin-bottom:6px">新會員見面禮已入帳：</div>
      ${pts > 0 ? `<div>• 點數 ${pts} 點</div>` : ''}
      ${credit > 0 ? `<div>• 購物金 ${ntd(credit)}</div>` : ''}
    </div>`
    }
  } catch {
    // 讀 loyalty 失敗 → 不顯示禮物區塊
  }

  const preheader = '歡迎加入 CHIC KIM & MIU，您的時尚旅程開始了'
  const content = `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(name)} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      歡迎成為 CHIC KIM &amp; MIU 會員！我們為您準備了來自韓國設計的優雅選品，
      以及會員專屬的點數、優惠與生日禮。期待陪您探索每一季的風格。
    </p>

    ${rewardBlock}

    <div style="text-align:center;margin:24px 0 8px">
      <a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">前往會員中心</a>
    </div>

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      您可在「我的帳戶」管理訂單、收藏、地址與通知偏好。
    </p>`

  const tpl = await renderEmailFromTemplate(payload, 'welcome', {
    customerName: escapeHtml(name),
    accountUrl: escapeHtml(accountUrl),
    rewardBlock,
  })

  await payload.sendEmail({
    to: email,
    subject: tpl?.subject ?? `【CHIC KIM & MIU】歡迎加入，${name}`,
    html: tpl?.html ?? emailWrapper({ headline: '歡迎加入 CHIC KIM & MIU', preheader, content }),
  })
}
