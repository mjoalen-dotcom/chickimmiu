import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import BulkDeleteProductsClient from './BulkDeleteProductsClient'

/**
 * BulkDeleteProductsView — /admin/tools/bulk-delete-products
 * ──────────────────────────────────────────────────────────
 * ⑦ 系統工具：一鍵清理未上架（draft）+ 已下架（archived）商品。
 *
 * SSR 階段只做 admin role gate；資料拉取改由 client 端打
 * POST /api/products/admin/bulk-delete-unpublished 取得，
 * 因為這頁有「刪除完重新整理列表」需求，全 client 控制比較單純。
 *
 * 入口：payload.config.ts admin.components.views.bulkDeleteProducts
 *      + CKMUSystemToolsNavGroup nav entry
 */
const BulkDeleteProductsView: React.FC<AdminViewServerProps> = ({
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
          🗑️ 一鍵刪除未上架商品
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: 24,
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          清理「草稿」與「已下架」商品，不能刪除「已上架」（會自動擋）。
          下面有單一商品的 <strong>診斷</strong> 框：貼上 product id，會列出哪些訂單 / 退換貨 / 評價在引用它，
          幫你判斷該硬刪還是該保留為 archived。
        </p>
        <BulkDeleteProductsClient />
      </div>
    </DefaultTemplate>
  )
}

export default BulkDeleteProductsView
