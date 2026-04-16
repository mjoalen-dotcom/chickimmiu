'use client'

/**
 * ProductBulkActions
 * ──────────────────
 * 顯示於「商品列表」頁面上方的一個快速批次操作面板。
 *
 * 功能：
 *   1. 批次上架：將所有 status='draft' 的商品設為 'published'
 *   2. 批次下架：將所有庫存 = 0 的商品設為 'archived'
 *   3. 全站快取 revalidate：呼叫自訂 endpoint，重新產生 /、/products 快取
 *
 * 每個動作前會先以 `?where=...&limit=0` 預覽符合條件的商品數量，
 * 然後要求使用者在 confirm() 中二次確認，避免誤觸。
 *
 * 所有批次 PATCH 走 Payload 標準 REST API：
 *   PATCH /api/products?where[...]=...   body 為共用欄位
 */

import React, { useState } from 'react'

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

const ProductBulkActions: React.FC = () => {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

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

  return (
    <div style={panel}>
      <h4 style={title}>⚡ 批次操作</h4>
      <div style={btnRow}>
        <button type="button" style={btn} onClick={publishAllDrafts} disabled={busy}>
          ✅ 批次上架所有草稿
        </button>
        <button type="button" style={btn} onClick={archiveOutOfStock} disabled={busy}>
          📦 將「已上架但庫存 0」設為下架
        </button>
        <button type="button" style={btn} onClick={revalidateAll} disabled={busy}>
          🔄 全站快取重新生成
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
