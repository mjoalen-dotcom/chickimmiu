import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import BlogAIDraftClient from './BlogAIDraftClient'

/**
 * BlogAIDraftView — /admin/tools/blog-ai-draft
 * ────────────────────────────────────────────
 * 內容團隊的「AI 部落格草稿產生器」入口。
 *
 * 為什麼分 server view + client form：
 *   - server view 負責 admin auth gate（未登入 / 非 admin 直接擋）+ DefaultTemplate 套後台外殼
 *   - client form 負責互動：填表 → POST /api/admin/blog/ai-draft (action=generate)
 *     → 看草稿 → 滿意按「建立草稿」(action=create) → redirect 到新 BlogPost 編輯頁
 *
 * 設計取捨：
 *   - 不嵌進 BlogPosts collection 的 edit 頁（Payload v3 admin custom field 比較難
 *     hook 進整份表單的 controlled state），而是獨立 view 讓使用者「先生再貼」
 *   - markdown → Lexical 用 src/lib/blog/aiDraft.ts 內 markdownToBasicLexical 簡易版，
 *     段落 / heading / quote / bullet 可用，作者開草稿後仍可在 Lexical 編輯器內 polish
 *
 * 入口：
 *   - URL: /admin/tools/blog-ai-draft（直連）
 *   - Sidebar: ⑦ 系統工具 → REST API 文件 旁（CKMUSystemToolsNavGroup 第 3 條）
 *
 * 對應 src/payload.config.ts admin.components.views.blogAIDraft。
 */
const BlogAIDraftView: React.FC<AdminViewServerProps> = async ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  const isAdmin = Boolean(user && (user as { role?: string }).role === 'admin')

  if (!isAdmin) {
    return (
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
        <div style={{ padding: 32 }}>
          <p>需要管理員權限。</p>
        </div>
      </DefaultTemplate>
    )
  }

  const groqConfigured = Boolean(process.env.GROQ_API_KEY)
  const defaultTakedownEmail =
    process.env.KIM_BLOG_TAKEDOWN_EMAIL || 'service@chickimmiu.com'

  return (
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
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          📝 金老佛爺自動文章工具
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: 16,
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 14,
          }}
        >
          依金老佛爺版型產生時尚、KPOP 男團或女團介紹；可研究來源、挑選授權圖片，
          並自動輸出 800px／1000px 圖文草稿。所有文章先以「未發布（draft）」保存，
          經人工核實後才可發佈。
        </p>
        {!groqConfigured && (
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
            ⚠️ 伺服器尚未設定 <code>GROQ_API_KEY</code>。請工程師到{' '}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              console.groq.com/keys
            </a>{' '}
            申請 → 寫進 prod <code>.env</code> → <code>pm2 restart</code>。
            Wikimedia 研究與圖片整理仍可使用，但「產生草稿」會回 503。
          </div>
        )}
        <BlogAIDraftClient
          defaultTakedownEmail={defaultTakedownEmail}
          groqConfigured={groqConfigured}
        />
      </div>
    </DefaultTemplate>
  )
}

export default BlogAIDraftView
