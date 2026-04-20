import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import MemberAnalyticsClient from './MemberAnalyticsClient'

/**
 * MemberAnalyticsView — /admin/member-analytics
 * ─────────────────────────────────────────────
 * 會員分群儀表板（server wrapper）。
 * - 套用 DefaultTemplate 保持跟其他後台頁一致的側邊欄/頁首
 * - 限制：僅 admin 可進來；非 admin 直接看到提示文字
 * - 實際資料/圖表由 MemberAnalyticsClient（'use client'）負責
 *
 * 資料源：GET /api/users/member-analytics（見 src/endpoints/memberAnalytics.ts）
 */
const MemberAnalyticsView: React.FC<AdminViewServerProps> = ({
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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          📊 會員分群分析
        </h1>
        <p style={{ margin: 0, marginBottom: 24, color: 'var(--theme-elevation-600, #666)', fontSize: 14 }}>
          生日月份、星座、年齡、性別、會員等級，以及年齡×商品分類偏好矩陣；做生日行銷、選品、
          檔期規劃的單頁儀表板。
        </p>
        {isAdmin ? (
          <MemberAnalyticsClient />
        ) : (
          <p style={{ fontSize: 14, color: 'var(--theme-elevation-600, #666)' }}>
            僅 admin 角色可以檢視會員分群分析。
          </p>
        )}
      </div>
    </DefaultTemplate>
  )
}

export default MemberAnalyticsView
