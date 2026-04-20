import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import RepeatPurchaseClient from './RepeatPurchaseClient'

/**
 * RepeatPurchaseView — /admin/repeat-purchase
 * ────────────────────────────────────────────
 * 90 天回購率儀表板（server wrapper）。
 * 套 DefaultTemplate 保持跟後台其他頁一致的側邊欄 / 頁首；
 * 實際資料由 RepeatPurchaseClient（'use client'）呼叫
 * GET /api/users/repeat-purchase 聚合後渲染。
 */
const RepeatPurchaseView: React.FC<AdminViewServerProps> = ({
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
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          🔁 90 天回購分析
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: 24,
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 14,
          }}
        >
          首購 cohort × D30 / D60 / D90 回購率，加上「尚未回購」行動名單 — 封測期主理人可針對
          d0-14（Delight）、d15-45（Discovery）、d46-90（Conversion）三段 LINE 一對一觸及。
        </p>
        {isAdmin ? (
          <RepeatPurchaseClient />
        ) : (
          <p style={{ fontSize: 14, color: 'var(--theme-elevation-600, #666)' }}>
            僅 admin 角色可以檢視 90 天回購分析。
          </p>
        )}
      </div>
    </DefaultTemplate>
  )
}

export default RepeatPurchaseView
