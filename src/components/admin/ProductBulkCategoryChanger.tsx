'use client'

/**
 * ProductBulkCategoryChanger
 * ──────────────────────────
 * 顯示在「商品列表」頁面上方的批次改分類面板。讀取 Payload 列表頁的勾選
 * 狀態，呼叫 /api/products/admin/bulk-fix-links（PR-η, action: 'assign-category'）。
 *
 * 互動流程：
 *   1. 在列表頁勾選一支或多支商品（勾選欄位是 Payload List 內建）
 *   2. 在面板選一個目標分類
 *   3. 按「一鍵套用到所選 N 筆」→ confirm → 後端 bulk PATCH
 *   4. 完成後 router.refresh() 讓 List 重抓
 *
 * 為什麼放在 beforeListTable：
 *   useSelection 需要在 SelectionProvider context 內。Payload v3 List view
 *   會在外層包 SelectionProvider，beforeListTable 也在 provider 底下，所以
 *   可以直接 useSelection()。
 *
 * 重用：
 *   /api/products/admin/bulk-fix-links（PR-η 加的 endpoint）
 *   action: 'assign-category', body: { productIds, toCategoryId }
 */

import React, { useEffect, useState } from 'react'
import { useSelection } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

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

const row: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 6,
  background: 'var(--theme-elevation-0, #fff)',
  color: 'var(--theme-elevation-900, #111)',
  minWidth: 220,
}

const btn: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: '#C19A5B',
  color: 'white',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const btnDisabled: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

type CategoryOption = { id: number; name: string; slug?: string }

const ProductBulkCategoryChanger: React.FC = () => {
  // useSelection 必須在 SelectionProvider scope 內呼叫；Payload List 已自帶
  const selection = useSelection()
  const router = useRouter()

  const [cats, setCats] = useState<CategoryOption[]>([])
  const [target, setTarget] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/categories?limit=1000&depth=0', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((j: { docs?: Array<{ id: number; name: string; slug?: string }> }) => {
        const docs = Array.isArray(j.docs) ? j.docs : []
        setCats(
          docs
            .map((d) => ({ id: d.id, name: d.name, slug: d.slug }))
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW')),
        )
      })
      .catch(() => {
        /* dropdown 沒載到也不影響 — button 會 disable */
      })
  }, [])

  const selectedIds = selection?.selectedIDs ?? []
  const selectedCount = selection?.count ?? 0

  const apply = async () => {
    if (busy) return
    if (selectedCount === 0) {
      setMsg('ℹ️ 請先在表格勾選要修改的商品')
      return
    }
    if (target === '') {
      setMsg('ℹ️ 請選一個目標分類')
      return
    }
    const targetCat = cats.find((c) => c.id === target)

    if (
      !window.confirm(
        `將把所選的 ${selectedCount} 筆商品改成分類「${targetCat?.name ?? target}」，確定嗎？`,
      )
    ) {
      return
    }

    setBusy(true)
    setMsg('')
    try {
      const productIds = selectedIds
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => Number.isFinite(n))

      const r = await fetch('/api/products/admin/bulk-fix-links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-category',
          productIds,
          toCategoryId: target,
        }),
      })

      if (!r.ok) {
        const t = await r.text()
        throw new Error(`HTTP ${r.status}：${t.slice(0, 200)}`)
      }
      const j = (await r.json()) as { updated?: number; errors?: unknown[] }
      const updated = j.updated ?? 0
      const errCount = Array.isArray(j.errors) ? j.errors.length : 0
      setMsg(
        errCount > 0
          ? `⚠️ 完成：${updated} 筆成功，${errCount} 筆失敗（看 server log）`
          : `✅ 完成：${updated} 筆已改成「${targetCat?.name ?? target}」`,
      )
      // 重新整理 List
      router.refresh()
    } catch (e) {
      setMsg(`❌ 失敗：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={panel}>
      <h4 style={title}>🏷️ 批次改分類（勾選列）</h4>
      <div style={row}>
        <span style={{ fontSize: 13, color: 'var(--theme-elevation-700, #555)' }}>
          已勾選 <strong>{selectedCount}</strong> 筆
        </span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : '')}
          disabled={busy || cats.length === 0}
          style={selectStyle}
        >
          <option value="">— 選擇目標分類 —</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.slug ? ` (${c.slug})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={apply}
          disabled={busy || selectedCount === 0 || target === ''}
          style={{
            ...btn,
            ...(busy || selectedCount === 0 || target === '' ? btnDisabled : {}),
          }}
        >
          {busy ? '處理中…' : `一鍵套用到所選 ${selectedCount} 筆`}
        </button>
        {msg && (
          <span
            style={{
              fontSize: 12,
              color: msg.startsWith('✅')
                ? '#0a0'
                : msg.startsWith('ℹ️') || msg.startsWith('⚠️')
                  ? '#666'
                  : '#c00',
            }}
          >
            {msg}
          </span>
        )}
      </div>
      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          fontSize: 11,
          color: 'var(--theme-elevation-600, #666)',
        }}
      >
        若選「全部商品（跨頁全選）」，僅會套用到目前已展開到記憶體的列；如要跨大量頁，請改用上方 ⚡ 批次操作。
      </p>
    </div>
  )
}

export default ProductBulkCategoryChanger
