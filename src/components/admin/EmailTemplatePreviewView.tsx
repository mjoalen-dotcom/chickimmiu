import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import EmailTemplatePreviewClient, { type PreviewTemplateMeta } from './EmailTemplatePreviewClient'
import {
  EMAIL_EVENT_KEYS,
  EMAIL_EVENT_LABELS,
  EMAIL_EVENT_VARIABLES,
  ensureDefaultEmailTemplates,
  type EmailEventKey,
} from '@/lib/email/renderFromTemplate'

/**
 * EmailTemplatePreviewView — /admin/tools/email-templates
 * ───────────────────────────────────────────────────────
 * 交易信模板的「預覽 / 測試寄送」入口。
 *
 *   - server view：admin auth gate + DefaultTemplate 外殼 + 進頁時 ensureDefaultEmailTemplates
 *     冪等補齊 9 種預設模板（prod 無需手動 seed）
 *   - client：左選事件 → 右 iframe 即時預覽（用範例變數合併後的完整 HTML）+
 *     「寄測試到我的信箱」+ 可用變數清單 + 編輯此模板連結
 *
 * 對應：
 *   - payload.config.ts admin.components.views.emailTemplates（path /tools/email-templates）
 *   - 預覽 / 測試寄送 API：/api/admin/email-templates/test
 *   - 模板編輯：④ 行銷推廣 → Email 模板 collection
 *
 * ⚠️ 改動 admin.components.* 後務必 `pnpm payload generate:importmap` 並 commit importMap.js。
 */
const EmailTemplatePreviewView: React.FC<AdminViewServerProps> = async ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  const isAdmin = Boolean(user && (user as { role?: string }).role === 'admin')

  const shell = (children: React.ReactNode) => (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      {children}
    </DefaultTemplate>
  )

  if (!isAdmin) {
    return shell(
      <div style={{ padding: 32 }}>
        <p>需要管理員權限。</p>
      </div>,
    )
  }

  const payload = initPageResult.req.payload

  // 進頁冪等補齊 9 種預設（prod 首次進此頁即建立，無需手動 seed）
  try {
    await ensureDefaultEmailTemplates(payload)
  } catch (err) {
    console.error('[EmailTemplatePreviewView] ensureDefaultEmailTemplates 失敗:', err)
  }

  // 載入所有模板列（對應 eventKey → id / enabled / name）
  const found = await payload.find({
    collection: 'email-templates',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const byKey = new Map<string, { id: string | number; name?: string; enabled?: boolean }>()
  for (const d of found.docs as unknown as Array<Record<string, unknown>>) {
    byKey.set(String(d.eventKey), {
      id: d.id as string | number,
      name: d.name as string | undefined,
      enabled: d.enabled as boolean | undefined,
    })
  }

  const templates: PreviewTemplateMeta[] = EMAIL_EVENT_KEYS.map((key: EmailEventKey) => {
    const row = byKey.get(key)
    return {
      eventKey: key,
      label: EMAIL_EVENT_LABELS[key],
      name: row?.name ?? EMAIL_EVENT_LABELS[key],
      enabled: row?.enabled ?? null,
      docId: row?.id != null ? String(row.id) : null,
      variables: EMAIL_EVENT_VARIABLES[key],
    }
  })

  const resendConfigured = Boolean(process.env.RESEND_API_KEY)
  const adminEmail = (user as { email?: string }).email || ''

  return shell(
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
        ✉️ Email 模板預覽 / 測試寄送
      </h1>
      <p
        style={{
          margin: 0,
          marginBottom: 16,
          color: 'var(--theme-elevation-600, #666)',
          fontSize: 14,
        }}
      >
        選事件即時預覽合併後的信件，並可「寄測試到自己的信箱」。要改文案 / 主旨請到{' '}
        <a
          href="/admin/collections/email-templates"
          style={{ color: 'var(--theme-success-600, #16a34a)', textDecoration: 'underline' }}
        >
          ④ 行銷推廣 → Email 模板
        </a>{' '}
        編輯（停用某模板則該事件回退系統預設信）。
      </p>
      {!resendConfigured && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: 'var(--theme-warning-100, #fff8e1)',
            border: '1px solid var(--theme-warning-300, #ffd54f)',
            color: 'var(--theme-warning-900, #5d4037)',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ⚠️ 伺服器尚未設定 <code>RESEND_API_KEY</code>。目前可預覽與測試，但「寄送」只會把內容
          記到 server log（不會真的寄出）。要真正寄信給客戶，請到{' '}
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            resend.com/domains
          </a>{' '}
          驗證寄件 domain，並把 <code>RESEND_API_KEY</code> / <code>EMAIL_FROM_ADDRESS</code> 寫進 prod{' '}
          <code>.env</code> 後 <code>pm2 restart</code>。
        </div>
      )}
      <EmailTemplatePreviewClient
        templates={templates}
        adminEmail={adminEmail}
        resendConfigured={resendConfigured}
      />
    </div>,
  )
}

export default EmailTemplatePreviewView
