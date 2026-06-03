import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import WhiteHatMarketingClient from './WhiteHatMarketingClient'

const WhiteHatMarketingView: React.FC<AdminViewServerProps> = async ({
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
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 48px' }}>
        {!isAdmin ? (
          <p>需要管理員權限。</p>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>白帽自動化行銷中台</h1>
            <p style={{ margin: '6px 0 20px', color: 'var(--theme-elevation-600, #666)', fontSize: 14 }}>
              SEO、會員 Email、採購分析、短影音素材與每日營運摘要。所有產出預設為草稿或建議，
              不做假外鏈，也不對未授權會員大量寄信。
            </p>
            <WhiteHatMarketingClient />
          </>
        )}
      </div>
    </DefaultTemplate>
  )
}

export default WhiteHatMarketingView
