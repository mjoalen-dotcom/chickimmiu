'use client'

/**
 * VariantMatrixGenerator
 * ──────────────────────
 * 在「商品編輯 → 變體與庫存」Tab 中提供一個小工具，快速以
 * 「顏色 × 尺寸」笛卡兒積產生變體列。
 *
 * 工作原理：
 *   1. 透過 useDocumentInfo() 取得目前商品的 id / slug（必須已儲存）
 *   2. 由使用者輸入顏色、尺寸、SKU 前綴、預設庫存
 *   3. 先 GET /api/products/{id}?depth=0 拿最新 variants
 *   4. 根據模式（取代 / 附加）組合新的 variants 陣列
 *   5. PATCH /api/products/{id} 寫回
 *   6. 成功後 reload 目前頁面，確保表單顯示最新資料
 *
 * 為何不直接用 useField 操作陣列欄位：Payload v3 的 array 欄位內部
 * 以 `variants.N.fieldName` 的路徑展開，且每列有 `id`，從 client 端
 * 直接寫入極易破壞狀態。走 REST API 最安全且可搭配 beforeChange
 * 驗證（SKU 重複、stock 加總、低庫存）自動跑過。
 */

import React, { useMemo, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type ColorRow = { name: string; hex: string }
type Mode = 'replace' | 'append'

const panel: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  padding: 16,
  margin: '12px 0 24px',
  background: 'var(--theme-elevation-50, #fafafa)',
}

const title: React.CSSProperties = {
  margin: 0,
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--theme-elevation-900, #111)',
}

const hint: React.CSSProperties = {
  margin: 0,
  marginBottom: 12,
  fontSize: 12,
  color: 'var(--theme-elevation-600, #666)',
}

const rowGap: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginBottom: 8,
  flexWrap: 'wrap',
}

const input: React.CSSProperties = {
  flex: '1 1 120px',
  padding: '6px 10px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  borderRadius: 6,
  background: 'var(--theme-elevation-0, #fff)',
  fontSize: 13,
}

const smallBtn: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: 'var(--theme-elevation-0, #fff)',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  background: '#C19A5B',
  color: '#fff',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'c'
  )
}

const VariantMatrixGenerator: React.FC = () => {
  const { id: docId } = useDocumentInfo()
  const [colors, setColors] = useState<ColorRow[]>([
    { name: '', hex: '' },
  ])
  const [sizesText, setSizesText] = useState('S,M,L')
  const [skuPrefix, setSkuPrefix] = useState('')
  const [defaultStock, setDefaultStock] = useState(5)
  const [mode, setMode] = useState<Mode>('replace')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const parsedSizes = useMemo(
    () =>
      sizesText
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [sizesText],
  )

  const validColors = useMemo(
    () => colors.filter((c) => c.name.trim()),
    [colors],
  )

  const rowCount = validColors.length * parsedSizes.length

  if (!docId) {
    return (
      <div style={panel}>
        <h4 style={title}>🎨 變體矩陣產生器</h4>
        <p style={hint}>
          請先儲存商品（建立後）再使用本工具。本工具會以「顏色 × 尺寸」笛卡兒積
          自動產生變體列，SKU 重複驗證與庫存加總會由系統自動完成。
        </p>
      </div>
    )
  }

  const addColor = () => setColors([...colors, { name: '', hex: '' }])
  const updateColor = (i: number, patch: Partial<ColorRow>) =>
    setColors(colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const removeColor = (i: number) =>
    setColors(colors.filter((_, idx) => idx !== i))

  const generate = async () => {
    if (validColors.length === 0) {
      setMessage('❌ 請至少輸入 1 個顏色名稱')
      return
    }
    if (parsedSizes.length === 0) {
      setMessage('❌ 請至少輸入 1 個尺寸')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      // 1) 取最新 doc 以拿到現有 variants 與 productSku（作為 SKU 預設前綴）
      const currentRes = await fetch(`/api/products/${docId}?depth=0`, {
        credentials: 'include',
      })
      if (!currentRes.ok) {
        throw new Error('無法讀取目前商品資料')
      }
      const current = await currentRes.json()
      const existing: Array<Record<string, unknown>> = Array.isArray(current.variants)
        ? current.variants
        : []

      const prefix = (skuPrefix || (current.productSku as string) || 'PROD').trim()

      const newRows = validColors.flatMap((c) =>
        parsedSizes.map((size) => ({
          colorName: c.name.trim(),
          colorCode: c.hex.trim() || undefined,
          size,
          sku: `${prefix}-${slugify(c.name)}-${size}`,
          stock: defaultStock,
        })),
      )

      // 2) 合併策略
      let finalVariants: Array<Record<string, unknown>>
      if (mode === 'replace') {
        finalVariants = newRows
      } else {
        // append：以 sku 去重，新的蓋掉舊的
        const map = new Map<string, Record<string, unknown>>()
        for (const row of existing) {
          const sku = typeof row.sku === 'string' ? row.sku : ''
          if (sku) map.set(sku, row)
        }
        for (const row of newRows) map.set(row.sku, row)
        finalVariants = Array.from(map.values())
      }

      // 3) PATCH 寫回
      const res = await fetch(`/api/products/${docId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: finalVariants }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const msg =
          errBody?.errors?.[0]?.message || errBody?.message || `HTTP ${res.status}`
        throw new Error(msg)
      }

      setMessage(`✅ 已寫入 ${finalVariants.length} 筆變體，正在重新載入頁面...`)
      setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      setMessage(`❌ 產生失敗：${err instanceof Error ? err.message : '未知錯誤'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={panel}>
      <h4 style={title}>🎨 變體矩陣產生器</h4>
      <p style={hint}>
        輸入顏色 + 尺寸後，一鍵產生「顏色 × 尺寸」所有組合的變體（SKU 會自動組合）。
        產生後系統會自動驗證 SKU 不重複並加總庫存。
      </p>

      {/* 顏色列 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>顏色</div>
        {colors.map((c, i) => (
          <div key={i} style={rowGap}>
            <input
              style={input}
              placeholder="顏色名稱，例如 米杏白"
              value={c.name}
              onChange={(e) => updateColor(i, { name: e.target.value })}
            />
            <input
              style={{ ...input, flex: '0 0 120px' }}
              placeholder="#HEX（選填）"
              value={c.hex}
              onChange={(e) => updateColor(i, { hex: e.target.value })}
            />
            {c.hex && (
              <span
                style={{
                  display: 'inline-block',
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  background: c.hex,
                }}
              />
            )}
            {colors.length > 1 && (
              <button
                type="button"
                style={smallBtn}
                onClick={() => removeColor(i)}
              >
                移除
              </button>
            )}
          </div>
        ))}
        <button type="button" style={smallBtn} onClick={addColor}>
          ＋ 新增顏色
        </button>
      </div>

      {/* 尺寸 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          尺寸（逗號、空白或頓號分隔）
        </div>
        <input
          style={{ ...input, width: '100%' }}
          value={sizesText}
          onChange={(e) => setSizesText(e.target.value)}
          placeholder="S, M, L, XL"
        />
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          解析出 {parsedSizes.length} 個尺寸：
          {parsedSizes.length > 0 ? parsedSizes.join(' / ') : '（無）'}
        </div>
      </div>

      {/* SKU 前綴 + 預設庫存 */}
      <div style={rowGap}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            SKU 前綴（留空會用「商品總 SKU」欄位）
          </div>
          <input
            style={{ ...input, width: '100%' }}
            value={skuPrefix}
            onChange={(e) => setSkuPrefix(e.target.value)}
            placeholder="例如 CKMU-DRESS-001"
          />
        </div>
        <div style={{ flex: '0 0 140px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            預設庫存
          </div>
          <input
            type="number"
            min={0}
            style={{ ...input, width: '100%' }}
            value={defaultStock}
            onChange={(e) => setDefaultStock(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* 合併模式 + 執行 */}
      <div style={{ ...rowGap, marginTop: 12 }}>
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="radio"
            name="vm-mode"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
          />
          取代所有現有變體
        </label>
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="radio"
            name="vm-mode"
            checked={mode === 'append'}
            onChange={() => setMode('append')}
          />
          附加（SKU 相同則覆蓋）
        </label>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
          將產生 <strong>{rowCount}</strong> 筆
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          style={{ ...primaryBtn, opacity: busy ? 0.5 : 1 }}
          disabled={busy || rowCount === 0}
          onClick={generate}
        >
          {busy ? '產生中…' : `🚀 產生 ${rowCount} 筆變體`}
        </button>
        {message && (
          <div style={{ fontSize: 12, color: message.startsWith('✅') ? '#0a0' : '#c00' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default VariantMatrixGenerator
