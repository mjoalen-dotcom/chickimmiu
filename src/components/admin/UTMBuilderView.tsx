import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import type { UtmCampaign } from '@/payload-types'
import UTMBuilderClient from './UTMBuilderClient'

/**
 * UTMBuilderView — /admin/tools/utm-builder
 * ─────────────────────────────────────────
 * 行銷團隊用來拼 UTM URL 的工具：
 *   1. 從「UTM 活動管理」collection 拉所有 active campaigns 給 client autocomplete
 *   2. Client 端表單 → 即時產出 URL → 一鍵複製
 *   3. 也可以選擇「不從 campaign 開始，自由輸入 utm_*」模式
 *
 * 入口：payload.config.ts `admin.components.views.utmBuilder`
 */
const UTMBuilderView: React.FC<AdminViewServerProps> = async ({
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

  const payload = initPageResult.req.payload
  const campaignsRes = await payload.find({
    collection: 'utm-campaigns',
    where: { utm_camp_status: { not_equals: 'ended' } },
    limit: 200,
    pagination: false,
    depth: 0,
    sort: '-updatedAt',
  })

  const campaigns = (campaignsRes.docs as UtmCampaign[]).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    source: c.source as string,
    medium: c.medium as string,
    defaultContent: c.defaultContent || '',
    defaultTerm: c.defaultTerm || '',
  }))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          🔗 UTM Builder
        </h1>
        <p style={{ margin: 0, marginBottom: 24, color: 'var(--theme-elevation-600, #666)', fontSize: 14 }}>
          拼 UTM URL 的工具：選一個已建立的活動或自由輸入。產出的 URL 直接複製貼到廣告 / EDM / Social post。
          活動清單在「行銷推廣 → UTM 活動」管理。
        </p>
        <UTMBuilderClient campaigns={campaigns} defaultBaseUrl={siteUrl} />
      </div>
    </DefaultTemplate>
  )
}

export default UTMBuilderView
