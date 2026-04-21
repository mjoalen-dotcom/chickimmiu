import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import config from '@payload-config'

/**
 * POST /api/contact
 * ─────────────────
 * 公開聯絡表單端點。
 *
 * 流程：
 *   1. 驗 name/email/message required + email 格式
 *   2. 建 CustomerServiceTickets 一筆（channel=web_form, status=open）
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

// 對應 CustomerServiceTickets.category 允許的 enum 值
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

  // 產一個簡單工單編號：CS + YYYYMMDD + 4 位隨機
  const now = new Date()
  const yyyymmdd =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  const ticketNumber = `CS${yyyymmdd}${rand}`

  const subjectLabel = SUBJECT_LABELS[subject] || '一般諮詢'

  // 建工單 — overrideAccess 繞 access.create=isAdmin
  // 客戶訊息塞 messages 陣列第 1 則（sender=customer），聯絡資料放開頭兩行
  const contactHeader = `【聯絡人】${name}\n【信箱】${email}${phone ? `\n【電話】${phone}` : ''}\n\n`
  try {
    await payload.create({
      collection: 'customer-service-tickets',
      overrideAccess: true,
      data: {
        ticketNumber,
        channel: 'web_form',
        status: 'open',
        priority: 'normal',
        category: CATEGORY_MAP[subject] ?? 'other',
        subject: `${subjectLabel} — ${name}`,
        messages: [
          {
            sender: 'customer',
            content: contactHeader + message,
            timestamp: now.toISOString(),
          },
        ],
      } as unknown as RequiredDataFromCollectionSlug<'customer-service-tickets'>,
    })
  } catch (err) {
    payload.logger.error({ err, msg: 'contact: 建立工單失敗' })
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
<p style="color:#999;font-size:12px;margin-top:16px">請至後台「客服管理 → 客服工單」處理此工單。</p>
</body></html>`,
      })
    } catch (err) {
      payload.logger.error({ err, msg: 'contact: admin 通知寄送失敗' })
    }
  })()

  return NextResponse.json({ ok: true, ticketNumber })
}
