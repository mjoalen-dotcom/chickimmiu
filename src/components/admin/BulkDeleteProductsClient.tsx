'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

type ScanDoc = {
  id: number
  name: string
  slug: string
  status: 'draft' | 'archived' | string
  totalSold: number
  stock: number
  price: number
  createdAt: string | null
  updatedAt: string | null
}

type ScanResp = {
  ok: true
  total: number
  draftCount: number
  archivedCount: number
  docs: ScanDoc[]
}

type ReferrerRow = {
  collection: string
  label: string
  count: number
  samples: Array<{ id: number; meta?: string }>
}
type InspectResp = {
  ok: true
  product: { id: number; name: string; slug: string; status: string; totalSold: number; stock: number }
  referrers: ReferrerRow[]
  hint: string
}
type DeleteResp = {
  ok: true
  requested: number
  deletedCount: number
  failedCount: number
  deleted: number[]
  failed: Array<{ id: number; name?: string; err: string }>
}

const ENDPOINT = '/api/products/admin/bulk-delete-unpublished'

async function postAction<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) {
    throw new Error(j?.detail || j?.error || `HTTP ${r.status}`)
  }
  return j as T
}

const BulkDeleteProductsClient: React.FC = () => {
  const [scan, setScan] = useState<ScanResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'archived'>('all')

  const [inspectId, setInspectId] = useState('')
  const [inspectResult, setInspectResult] = useState<InspectResp | null>(null)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [inspectLoading, setInspectLoading] = useState(false)

  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<DeleteResp | null>(null)

  const refreshScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await postAction<ScanResp>({ action: 'scan', limit: 2000 })
      setScan(r)
      setSelectedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshScan()
  }, [refreshScan])

  const filteredDocs = useMemo(() => {
    if (!scan) return []
    if (statusFilter === 'all') return scan.docs
    return scan.docs.filter((d) => d.status === statusFilter)
  }, [scan, statusFilter])

  const allSelected = filteredDocs.length > 0 && filteredDocs.every((d) => selectedIds.has(d.id))

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds)
      filteredDocs.forEach((d) => next.delete(d.id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      filteredDocs.forEach((d) => next.add(d.id))
      setSelectedIds(next)
    }
  }

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runInspect = async () => {
    const id = Number(inspectId.trim())
    if (!Number.isFinite(id) || id <= 0) {
      setInspectError('請輸入正整數 product id')
      return
    }
    setInspectLoading(true)
    setInspectError(null)
    setInspectResult(null)
    try {
      const r = await postAction<InspectResp>({ action: 'inspect', id })
      setInspectResult(r)
    } catch (e) {
      setInspectError(e instanceof Error ? e.message : String(e))
    } finally {
      setInspectLoading(false)
    }
  }

  const runDelete = async () => {
    if (selectedIds.size === 0) return
    const confirmed = window.confirm(
      `確定要刪除 ${selectedIds.size} 個商品嗎？\n` +
        `已上架的會自動跳過。\n` +
        `引用到的訂單 / 退換貨 / 評價的「商品」欄位會被自動清空（不會連訂單一起刪）。\n` +
        `這個動作無法復原。`,
    )
    if (!confirmed) return

    setDeleting(true)
    setDeleteResult(null)
    setError(null)
    try {
      const r = await postAction<DeleteResp>({
        action: 'delete',
        ids: Array.from(selectedIds),
      })
      setDeleteResult(r)
      // 重新拉一次列表
      await refreshScan()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── 區塊 1：診斷單一商品 ── */}
      <section style={card()}>
        <h2 style={h2()}>🔍 診斷：為什麼某個商品刪不掉？</h2>
        <p style={muted()}>
          貼上 product id（不是 slug），會列出該商品被哪些訂單 / 退換貨 / 評價引用。
          可從商品列表頁的 URL 末尾複製，例如 <code>/admin/collections/products/<strong>123</strong></code> 的 123。
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <input
            type="number"
            value={inspectId}
            onChange={(e) => setInspectId(e.target.value)}
            placeholder="product id"
            style={input()}
          />
          <button
            type="button"
            onClick={runInspect}
            disabled={inspectLoading || !inspectId.trim()}
            style={btn('primary')}
          >
            {inspectLoading ? '查詢中…' : '診斷'}
          </button>
        </div>
        {inspectError && <div style={errorBox()}>{inspectError}</div>}
        {inspectResult && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12, fontSize: 14 }}>
              <strong>{inspectResult.product.name}</strong>{' '}
              <span style={muted()}>
                (id={inspectResult.product.id} · slug={inspectResult.product.slug} ·
                status={inspectResult.product.status} · totalSold={inspectResult.product.totalSold} ·
                stock={inspectResult.product.stock})
              </span>
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                background: 'var(--theme-elevation-50, #fafafa)',
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {inspectResult.hint}
            </pre>
            <table style={table()}>
              <thead>
                <tr>
                  <th style={th()}>關聯資料</th>
                  <th style={th()}>筆數</th>
                  <th style={th()}>樣本（最多前 5 筆）</th>
                </tr>
              </thead>
              <tbody>
                {inspectResult.referrers.map((r) => (
                  <tr key={r.collection}>
                    <td style={td()}>
                      <strong>{r.label}</strong>
                      <div style={{ fontSize: 11, color: 'var(--theme-elevation-500, #888)' }}>{r.collection}</div>
                    </td>
                    <td
                      style={{
                        ...td(),
                        fontVariantNumeric: 'tabular-nums',
                        color: r.count > 0 ? 'var(--theme-warning-600, #c08600)' : 'var(--theme-success-600, #1a8c00)',
                        fontWeight: 600,
                      }}
                    >
                      {r.count}
                    </td>
                    <td style={td()}>
                      {r.samples.length === 0 ? (
                        <span style={muted()}>—</span>
                      ) : (
                        <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                          {r.samples.map((s) => (
                            <li key={s.id} style={{ fontSize: 12 }}>
                              {s.meta || `#${s.id}`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--theme-elevation-600, #666)' }}>
              想直接試刪這一個？把 id 勾起來，按下方「刪除已勾選」即可（如果它本來就在列表裡）；
              否則複製 id 到上面別的工具用。本診斷器本身不會刪。
            </div>
          </div>
        )}
      </section>

      {/* ── 區塊 2：批次清單 ── */}
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={h2()}>📋 未上架商品清單</h2>
          <button type="button" onClick={refreshScan} disabled={loading} style={btn('ghost')}>
            {loading ? '載入中…' : '重新整理'}
          </button>
        </div>

        {error && <div style={errorBox()}>{error}</div>}

        {scan && (
          <>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14 }}>
                共 <strong>{scan.total}</strong> 個（草稿 {scan.draftCount} · 已下架 {scan.archivedCount}）
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'draft', 'archived'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setStatusFilter(opt)}
                    style={btn(statusFilter === opt ? 'primary' : 'ghost')}
                  >
                    {opt === 'all' ? '全部' : opt === 'draft' ? '草稿' : '已下架'}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 14 }}>
                已勾選 <strong>{selectedIds.size}</strong>
              </span>
              <button
                type="button"
                onClick={runDelete}
                disabled={deleting || selectedIds.size === 0}
                style={btn('danger')}
              >
                {deleting ? '刪除中…' : `🗑️ 刪除已勾選 (${selectedIds.size})`}
              </button>
            </div>

            {deleteResult && (
              <div
                style={{
                  ...errorBox(deleteResult.failedCount === 0 ? 'success' : 'warning'),
                  marginTop: 0,
                  marginBottom: 12,
                }}
              >
                <strong>
                  刪除 {deleteResult.deletedCount} / {deleteResult.requested} 成功
                </strong>
                {deleteResult.failedCount > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer' }}>
                      失敗 {deleteResult.failedCount} 筆（點開查看原因）
                    </summary>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 13 }}>
                      {deleteResult.failed.map((f) => (
                        <li key={f.id}>
                          <strong>#{f.id}</strong> {f.name ? `「${f.name}」` : ''} → {f.err}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <table style={table()}>
              <thead>
                <tr>
                  <th style={{ ...th(), width: 40 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={filteredDocs.length === 0} />
                  </th>
                  <th style={th()}>商品名稱</th>
                  <th style={th()}>狀態</th>
                  <th style={{ ...th(), textAlign: 'right' }}>totalSold</th>
                  <th style={{ ...th(), textAlign: 'right' }}>庫存</th>
                  <th style={{ ...th(), textAlign: 'right' }}>價格</th>
                  <th style={th()}>更新</th>
                  <th style={th()}>id</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...td(), textAlign: 'center', color: 'var(--theme-elevation-500, #888)' }}>
                      {scan.total === 0 ? '沒有任何未上架商品 🎉' : '此狀態下沒有商品'}
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((d) => (
                    <tr key={d.id}>
                      <td style={td()}>
                        <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleOne(d.id)} />
                      </td>
                      <td style={td()}>
                        <a
                          href={`/admin/collections/products/${d.id}`}
                          style={{ color: 'var(--theme-elevation-800, #222)' }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {d.name}
                        </a>
                        <div style={{ fontSize: 11, color: 'var(--theme-elevation-500, #888)' }}>{d.slug}</div>
                      </td>
                      <td style={td()}>
                        <span style={statusBadge(d.status)}>
                          {d.status === 'draft' ? '草稿' : d.status === 'archived' ? '已下架' : d.status}
                        </span>
                      </td>
                      <td style={{ ...td(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.totalSold}</td>
                      <td style={{ ...td(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.stock}</td>
                      <td style={{ ...td(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${d.price.toLocaleString()}
                      </td>
                      <td style={{ ...td(), fontSize: 12, color: 'var(--theme-elevation-500, #888)' }}>
                        {d.updatedAt ? new Date(d.updatedAt).toISOString().slice(0, 10) : '—'}
                      </td>
                      <td style={{ ...td(), fontSize: 11, color: 'var(--theme-elevation-500, #888)' }}>{d.id}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  )
}

/* ── styles ── */
function card(): React.CSSProperties {
  return {
    background: 'var(--theme-elevation-0, #fff)',
    border: '1px solid var(--theme-elevation-150, #e5e5e5)',
    borderRadius: 8,
    padding: 20,
  }
}
function h2(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 8 }
}
function muted(): React.CSSProperties {
  return { fontSize: 13, color: 'var(--theme-elevation-600, #666)', margin: 0 }
}
function input(): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--theme-elevation-200, #ddd)',
    borderRadius: 6,
    fontSize: 14,
    background: 'var(--theme-input-bg, #fff)',
    color: 'var(--theme-text, #111)',
  }
}
function btn(variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  }
  if (variant === 'primary') {
    return {
      ...base,
      background: 'var(--theme-elevation-800, #222)',
      color: 'var(--theme-elevation-0, #fff)',
    }
  }
  if (variant === 'danger') {
    return {
      ...base,
      background: 'var(--theme-error-500, #c0392b)',
      color: '#fff',
    }
  }
  return {
    ...base,
    background: 'transparent',
    color: 'var(--theme-elevation-800, #222)',
    border: '1px solid var(--theme-elevation-200, #ddd)',
  }
}
function table(): React.CSSProperties {
  return {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 8,
    fontSize: 14,
  }
}
function th(): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid var(--theme-elevation-200, #ddd)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--theme-elevation-600, #666)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
}
function td(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid var(--theme-elevation-100, #f0f0f0)',
    verticalAlign: 'top',
  }
}
function statusBadge(status: string): React.CSSProperties {
  const isDraft = status === 'draft'
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    background: isDraft ? '#fff4d6' : '#e8e8e8',
    color: isDraft ? '#8a6500' : '#555',
  }
}
function errorBox(tone: 'error' | 'success' | 'warning' = 'error'): React.CSSProperties {
  const palette = {
    error: { bg: '#fee', fg: '#8a0e1e', border: '#fbb' },
    success: { bg: '#e8f7e8', fg: '#1a6c1a', border: '#bce0bc' },
    warning: { bg: '#fff4d6', fg: '#8a6500', border: '#f0d68a' },
  }[tone]
  return {
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.border}`,
    padding: 12,
    borderRadius: 6,
    marginTop: 12,
    fontSize: 14,
  }
}

export default BulkDeleteProductsClient
