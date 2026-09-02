import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { textToRichText } from '@/lib/cs/messageBody'

/**
 * POST /api/contact
 * ─────────────────
 * 公開聯絡表單端點。
 *
 * 流程：
 *   1. 驗 name/email/message required + email 格式
 *   2. 建 Conversations + Messages 各一筆（channel=web_form, status=open）
 *   3. Fire-and-forget 寄 admin 通知信（讀 GlobalSettings.businessInfo.email 收件）
 *   4. 回 { ok: true, ticketNumber }
 *
 * 防暴力：無 rate limit（封測期流量低；正式上線再加）。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SUBJECT_LABELS: Record<string, string> = {
  general: '一般諮詢',
  order: '訂單相關',
  shipping: '物流 / 配送',
  return: '退換貨',
  product: '商品諮詢',
  partnership: '合作邀約',
  other: '其他',
}

// 對應 Conversations.category 允許的 enum 值（PG enum，字面值錯會硬報錯）
const CATEGORY_MAP: Record<string, string> = {
  general: 'other',
  order: 'order_inquiry',
  shipping: 'shipping_status',
  return: 'return_exchange',
  product: 'product_recommendation',
  partnership: 'other',
  other: 'other',
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '無法解析請求' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const subject = String(body.subject ?? 'general').trim()
  const message = String(body.message ?? '').trim()

  if (!name || !email || !message) {
    return NextResponse.json({ error: '姓名、信箱與訊息為必填' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '信箱格式不正確' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: '訊息過長（上限 2000 字）' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  const subjectLabel = SUBJECT_LABELS[subject] || '一般諮詢'

  // 建對話 —— 客服中心 v1 的 conversations/messages（v0 的 customer-service-tickets
  // 已 deprecated，兩邊並存會讓客服有兩個收件匣、漏回訊息）。
  // ticketNumber 由 Conversations 的 beforeChange hook 產（CS-YYYY-NNNNN）。
  let ticketNumber = ''
  try {
    const conversation = (await payload.create({
      collection: 'conversations',
      overrideAccess: true,
      depth: 0,
      data: {
        channel: 'web_form',
        status: 'open',
        priority: 'normal',
        unread: true,
        category: CATEGORY_MAP[subject] ?? 'other',
        subject: `${subjectLabel} — ${name}`,
        guestName: name,
        guestEmail: email,
        ...(phone ? { guestPhone: phone } : {}),
      } as never,
    })) as unknown as { id: string | number; ticketNumber?: string }

    ticketNumber = conversation.ticketNumber || String(conversation.id)

    await payload.create({
      collection: 'messages',
      overrideAccess: true,
      depth: 0,
      data: {
        conversation: conversation.id,
        direction: 'in',
        sender: 'customer',
        body: textToRichText(message),
      } as never,
    })
  } catch (err) {
    payload.logger.error({ err, msg: 'contact: 建立對話失敗' })
    return NextResponse.json({ error: '系統忙碌中，請稍後再試' }, { status: 500 })
  }

  // 寄 admin 通知（fire-and-forget）
  void (async () => {
    try {
      const settings = (await payload.findGlobal({
        slug: 'global-settings',
        depth: 0,
      })) as unknown as { businessInfo?: { email?: string } }
      const adminEmail = settings.businessInfo?.email
      if (!adminEmail) return
      const escapeHtml = (s: string) =>
        s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
      await payload.sendEmail({
        to: adminEmail,
        subject: `[聯絡表單] ${ticketNumber} · ${subjectLabel}`,
        html: `<!DOCTYPE html><html><body style="font-family:-apple-system,'Helvetica Neue',Arial,'Microsoft JhengHei',sans-serif;color:#333;padding:24px">
<h2 style="color:#c9a961;font-weight:300">新的客服訊息</h2>
<div style="background:#fafafa;padding:16px;border-radius:8px;line-height:1.8;font-size:14px">
  <div><strong>${escapeHtml(ticketNumber)}</strong></div>
  <div>姓名：${escapeHtml(name)}</div>
  <div>信箱：<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
  ${phone ? `<div>電話：${escapeHtml(phone)}</div>` : ''}
  <div>類別：${escapeHtml(subjectLabel)}</div>
</div>
<div style="margin-top:16px;padding:16px;border:1px solid #eee;border-radius:8px;font-size:14px;line-height:1.8;white-space:pre-wrap">${escapeHtml(message)}</div>
<p style="color:#999;font-size:12px;margin-top:16px">請至後台「③ 會員與 CRM → 對話」處理此工單。</p>
</body></html>`,
      })
    } catch (err) {
      payload.logger.error({ err, msg: 'contact: admin 通知寄送失敗' })
    }
  })()

  return NextResponse.json({ ok: true, ticketNumber })
}
