import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import CampaignStudioClient from './CampaignStudioClient'

/**
 * CampaignStudioView — /admin/campaign-studio
 * ────────────────────────────────────────────
 * 活動試算台（server wrapper）。把既有但從未被任何 UI 呼叫的 preview API
 * 接上，讓管理員在活動上線前能實際驗證「這條規則對這台購物車會折多少、
 * 沒折的話是哪個條件沒過」。
 *
 * 資料源：POST /api/admin/campaigns/[id]/preview（admin-gated、零副作用）
 */
const CampaignStudioView: React.FC<AdminViewServerProps> = ({
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
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>🎯 活動試算台</h1>
        <p
          style={{
            margin: 0,
            marginBottom: 24,
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 14,
          }}
        >
          上線前先用伺服器同一套計價引擎試算：組一台測試購物車，看折抵金額、命中了哪些規則、
          沒命中的又是卡在哪個條件。零副作用——不建訂單、不扣預算、不發獎、不寫用量。
        </p>
        {isAdmin ? (
          <CampaignStudioClient />
        ) : (
          <p style={{ fontSize: 14, color: 'var(--theme-elevation-600, #666)' }}>
            僅 admin 角色可以使用活動試算台。
          </p>
        )}
      </div>
    </DefaultTemplate>
  )
}

export default CampaignStudioView
