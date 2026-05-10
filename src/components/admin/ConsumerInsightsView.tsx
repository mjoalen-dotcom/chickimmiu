import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import ConsumerInsightsClient from './ConsumerInsightsClient'

/**
 * ConsumerInsightsView — /admin/consumer-insights
 * ────────────────────────────────────────────────
 * 消費者行為分析儀表（server wrapper）。
 * - 套用 DefaultTemplate 保持側邊欄一致
 * - admin 才看得到內容；非 admin 提示
 * - 實際資料/圖表由 ConsumerInsightsClient 負責
 *
 * 資料源：GET /api/users/consumer-insights?days=30（src/endpoints/consumerInsights.ts）
 */
const ConsumerInsightsView: React.FC<AdminViewServerProps> = ({
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
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          🧭 消費者分析
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: 24,
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 14,
          }}
        >
          顯示「點擊 / 加入購物車 / 網頁瀏覽 / 停留位置」的聚合報表 + 8-12 條經營建議。
          資料來自客端 BehaviorTracker（cookie consent 同意後才開始記錄）+ Orders 表。
        </p>
        {isAdmin ? (
          <ConsumerInsightsClient />
        ) : (
          <p style={{ fontSize: 14, color: 'var(--theme-elevation-600, #666)' }}>
            僅 admin 角色可以檢視消費者分析。
          </p>
        )}
      </div>
    </DefaultTemplate>
  )
}

export default ConsumerInsightsView
