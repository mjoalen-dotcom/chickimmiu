import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import LinkIntegrityClient from './LinkIntegrityClient'

/**
 * LinkIntegrityView — /admin/diagnostics/link-integrity
 * ─────────────────────────────────────────────────────
 * 後台連結完整性診斷（Wave 1 PR-ζ）。封測公開營運前快速掃 6 種斷鏈：
 *   1. 商品沒有歸類分類
 *   2. category ref 指向已刪 category（orphan）
 *   3. 重複 slug
 *   4. categories.productCount 與實際 published 計數不符
 *   5. images[] 內 media ref 斷裂
 *   6. aliasSlugs 重複（PR-δ 啟用後才有資料）
 *
 * 結構同其他 admin custom view（HelpView / MemberAnalyticsView / RepeatPurchaseView）：
 *   - server wrapper 套 DefaultTemplate 保留 sidebar / 頁首
 *   - 限 admin role；非 admin 顯示提示
 *   - 真實資料/互動由 LinkIntegrityClient（'use client'）處理
 *
 * 對應 endpoint：GET /api/products/admin/link-integrity-scan
 *   （src/endpoints/linkIntegrityScan.ts，註冊在 Products.collection.endpoints[]）
 */
const LinkIntegrityView: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  const isAdmin = Boolean(user && (user as { role?: string }).role === 'admin')

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
          🔗 連結完整性診斷
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: 24,
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 14,
          }}
        >
          封測公開前確認商品 / 分類連結沒有斷掉。每次點「開始掃描」會重新跑全表 6 項檢查，
          封測量級約 5–15 秒。檢查項目皆唯讀 / 提供連結到對應 admin edit 頁，
          不會自動修資料；「重新計算分類商品數」會呼叫 PR-γ 的 endpoint 一鍵重建 productCount。
        </p>
        {isAdmin ? (
          <LinkIntegrityClient />
        ) : (
          <p style={{ fontSize: 14, color: 'var(--theme-elevation-600, #666)' }}>
            僅 admin 角色可以檢視連結完整性診斷。
          </p>
        )}
      </div>
    </DefaultTemplate>
  )
}

export default LinkIntegrityView
