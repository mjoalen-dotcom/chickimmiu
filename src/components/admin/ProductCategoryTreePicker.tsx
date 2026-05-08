'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useField } from '@payloadcms/ui'

/**
 * ProductCategoryTreePicker
 * ─────────────────────────
 * Products 的分類選擇器。一次同時操作兩個欄位：
 *
 *   - `category`            主分類（單選，required）  → 用於前台麵包屑/SEO/productCount
 *   - `additionalCategories` 其他分類（hasMany）       → 商品可額外掛靠的分類
 *
 * UI：
 *   - Tab 切換：「🎯 主分類（單選）」 /「📚 其他分類（多選）」
 *   - 樹狀縮排（level 1/2/3）一次顯示全部分類，沒被 typeahead 截掉
 *   - 搜尋框可即時過濾
 *   - 已停用 (isActive=false) 的分類 dim 顯示但仍可選（避免歷史資料卡住）
 *
 * 注意：此 component 是 Field component 掛在 `category` field 上；
 * 同時透過 useField 操作 `additionalCategories`（在 Products.ts 設為 hidden 但仍會存）。
 *
 * MUST be a 'use client' — Payload v3 admin Field 在 group/tab 內若是 RSC 會
 * silent 清空整個 form 的 render-fields（見 feedback memory `payload_v3_group_field_rsc`）。
 */

type CategoryNode = {
  id: number
  name: string
  slug: string
  parent: number | null
  level: '1' | '2' | '3'
  sortOrder: number
  isActive: boolean
  productCount: number
  children: CategoryNode[]
}

type RawCategory = {
  id: string | number
  name?: string
  slug?: string
  parent?: { id?: string | number } | string | number | null
  level?: string
  sortOrder?: number
  isActive?: boolean
  productCount?: number
}

interface Props {
  path: string // = 'category'（Payload v3 注入）
}

const TAB_MAIN = 'main' as const
const TAB_EXTRA = 'extra' as const
type Tab = typeof TAB_MAIN | typeof TAB_EXTRA

const ProductCategoryTreePicker: React.FC<Props> = ({ path }) => {
  // 主分類（單選 number | null）
  const { value: mainValue, setValue: setMain } = useField<number | string | null>({
    path,
  })
  // 其他分類（hasMany number[]）
  const { value: extraValue, setValue: setExtra } = useField<Array<number | string>>({
    path: 'additionalCategories',
  })

  const [tab, setTab] = useState<Tab>(TAB_MAIN)
  const [items, setItems] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  /* ── 載入全部分類，建樹 ── */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(
        '/api/categories?limit=500&depth=0&sort=sortOrder',
        { credentials: 'include' },
      )
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = (await r.json()) as { docs?: RawCategory[] }
      const docs = Array.isArray(data.docs) ? data.docs : []
      const nodes: CategoryNode[] = docs.map((d) => {
        const parentRaw = d.parent
        const parentId =
          parentRaw && typeof parentRaw === 'object'
            ? Number((parentRaw as { id?: string | number }).id ?? 0) || null
            : parentRaw != null
            ? Number(parentRaw) || null
            : null
        const lvl = (d.level as string) || '1'
        return {
          id: Number(d.id),
          name: d.name || '(未命名)',
          slug: d.slug || '',
          parent: parentId,
          level: (lvl === '2' || lvl === '3' ? lvl : '1') as '1' | '2' | '3',
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
          isActive: d.isActive !== false,
          productCount:
            typeof d.productCount === 'number' ? d.productCount : 0,
          children: [],
        }
      })

      // 建樹
      const byId = new Map<number, CategoryNode>()
      nodes.forEach((n) => byId.set(n.id, n))
      const roots: CategoryNode[] = []
      nodes.forEach((n) => {
        if (n.parent && byId.has(n.parent)) {
          byId.get(n.parent)!.children.push(n)
        } else {
          roots.push(n)
        }
      })
      // 同層按 sortOrder
      const sortRecursive = (arr: CategoryNode[]) => {
        arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        arr.forEach((c) => sortRecursive(c.children))
      }
      sortRecursive(roots)
      setItems(roots)

      // 預設展開所有 level 1（讓人馬上看到 level 2/3）
      const toExpand = new Set<number>()
      roots.forEach((r) => toExpand.add(r.id))
      setExpanded(toExpand)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /* ── normalize values ── */
  const mainId = useMemo(() => {
    if (mainValue == null) return null
    if (typeof mainValue === 'object') return null
    const n = Number(mainValue)
    return Number.isFinite(n) ? n : null
  }, [mainValue])

  const extraIds = useMemo<Set<number>>(() => {
    if (!Array.isArray(extraValue)) return new Set()
    const set = new Set<number>()
    for (const v of extraValue) {
      const n =
        v != null && typeof v === 'object'
          ? Number((v as { id?: number }).id ?? 0)
          : Number(v)
      if (Number.isFinite(n) && n > 0) set.add(n)
    }
    return set
  }, [extraValue])

  /* ── name lookup（顯示已選清單時用）── */
  const nameMap = useMemo<Map<number, string>>(() => {
    const m = new Map<number, string>()
    const walk = (arr: CategoryNode[]) => {
      arr.forEach((n) => {
        m.set(n.id, n.name)
        walk(n.children)
      })
    }
    walk(items)
    return m
  }, [items])

  /* ── 操作 ── */
  const pickMain = (id: number) => {
    setMain(id)
    // 如果同一個分類已在「其他」裡，從其他移除（避免重複）
    if (extraIds.has(id)) {
      setExtra(Array.from(extraIds).filter((x) => x !== id))
    }
  }

  const toggleExtra = (id: number) => {
    // 主分類不能同時在「其他」裡（避免重複統計）
    if (mainId === id) return
    const next = new Set(extraIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExtra(Array.from(next))
  }

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    const next = new Set<number>()
    const walk = (arr: CategoryNode[]) => {
      arr.forEach((n) => {
        if (n.children.length) {
          next.add(n.id)
          walk(n.children)
        }
      })
    }
    walk(items)
    setExpanded(next)
  }

  const collapseAll = () => setExpanded(new Set())

  const clearExtra = () => setExtra([])

  /* ── 搜尋過濾 ── */
  const matchesSearch = (n: CategoryNode, q: string): boolean => {
    if (!q) return true
    const t = q.toLowerCase()
    if (n.name.toLowerCase().includes(t) || n.slug.toLowerCase().includes(t))
      return true
    return n.children.some((c) => matchesSearch(c, t))
  }

  /* ── 渲染樹節點 ── */
  const renderNode = (n: CategoryNode, depth: number): React.ReactElement | null => {
    const q = search.trim()
    if (q && !matchesSearch(n, q)) return null
    const hasChildren = n.children.length > 0
    const isExpanded = expanded.has(n.id) || Boolean(q) // 搜尋時強制展開
    const isMain = mainId === n.id
    const isExtra = extraIds.has(n.id)
    const dimmed = !n.isActive

    return (
      <div key={n.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: depth * 20,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 6,
            backgroundColor:
              tab === TAB_MAIN && isMain
                ? '#eef2ff'
                : tab === TAB_EXTRA && isExtra
                ? '#f0fdf4'
                : 'transparent',
            opacity: dimmed ? 0.5 : 1,
          }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleExpand(n.id)}
            style={{
              width: 18,
              height: 18,
              border: 'none',
              background: 'transparent',
              cursor: hasChildren ? 'pointer' : 'default',
              fontSize: 11,
              color: 'var(--theme-elevation-500, #71717a)',
              padding: 0,
              flexShrink: 0,
            }}
            aria-label={isExpanded ? '收合' : '展開'}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
          </button>

          {tab === TAB_MAIN ? (
            <input
              type="radio"
              name="ckmu-cat-main"
              checked={isMain}
              onChange={() => pickMain(n.id)}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            />
          ) : (
            <input
              type="checkbox"
              checked={isExtra}
              disabled={mainId === n.id}
              onChange={() => toggleExtra(n.id)}
              style={{
                cursor: mainId === n.id ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
              title={mainId === n.id ? '已是主分類，無需重複勾選' : ''}
            />
          )}

          <span
            style={{
              fontSize: 13,
              fontWeight: isMain || isExtra ? 500 : 400,
              color: 'var(--theme-elevation-800, #18181b)',
              flexGrow: 1,
              cursor: 'pointer',
            }}
            onClick={() => {
              if (tab === TAB_MAIN) pickMain(n.id)
              else toggleExtra(n.id)
            }}
          >
            {n.level === '1' && '📁 '}
            {n.level === '2' && '📂 '}
            {n.level === '3' && '📄 '}
            {n.name}
            {!n.isActive && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  color: '#dc2626',
                  fontWeight: 400,
                }}
              >
                (已停用)
              </span>
            )}
          </span>

          <span
            style={{
              fontSize: 11,
              color: 'var(--theme-elevation-500, #71717a)',
              flexShrink: 0,
            }}
          >
            {n.productCount} 件
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div>{n.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  /* ── 已選預覽 ── */
  const mainName = mainId != null ? nameMap.get(mainId) : null
  const extraList = Array.from(extraIds)
    .map((id) => ({ id, name: nameMap.get(id) || `#${id}` }))

  return (
    <div className="field-type" style={{ marginBottom: 16 }}>
      {/* 標頭 + tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--theme-elevation-800, #18181b)',
          }}
        >
          商品分類
          <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setTab(TAB_MAIN)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: tab === TAB_MAIN ? 600 : 400,
              border:
                tab === TAB_MAIN
                  ? '2px solid #6366f1'
                  : '1px solid var(--theme-elevation-200, #d4d4d8)',
              borderRadius: 6,
              background: tab === TAB_MAIN ? '#eef2ff' : 'var(--theme-bg, #fff)',
              color: tab === TAB_MAIN ? '#4338ca' : 'var(--theme-elevation-700, #3f3f46)',
              cursor: 'pointer',
            }}
          >
            🎯 主分類（單選）
          </button>
          <button
            type="button"
            onClick={() => setTab(TAB_EXTRA)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: tab === TAB_EXTRA ? 600 : 400,
              border:
                tab === TAB_EXTRA
                  ? '2px solid #16a34a'
                  : '1px solid var(--theme-elevation-200, #d4d4d8)',
              borderRadius: 6,
              background: tab === TAB_EXTRA ? '#f0fdf4' : 'var(--theme-bg, #fff)',
              color: tab === TAB_EXTRA ? '#15803d' : 'var(--theme-elevation-700, #3f3f46)',
              cursor: 'pointer',
            }}
          >
            📚 其他分類（多選 {extraIds.size}）
          </button>
        </div>
      </div>

      {/* 工具列 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 搜尋分類名稱或 slug..."
          style={{
            flexGrow: 1,
            minWidth: 200,
            padding: '6px 10px',
            fontSize: 13,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background: 'var(--theme-input-bg, #fff)',
            color: 'var(--theme-elevation-800, #18181b)',
          }}
        />
        <button
          type="button"
          onClick={expandAll}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background: 'var(--theme-bg, #fff)',
            color: 'var(--theme-elevation-700, #3f3f46)',
            cursor: 'pointer',
          }}
        >
          全部展開
        </button>
        <button
          type="button"
          onClick={collapseAll}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background: 'var(--theme-bg, #fff)',
            color: 'var(--theme-elevation-700, #3f3f46)',
            cursor: 'pointer',
          }}
        >
          全部收合
        </button>
        {tab === TAB_EXTRA && extraIds.size > 0 && (
          <button
            type="button"
            onClick={clearExtra}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              border: '1px solid #fca5a5',
              borderRadius: 6,
              background: '#fef2f2',
              color: '#b91c1c',
              cursor: 'pointer',
            }}
          >
            清空其他
          </button>
        )}
      </div>

      {/* 已選預覽 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 8,
          padding: '8px 10px',
          background: 'var(--theme-elevation-50, #fafafa)',
          borderRadius: 6,
          fontSize: 12,
          minHeight: 32,
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--theme-elevation-600, #52525b)', fontWeight: 500 }}>
          已選：
        </span>
        {mainName ? (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: '#eef2ff',
              color: '#4338ca',
              fontWeight: 500,
            }}
          >
            主：{mainName}
          </span>
        ) : (
          <span style={{ color: '#dc2626', fontStyle: 'italic' }}>
            （尚未選主分類）
          </span>
        )}
        {extraList.map((e) => (
          <span
            key={e.id}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: '#f0fdf4',
              color: '#15803d',
            }}
          >
            其他：{e.name}
          </span>
        ))}
      </div>

      {/* 樹狀清單 */}
      <div
        style={{
          maxHeight: 480,
          overflow: 'auto',
          border: '1px solid var(--theme-elevation-200, #e4e4e7)',
          borderRadius: 6,
          padding: 8,
          background: 'var(--theme-input-bg, #fff)',
        }}
      >
        {loading && (
          <div style={{ padding: 12, fontSize: 13, color: '#71717a' }}>
            載入分類中…
          </div>
        )}
        {error && (
          <div style={{ padding: 12, fontSize: 13, color: '#dc2626' }}>
            載入失敗：{error} —{' '}
            <button
              type="button"
              onClick={() => void load()}
              style={{
                border: 'none',
                background: 'none',
                color: '#4338ca',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              重試
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div style={{ padding: 12, fontSize: 13, color: '#71717a' }}>
            尚無分類。請先到「② 商品管理 → 商品分類」建立。
          </div>
        )}
        {!loading && !error && items.map((n) => renderNode(n, 0))}
      </div>

      <p
        style={{
          fontSize: 11,
          color: 'var(--theme-elevation-500, #71717a)',
          marginTop: 6,
        }}
      >
        主分類用於前台麵包屑、SEO、分類頁面歸屬；其他分類僅讓商品出現在更多分類列表中（可選）。
      </p>
    </div>
  )
}

export default ProductCategoryTreePicker
