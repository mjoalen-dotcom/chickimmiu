import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import type { Product, Order, ProductViewEvent } from '@/payload-types'

/**
 * UTMAttributionView — /admin/reports/utm-attribution
 * ────────────────────────────────────────────────────
 * UTM 商品歸因報表（過去 90 天）：
 *   1. UTM Source 總覽：views / orders / revenue / view→order CVR
 *   2. UTM Campaign 總覽：同上
 *   3. 商品 × Source 營收矩陣（top 20 商品）
 *
 * 資料源：
 *   - `product-view-events` collection (PR-B 新增)
 *   - `orders` collection 的 `attribution` group (last_touch 為主)
 *
 * 設計選擇：
 *   - SSR 90 天固定視窗。日期區間自訂、source filter 等留給後續 PR
 *   - in-memory aggregation；日均 PDP <50k 沒問題，再多就要改 SQL group by
 *   - 只 admin 可看（access:isAdmin）
 *
 * 入口：payload.config.ts `admin.components.views.utmAttribution`
 */

const WINDOW_DAYS = 90

interface SourceAggregate {
  source: string
  views: number
  orders: number
  revenue: number
  cvr: number // orders / views
}

interface CampaignAggregate {
  campaign: string
  source: string
  views: number
  orders: number
  revenue: number
}

interface MatrixRow {
  productId: number
  productName: string
  bySource: Record<string, number> // source → revenue
  total: number
}

const UTMAttributionView: React.FC<AdminViewServerProps> = async ({
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
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString()

  // ─── 拉資料 ───
  const [eventsRes, ordersRes] = await Promise.all([
    payload.find({
      collection: 'product-view-events',
      where: { createdAt: { greater_than_equal: since } },
      limit: 50000,
      depth: 0,
      pagination: false,
    }),
    payload.find({
      collection: 'orders',
      where: { createdAt: { greater_than_equal: since } },
      limit: 10000,
      depth: 1,
      pagination: false,
    }),
  ])

  const events = eventsRes.docs as ProductViewEvent[]
  const orders = ordersRes.docs as Order[]

  // ─── 聚合：UTM Source ───
  const sourceMap = new Map<string, SourceAggregate>()
  const ensureSource = (s: string): SourceAggregate => {
    let agg = sourceMap.get(s)
    if (!agg) {
      agg = { source: s, views: 0, orders: 0, revenue: 0, cvr: 0 }
      sourceMap.set(s, agg)
    }
    return agg
  }

  for (const ev of events) {
    const s = ev.utmSource || '(direct)'
    ensureSource(s).views += 1
  }

  for (const ord of orders) {
    const ltSource = ord.attribution?.lastTouch?.utmSource || ord.attribution?.firstTouch?.utmSource || '(direct)'
    const agg = ensureSource(ltSource)
    agg.orders += 1
    agg.revenue += ord.total || 0
  }

  for (const agg of sourceMap.values()) {
    agg.cvr = agg.views > 0 ? agg.orders / agg.views : 0
  }

  const sourceRows = Array.from(sourceMap.values()).sort((a, b) => b.revenue - a.revenue)

  // ─── 聚合：UTM Campaign ───
  const campaignMap = new Map<string, CampaignAggregate>()
  const campaignKey = (campaign: string, source: string) => `${campaign}|${source}`

  for (const ev of events) {
    const campaign = ev.utmCampaign || '(none)'
    const source = ev.utmSource || '(direct)'
    const k = campaignKey(campaign, source)
    let agg = campaignMap.get(k)
    if (!agg) {
      agg = { campaign, source, views: 0, orders: 0, revenue: 0 }
      campaignMap.set(k, agg)
    }
    agg.views += 1
  }

  for (const ord of orders) {
    const campaign =
      ord.attribution?.lastTouch?.utmCampaign ||
      ord.attribution?.firstTouch?.utmCampaign ||
      '(none)'
    const source =
      ord.attribution?.lastTouch?.utmSource ||
      ord.attribution?.firstTouch?.utmSource ||
      '(direct)'
    const k = campaignKey(campaign, source)
    let agg = campaignMap.get(k)
    if (!agg) {
      agg = { campaign, source, views: 0, orders: 0, revenue: 0 }
      campaignMap.set(k, agg)
    }
    agg.orders += 1
    agg.revenue += ord.total || 0
  }

  const campaignRows = Array.from(campaignMap.values())
    .filter((r) => r.campaign !== '(none)' || r.orders > 0 || r.views > 50)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50)

  // ─── 聚合：商品 × Source 營收矩陣 ───
  const matrixMap = new Map<number, MatrixRow>()
  for (const ord of orders) {
    const source =
      ord.attribution?.lastTouch?.utmSource ||
      ord.attribution?.firstTouch?.utmSource ||
      '(direct)'
    const items = Array.isArray(ord.items) ? ord.items : []
    for (const item of items) {
      const productRef = item.product
      const pid =
        typeof productRef === 'object' && productRef
          ? (productRef as Product).id
          : (productRef as number | undefined)
      if (typeof pid !== 'number') continue
      const pname =
        typeof productRef === 'object' && productRef
          ? (productRef as Product).name
          : item.productName || `#${pid}`
      let row = matrixMap.get(pid)
      if (!row) {
        row = { productId: pid, productName: pname, bySource: {}, total: 0 }
        matrixMap.set(pid, row)
      }
      const itemRev = (item.subtotal as number) || (item.unitPrice as number) * (item.quantity as number) || 0
      row.bySource[source] = (row.bySource[source] || 0) + itemRev
      row.total += itemRev
    }
  }

  const matrixRows = Array.from(matrixMap.values()).sort((a, b) => b.total - a.total).slice(0, 20)
  const topSources = sourceRows.slice(0, 5).map((r) => r.source)

  // ─── 樣式 ───
  const cardStyle: React.CSSProperties = {
    background: 'var(--theme-bg, #fff)',
    border: '1px solid var(--theme-elevation-100, #eee)',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  }
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  }
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid var(--theme-elevation-150, #ddd)',
    fontWeight: 600,
  }
  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--theme-elevation-100, #eee)',
  }
  const numStyle: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const fmt = (n: number) => n.toLocaleString('zh-TW')
  const fmtMoney = (n: number) => 'NT$ ' + Math.round(n).toLocaleString('zh-TW')
  const fmtPct = (n: number) => (n * 100).toFixed(2) + '%'

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
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          📈 UTM 商品歸因報表
        </h1>
        <p style={{ margin: 0, marginBottom: 24, color: 'var(--theme-elevation-600, #666)', fontSize: 14 }}>
          過去 {WINDOW_DAYS} 天 · {events.length.toLocaleString()} 筆瀏覽事件 · {orders.length.toLocaleString()} 筆訂單 ·
          歸因模型：last-touch fallback first-touch（無 UTM 視為 direct）
        </p>

        {/* Source 總覽 */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 12 }}>
            UTM Source 總覽
          </h2>
          {sourceRows.length === 0 ? (
            <p style={{ color: 'var(--theme-elevation-500, #888)' }}>
              尚無資料 — 請等待客戶帶 UTM 進站後產生 ProductViewEvents。
            </p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Source</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>瀏覽</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>訂單</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>營收</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>View→Order CVR</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((r) => (
                  <tr key={r.source}>
                    <td style={tdStyle}>{r.source}</td>
                    <td style={numStyle}>{fmt(r.views)}</td>
                    <td style={numStyle}>{fmt(r.orders)}</td>
                    <td style={numStyle}>{fmtMoney(r.revenue)}</td>
                    <td style={numStyle}>{fmtPct(r.cvr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Campaign 總覽 */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 12 }}>
            UTM Campaign 總覽（top 50）
          </h2>
          {campaignRows.length === 0 ? (
            <p style={{ color: 'var(--theme-elevation-500, #888)' }}>尚無 campaign 資料。</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Campaign</th>
                  <th style={thStyle}>Source</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>瀏覽</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>訂單</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>營收</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((r, i) => (
                  <tr key={`${r.campaign}-${r.source}-${i}`}>
                    <td style={tdStyle}>{r.campaign}</td>
                    <td style={tdStyle}>{r.source}</td>
                    <td style={numStyle}>{fmt(r.views)}</td>
                    <td style={numStyle}>{fmt(r.orders)}</td>
                    <td style={numStyle}>{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 商品 × Source 矩陣 */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 12 }}>
            商品 × Source 營收矩陣（top 20 商品 × top 5 source）
          </h2>
          {matrixRows.length === 0 ? (
            <p style={{ color: 'var(--theme-elevation-500, #888)' }}>尚無訂單。</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>商品</th>
                  {topSources.map((s) => (
                    <th key={s} style={{ ...thStyle, textAlign: 'right' }}>
                      {s}
                    </th>
                  ))}
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.productId}>
                    <td style={tdStyle}>{row.productName}</td>
                    {topSources.map((s) => (
                      <td key={s} style={numStyle}>
                        {row.bySource[s] ? fmtMoney(row.bySource[s]) : '—'}
                      </td>
                    ))}
                    <td style={{ ...numStyle, fontWeight: 600 }}>{fmtMoney(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--theme-elevation-500, #888)', marginTop: 24 }}>
          完整訂單歸因見每張訂單詳情的「UTM 歸因」群組；瀏覽事件原始資料在「商品瀏覽事件」集合。
          進階篩選（日期區間、source 細分、campaign drill-down）規劃為後續 PR。
        </p>
      </div>
    </DefaultTemplate>
  )
}

export default UTMAttributionView
