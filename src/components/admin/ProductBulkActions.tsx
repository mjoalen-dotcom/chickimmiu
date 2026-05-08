'use client'

/**
 * ProductBulkActions
 * ──────────────────
 * 顯示於「商品列表」頁面上方的一個快速批次操作面板。
 *
 * 兩個區塊：
 *   1. 「按條件批次」— 上方 6 顆按鈕，掃 DB 找符合條件的商品再切換狀態
 *      (e.g. 所有草稿 → 上架；所有缺貨 → 下架；排程；快取)
 *   2. 「對勾選商品執行」— 下方 4 顆按鈕，對使用者在表格中勾選的 N 筆執行
 *      上架 / 下架 / 草稿 / 移到垃圾桶（軟刪，7 日內可還原）
 *
 * 走 Payload v3 SelectionProvider context（BeforeListTable 在 SelectionProvider 子樹內）。
 *
 * Trash 機制：Products collection 設 `trash: true`，所以「移到垃圾桶」走
 *   PATCH ?where=... { deletedAt: ISO }，不是 DELETE。
 * 永久刪除走後台「垃圾桶」分頁的 Payload 內建按鈕，或 cron
 *   /api/cron/purge-trashed-products 每天清理 deletedAt < now-7d 的紀錄。
 *
 * 所有批次操作走 Payload 標準 REST API：
 *   PATCH  /api/products?where[...]=...     body 為共用欄位
 */

import React, { useState } from 'react'
import { useSelection } from '@payloadcms/ui'

const panel: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  padding: 16,
  margin: '12px 0',
  background: 'var(--theme-elevation-50, #fafafa)',
}

const title: React.CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 600,
}

const btnRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const btn: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: 'var(--theme-elevation-0, #fff)',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

type CountResult = { docs?: unknown[]; totalDocs?: number }

async function countWhere(query: string): Promise<number> {
  const res = await fetch(`/api/products?${query}&limit=0&depth=0`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as CountResult
  return data.totalDocs ?? data.docs?.length ?? 0
}

async function bulkPatch(
  query: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; updated?: number; message?: string }> {
  const res = await fetch(`/api/products?${query}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      message:
        (data as { errors?: { message?: string }[]; message?: string })?.errors?.[0]
          ?.message ||
        (data as { message?: string })?.message ||
        `HTTP ${res.status}`,
    }
  }
  const updated =
    (data as { docs?: unknown[] })?.docs?.length ??
    (data as { result?: { docs?: unknown[] } })?.result?.docs?.length ??
    0
  return { ok: true, updated }
}

type SelectionContext = {
  count?: number
  getQueryParams?: (additional?: Record<string, unknown>) => string
  selectedIDs?: (string | number)[]
}

const ProductBulkActions: React.FC = () => {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selection = useSelection() as SelectionContext
  const selectedCount = selection?.count ?? 0
  const selectedIDs = selection?.selectedIDs ?? []
  const getQueryParams = selection?.getQueryParams

  const buildSelectedQuery = (): string | null => {
    if (selectedCount === 0) return null
    if (typeof getQueryParams === 'function') return getQueryParams()
    if (selectedIDs.length > 0) {
      const params = selectedIDs.map((id, i) => `where[id][in][${i}]=${encodeURIComponent(String(id))}`).join('&')
      return `?${params}`
    }
    return null
  }

  const patchSelected = async (nextStatus: 'published' | 'archived' | 'draft', label: string) => {
    if (busy) return
    if (selectedCount === 0) {
      setMessage('ℹ️ 請先在下方表格勾選要處理的商品')
      return
    }
    if (
      !window.confirm(
        `將把選定的 ${selectedCount} 筆商品設為「${label}」，確定嗎？`,
      )
    ) {
      setMessage('已取消')
      return
    }
    const qs = buildSelectedQuery()
    if (!qs) {
      setMessage('❌ 無法取得勾選清單')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/products${qs}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          `❌ 切換失敗：${
            (data as { errors?: { message?: string }[]; message?: string })?.errors?.[0]?.message ||
            (data as { message?: string })?.message ||
            `HTTP ${res.status}`
          }`,
        )
        return
      }
      const updated =
        (data as { docs?: unknown[] })?.docs?.length ??
        (data as { result?: { docs?: unknown[] } })?.result?.docs?.length ??
        selectedCount
      setMessage(`✅ 已將 ${updated} 筆商品設為「${label}」（即將重新整理）`)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const trashSelected = async () => {
    if (busy) return
    if (selectedCount === 0) {
      setMessage('ℹ️ 請先在下方表格勾選要移到垃圾桶的商品')
      return
    }
    if (
      !window.confirm(
        `將把選定的 ${selectedCount} 筆商品移到垃圾桶。\n\n7 日內可在「垃圾桶」分頁還原；7 日後系統自動永久刪除。\n\n確定嗎？`,
      )
    ) {
      setMessage('已取消')
      return
    }
    const qs = buildSelectedQuery()
    if (!qs) {
      setMessage('❌ 無法取得勾選清單')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      // Payload v3 trash: PATCH ?where=... { deletedAt: ISO } 等同 admin「移到垃圾桶」按鈕
      const res = await fetch(`/api/products${qs}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedAt: new Date().toISOString() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          `❌ 移到垃圾桶失敗：${
            (data as { errors?: { message?: string }[]; message?: string })?.errors?.[0]?.message ||
            (data as { message?: string })?.message ||
            `HTTP ${res.status}`
          }`,
        )
        return
      }
      const moved =
        (data as { docs?: unknown[] })?.docs?.length ??
        (data as { result?: { docs?: unknown[] } })?.result?.docs?.length ??
        selectedCount
      setMessage(`✅ 已將 ${moved} 筆商品移到垃圾桶（即將重新整理）`)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const publishAllDrafts = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[status][equals]=draft'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 目前沒有草稿商品')
        return
      }
      if (!window.confirm(`將把 ${count} 筆草稿商品設為「已上架」，確定要繼續嗎？`)) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'published' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆草稿商品上架`)
      } else {
        setMessage(`❌ 批次上架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const archiveOutOfStock = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[and][0][stock][equals]=0&where[and][1][status][equals]=published'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 沒有庫存為 0 的上架商品')
        return
      }
      if (
        !window.confirm(
          `將把 ${count} 筆「已上架但庫存 0」的商品設為「已下架」，確定嗎？`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'archived' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆缺貨商品下架`)
      } else {
        setMessage(`❌ 批次下架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const archiveByLowStock = async () => {
    if (busy) return
    const input = window.prompt(
      '將把「已上架且庫存 < N」的商品設為下架。請輸入 N（庫存閾值，例：3）',
      '3',
    )
    if (input == null) return
    const threshold = Number(input)
    if (!Number.isFinite(threshold) || threshold < 0) {
      setMessage('❌ 請輸入大於等於 0 的整數')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const query = `where[and][0][stock][less_than]=${threshold}&where[and][1][status][equals]=published`
      const count = await countWhere(query)
      if (count === 0) {
        setMessage(`ℹ️ 沒有「已上架且庫存 < ${threshold}」的商品`)
        return
      }
      if (
        !window.confirm(
          `將把 ${count} 筆「已上架且庫存 < ${threshold}」的商品設為「已下架」，確定嗎？`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'archived' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆低庫存商品下架`)
      } else {
        setMessage(`❌ 批次下架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const archiveAllPublished = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[status][equals]=published'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 目前沒有已上架商品')
        return
      }
      // 雙重確認 — 破壞性大
      if (
        !window.confirm(
          `⚠️ 將把全部 ${count} 筆「已上架」商品全部下架。確定嗎？（此動作會立刻讓前台所有商品消失）`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const second = window.prompt(
        `再次確認：請輸入「下架全部 ${count} 筆」以確認執行：`,
        '',
      )
      if (second !== `下架全部 ${count} 筆`) {
        setMessage('已取消（確認字串不一致）')
        return
      }

      const result = await bulkPatch(query, { status: 'archived' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆商品全部下架`)
      } else {
        setMessage(`❌ 批次下架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const draftAllArchived = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[status][equals]=archived'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 沒有已下架商品')
        return
      }
      if (
        !window.confirm(
          `將把 ${count} 筆「已下架」商品轉回「草稿」狀態（不會自動上架），確定嗎？`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'draft' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆商品轉為草稿`)
      } else {
        setMessage(`❌ 批次轉草稿失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const applySchedulesNow = async () => {
    if (busy) return
    if (
      !window.confirm(
        '立刻掃描「預定上架/下架時間」並切換符合條件的商品狀態？（也會由 cron 自動跑，這個是手動觸發）',
      )
    ) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/products/apply-schedules', {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        published?: number
        archived?: number
        message?: string
      }
      if (res.ok) {
        setMessage(
          `✅ 排程已執行：上架 ${data.published ?? 0} 筆 / 下架 ${data.archived ?? 0} 筆`,
        )
      } else {
        setMessage(`❌ 排程執行失敗：${data?.message ?? `HTTP ${res.status}`}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const revalidateAll = async () => {
    if (busy) return
    if (!window.confirm('確定要重新產生整個前台快取嗎？（/、/products 會立即更新）')) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/products/revalidate-all', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setMessage('✅ 已觸發全站 revalidate')
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage(
          `❌ Revalidate 失敗：${(data as { message?: string })?.message || `HTTP ${res.status}`}`,
        )
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const btnDanger: React.CSSProperties = {
    ...btn,
    background: '#fef2f2',
    borderColor: '#fecaca',
    color: '#b91c1c',
  }

  const dimWhenIdle: React.CSSProperties = selectedCount === 0 ? { opacity: 0.5 } : {}

  return (
    <div style={panel}>
      <h4 style={title}>⚡ 批次操作</h4>
      <div style={{ ...btnRow, marginBottom: 8 }}>
        <button type="button" style={btn} onClick={publishAllDrafts} disabled={busy}>
          ✅ 批次上架所有草稿
        </button>
        <button type="button" style={btn} onClick={draftAllArchived} disabled={busy}>
          📝 將已下架轉回草稿
        </button>
        <button type="button" style={btn} onClick={applySchedulesNow} disabled={busy}>
          ⏰ 立刻執行排程上下架
        </button>
        <button type="button" style={btn} onClick={revalidateAll} disabled={busy}>
          🔄 全站快取重新生成
        </button>
      </div>
      <div style={btnRow}>
        <button type="button" style={btn} onClick={archiveOutOfStock} disabled={busy}>
          📦 庫存 0 自動下架
        </button>
        <button type="button" style={btn} onClick={archiveByLowStock} disabled={busy}>
          📉 依庫存閾值下架（輸入 N）
        </button>
        <button type="button" style={btnDanger} onClick={archiveAllPublished} disabled={busy}>
          ⚠️ 全部下架（停售/暫停營業用）
        </button>
      </div>

      <hr
        style={{
          margin: '14px 0 10px',
          border: 'none',
          borderTop: '1px dashed var(--theme-elevation-200, #d4d4d8)',
        }}
      />
      <h4 style={title}>
        🎯 對勾選的商品執行
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            fontWeight: 500,
            color: selectedCount > 0 ? 'var(--color-brand-gold, #c19a5b)' : '#888',
          }}
        >
          （已勾選 {selectedCount} 筆）
        </span>
      </h4>
      {selectedCount === 0 && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          ※ 請在下方表格每列最左側的 checkbox 勾選要處理的商品；勾選後再點下面的按鈕。
          <br />
          ※ 「移到垃圾桶」是軟刪除，7 日內可在側邊欄「商品（垃圾桶）」分頁還原；7 日後系統自動永久刪除。
        </div>
      )}
      <div style={btnRow}>
        <button
          type="button"
          style={{ ...btn, ...dimWhenIdle }}
          onClick={() => patchSelected('published', '已上架')}
          disabled={busy || selectedCount === 0}
        >
          ✅ 上架選定 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btn, ...dimWhenIdle }}
          onClick={() => patchSelected('archived', '已下架')}
          disabled={busy || selectedCount === 0}
        >
          📦 下架選定 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btn, ...dimWhenIdle }}
          onClick={() => patchSelected('draft', '草稿')}
          disabled={busy || selectedCount === 0}
        >
          📝 轉為草稿 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btnDanger, ...dimWhenIdle }}
          onClick={trashSelected}
          disabled={busy || selectedCount === 0}
          title="軟刪除：7 日內可在「垃圾桶」分頁還原；7 日後自動永久刪除"
        >
          🗑️ 移到垃圾桶 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
      </div>

      {message && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: message.startsWith('✅')
              ? '#0a0'
              : message.startsWith('ℹ️')
                ? '#666'
                : '#c00',
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}

export default ProductBulkActions
