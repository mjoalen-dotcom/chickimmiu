'use client'

/**
 * ProductMissingImagePanel
 * ────────────────────────
 * 商品列表頁上方的「缺圖快查」面板。
 *
 * 缺圖 = 封面主圖（featuredImage）為空，且 商品圖庫（images）的第一張也為空。
 * 判定邏輯與前台 / Meta feed (src/lib/ads/feedBuilder.ts) 對齊：
 *   featuredImageUrl = featuredImage || images[0]?.image
 *
 * 面板：折疊預設收合（避免跟 ProductsUsageNotice、ProductBulkActions 一起把
 * 列表往下推到 viewport 外）。Mount 時仍會自動掃描一次，掃完直接把
 * 結果（⚠️ N 件 / ✅ 全部 OK / ❌ 載入失敗）寫進 summary 的 badge，
 * 使用者不展開也能秒看狀態。需要看清單再點 summary 展開。
 *
 * 商品數量大於 50 時截斷顯示。
 */

import React, { useCallback, useEffect, useState } from 'react'

type MediaRef = number | { id: number | string } | null | undefined

type ProductLite = {
  id: number | string
  name?: string
  slug?: string
  status?: string
  featuredImage?: MediaRef
  images?: Array<{ image?: MediaRef }>
}

const PAGE_SIZE = 1000
const SHOW_MAX = 50

const isMissingImage = (p: ProductLite): boolean => {
  if (p.featuredImage) return false
  if (Array.isArray(p.images) && p.images.length > 0) {
    if (p.images[0]?.image) return false
  }
  return true
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  padding: 16,
  margin: '12px 0',
  background: 'var(--theme-elevation-50, #fafafa)',
}

const summaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  listStyle: 'revert',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const badgeBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  marginLeft: 8,
}

const badgeOk: React.CSSProperties = {
  ...badgeBase,
  background: '#dcfce7',
  color: '#166534',
  border: '1px solid #86efac',
}

const badgeWarn: React.CSSProperties = {
  ...badgeBase,
  background: '#fef3c7',
  color: '#92400e',
  border: '1px solid #fcd34d',
}

const badgeError: React.CSSProperties = {
  ...badgeBase,
  background: '#fee2e2',
  color: '#991b1b',
  border: '1px solid #fca5a5',
}

const badgeIdle: React.CSSProperties = {
  ...badgeBase,
  background: 'var(--theme-elevation-100, #f4f4f5)',
  color: 'var(--theme-elevation-600, #666)',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
}

const headlineStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-700, #333)',
  margin: '4px 0 12px 0',
  lineHeight: 1.6,
}

const listStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 8,
}

const itemStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 6,
  background: 'var(--theme-elevation-0, #fff)',
  fontSize: 13,
  textDecoration: 'none',
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const tagStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--theme-elevation-500, #666)',
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 4,
  padding: '1px 6px',
}

const btn: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: 'var(--theme-elevation-0, #fff)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}

const ProductMissingImagePanel: React.FC = () => {
  const [items, setItems] = useState<ProductLite[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanned, setScanned] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products?limit=${PAGE_SIZE}&depth=0`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { docs?: ProductLite[]; totalDocs?: number }
      const docs = Array.isArray(data.docs) ? data.docs : []
      setScanned(typeof data.totalDocs === 'number' ? data.totalDocs : docs.length)
      setItems(docs.filter(isMissingImage))
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
      setItems(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const missingCount = items?.length ?? 0
  const overflow = items ? items.length - SHOW_MAX : 0
  const visible = items ? items.slice(0, SHOW_MAX) : []

  const headline = (() => {
    if (loading && items === null) return '掃描中…'
    if (error) return `載入失敗：${error}`
    if (missingCount === 0) return `✅ 已掃 ${scanned} 件商品，全部都有圖片。`
    return `⚠️ ${scanned} 件商品中有 ${missingCount} 件「封面 + 圖庫」皆為空，需要補圖：`
  })()

  const truncated = scanned >= PAGE_SIZE
    ? ` 注意：本工具一次最多掃 ${PAGE_SIZE} 筆，若商品超過此數須改成分頁掃描。`
    : ''

  // 把目前狀態做成 summary 的 badge，預設收合時也能秒看結果
  const summaryBadge = (() => {
    if (loading && items === null) {
      return <span style={badgeIdle}>掃描中…</span>
    }
    if (error) {
      return <span style={badgeError}>❌ 載入失敗</span>
    }
    if (missingCount === 0) {
      return <span style={badgeOk}>✅ 全部都有圖（{scanned}）</span>
    }
    return <span style={badgeWarn}>⚠️ {missingCount} 件待補圖</span>
  })()

  return (
    <details style={cardStyle}>
      <summary style={summaryStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span>🖼️ 缺圖商品快查</span>
          {summaryBadge}
        </span>
        <button
          type="button"
          style={btn}
          onClick={(e) => {
            e.preventDefault()
            void load()
          }}
          disabled={loading}
        >
          {loading ? '掃描中…' : '↻ 重新掃描'}
        </button>
      </summary>

      <p style={{ ...headlineStyle, marginTop: 12 }}>{headline}{truncated}</p>

      {missingCount > 0 && (
        <>
          <div style={listStyle}>
            {visible.map((p) => (
              <a
                key={p.id}
                style={itemStyle}
                href={`/admin/collections/products/${p.id}`}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name || p.slug || `#${p.id}`}
                </span>
                {p.status && <span style={tagStyle}>{p.status}</span>}
              </a>
            ))}
          </div>
          {overflow > 0 && (
            <p style={{ ...headlineStyle, margin: '12px 0 0' }}>
              另有 <strong>{overflow}</strong> 件未顯示，補完上面這批後再點「↻ 重新掃描」。
            </p>
          )}
        </>
      )}
    </details>
  )
}

export default ProductMissingImagePanel
