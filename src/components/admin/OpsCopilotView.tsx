import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import OpsCopilotClient from './OpsCopilotClient'

/**
 * OpsCopilotView — /admin/ops-copilot
 * ────────────────────────────────────────────────
 * 營運 AI 助理指揮艙（server wrapper）。
 * - 套用 DefaultTemplate 保持側邊欄一致
 * - admin 才看得到內容
 * - 資料與互動全在 OpsCopilotClient
 *
 * 資料源：
 *   GET  /api/ops-copilot/briefing
 *   GET  /api/ops-copilot/actions?status=pending
 *   POST /api/ops-copilot/actions/[id]/execute
 *   POST /api/ops-copilot/chat
 */
const OpsCopilotView: React.FC<AdminViewServerProps> = ({
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
        {isAdmin ? (
          <OpsCopilotClient />
        ) : (
          <p style={{ padding: 24 }}>需要管理員權限才能使用營運 AI 助理。</p>
        )}
      </div>
    </DefaultTemplate>
  )
}

export default OpsCopilotView
