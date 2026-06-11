import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  EMAIL_EVENT_KEYS,
  buildSampleVars,
  renderTemplateParts,
  renderDefaultTemplate,
  type EmailEventKey,
  type EmailTemplateParts,
} from '@/lib/email/renderFromTemplate'

/**
 * POST /api/admin/email-templates/test
 *
 * 後台「預覽 / 測試寄送」用。需 admin auth。
 *   action: 'preview' → 用範例變數 render 出 { subject, html }（不寄）
 *   action: 'send'    → render 後寄到「登入 admin 自己的信箱」（不寄客戶，安全）
 *
 * 預覽載入該 eventKey 真實儲存的模板列（含停用，看實際內容）；無則用內建預設。
 * 結構化區塊（明細表 / 地址 / 按鈕）由 buildSampleVars 用範例訂單即時 render，
 * previewSample（純量）可覆寫之上。
 */

interface Body {
  action?: 'preview' | 'send'
  eventKey?: EmailEventKey
}

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return Response.json({ error: '權限不足，需 admin 角色' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: '無效的請求內容（JSON parse failed）' }, { status: 400 })
  }

  const eventKey = body?.eventKey
  if (!eventKey || !EMAIL_EVENT_KEYS.includes(eventKey)) {
    return Response.json({ error: '無效的 eventKey' }, { status: 400 })
  }

  // 載入該事件模板（含停用 — 預覽要看真實儲存內容）；無 → 用內建預設
  const found = await payload.find({
    collection: 'email-templates',
    where: { eventKey: { equals: eventKey } },
    limit: 1,
    overrideAccess: true,
  })
  const doc = found.docs?.[0] as
    | (EmailTemplateParts & { enabled?: boolean; previewSample?: unknown })
    | undefined

  const sampleOverride =
    doc?.previewSample && typeof doc.previewSample === 'object'
      ? (doc.previewSample as Record<string, string>)
      : {}
  const vars = { ...buildSampleVars(eventKey), ...sampleOverride }
  const rendered = doc ? renderTemplateParts(doc, vars) : renderDefaultTemplate(eventKey, vars)

  if (body.action === 'preview') {
    return Response.json({
      ok: true,
      subject: rendered.subject,
      html: rendered.html,
      enabled: doc?.enabled ?? null,
      usingDefault: !doc,
    })
  }

  if (body.action === 'send') {
    const to = (user as unknown as { email?: string }).email
    if (!to) {
      return Response.json({ error: '登入帳號無 email，無法測試寄送' }, { status: 400 })
    }
    try {
      // 缺 RESEND_API_KEY 時 console-fallback 只 log 不真寄；有 key 但 domain 未驗證會 502。
      await payload.sendEmail({ to, subject: `[測試] ${rendered.subject}`, html: rendered.html })
    } catch (err) {
      return Response.json(
        {
          error: `寄送失敗：${err instanceof Error ? err.message : String(err)}`,
          hint: '若為 Resend 403／domain 未驗證，請先到 resend.com 驗證寄件 domain 並設定 RESEND_API_KEY / EMAIL_FROM_ADDRESS',
        },
        { status: 502 },
      )
    }
    return Response.json({ ok: true, sentTo: to })
  }

  return Response.json({ error: '不支援的 action（只接受 preview / send）' }, { status: 400 })
}
