'use client'

/**
 * ShoplineXlsxImporter
 * ─────────────────────
 * 放在商品列表頁上方。直接接收 SHOPLINE BulkUpdateForm .xlsx 檔案，
 * 先跑 dry-run 顯示預覽（多少商品、幾個變體、無法對應的分類、前 5 筆樣本），
 * 按「確認匯入」後才真正寫入 Payload。
 *
 * 對應後端：`/api/products/shopline-xlsx`
 *   dryRun=1 → 預覽（預設）
 *   dryRun=0 → 實際寫入
 *   limit=N → 僅處理前 N 筆（快速測試用）
 */

import React, { useRef, useState } from 'react'

type DryRunSample = {
  shoplineProductId: string
  name: string
  slug: string
  price: number
  salePrice?: number
  status: string
  category?: { slug?: string; name?: string }
  variantCount: number
  firstVariant?: {
    colorName?: string
    size?: string
    sku?: string
    stock?: number
  }
  warnings: string[]
  errors: string[]
}

type DryRunReport = {
  success: true
  mode: 'dry-run'
  totalRowsInFile: number
  totalProductsParsed: number
  totalVariantsParsed: number
  willProcess: number
  unmappedCategories: string[]
  sample: DryRunSample[]
}

type CommitReport = {
  success: true
  mode: 'commit'
  totalProductsParsed: number
  processed: number
  created: number
  updated: number
  failed: number
  unmappedCategories: string[]
  results: {
    shoplineProductId: string
    name: string
    action: 'created' | 'updated' | 'skipped' | 'error'
    id?: number
    message?: string
  }[]
}

type ApiReport = DryRunReport | CommitReport

const panel: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  padding: 16,
  margin: '12px 0',
  background: 'var(--theme-elevation-50, #fafafa)',
}

const title: React.CSSProperties = {
  margin: 0,
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 600,
}

const hint: React.CSSProperties = {
  margin: 0,
  marginBottom: 12,
  fontSize: 12,
  color: 'var(--theme-elevation-600, #666)',
}

const btn: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: 'var(--theme-elevation-0, #fff)',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  ...btn,
  background: '#C19A5B',
  color: '#fff',
  border: 'none',
}

const statBox: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
  padding: 12,
  background: 'var(--theme-elevation-0, #fff)',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  marginTop: 12,
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 90 }}>
      <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const ShoplineXlsxImporter: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [limit, setLimit] = useState<number>(0) // 0 = 全部
  const [busy, setBusy] = useState(false)
  const [dryRun, setDryRun] = useState<DryRunReport | null>(null)
  const [commit, setCommit] = useState<CommitReport | null>(null)
  const [error, setError] = useState('')

  const reset = () => {
    setFile(null)
    setDryRun(null)
    setCommit(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const upload = async (mode: 'dryRun' | 'commit') => {
    if (!file) {
      setError('請先選擇一個 Shopline BulkUpdateForm .xlsx 檔案')
      return
    }
    setBusy(true)
    setError('')
    if (mode === 'dryRun') setCommit(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const qs = new URLSearchParams({
        dryRun: mode === 'dryRun' ? '1' : '0',
      })
      if (limit > 0) qs.set('limit', String(limit))
      const res = await fetch(`/api/products/shopline-xlsx?${qs.toString()}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = (await res.json()) as { success?: boolean; message?: string } & ApiReport
      if (!res.ok || !data.success) {
        setError(`${(data as { message?: string }).message || `HTTP ${res.status}`}`)
        return
      }
      if (data.mode === 'dry-run') setDryRun(data as DryRunReport)
      else setCommit(data as CommitReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知錯誤')
    } finally {
      setBusy(false)
    }
  }

  const onCommit = async () => {
    if (!dryRun) return
    const willProcess = dryRun.willProcess
    if (
      !window.confirm(
        `即將寫入 ${willProcess} 筆商品到資料庫，以 Shopline Product ID 為 upsert key。\n\n` +
          `已存在 → 更新；不存在 → 新增。此動作無法自動回滾。\n確定要繼續嗎？`,
      )
    )
      return
    await upload('commit')
  }

  return (
    <div style={panel}>
      <h4 style={title}>📥 SHOPLINE BulkUpdateForm 匯入（.xlsx）</h4>
      <p style={hint}>
        直接上傳 SHOPLINE 後台匯出的 <strong>BulkUpdateForm.xlsx</strong>。會自動略過 Row 2
        繁中說明列、以 <code>Product ID</code> 分組多列變體、解析「顏色 + 尺寸」至每個變體。
        先按「預覽」會跑 dry-run 不會寫入，確認無誤後再按「確認匯入」。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null)
            setDryRun(null)
            setCommit(null)
          }}
          style={{ fontSize: 13 }}
        />
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
          僅處理前
          <input
            type="number"
            min={0}
            value={limit}
            onChange={(e) => setLimit(Math.max(0, Number(e.target.value) || 0))}
            style={{
              width: 60,
              padding: '4px 6px',
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
          筆（0 = 全部）
        </label>
        <button
          type="button"
          style={{ ...btn, opacity: busy || !file ? 0.5 : 1 }}
          disabled={busy || !file}
          onClick={() => upload('dryRun')}
        >
          🔍 預覽（dry-run）
        </button>
        {dryRun && (
          <button
            type="button"
            style={{ ...primaryBtn, opacity: busy ? 0.5 : 1 }}
            disabled={busy}
            onClick={onCommit}
          >
            ✅ 確認匯入 {dryRun.willProcess} 筆
          </button>
        )}
        {(dryRun || commit || file) && (
          <button type="button" style={btn} onClick={reset} disabled={busy}>
            清除
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 10, color: '#c00', fontSize: 12 }}>
          ❌ {error}
        </div>
      )}

      {busy && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
          處理中，請稍候⋯（大檔案可能需要 10-30 秒）
        </div>
      )}

      {/* ── Dry-run 預覽 ── */}
      {dryRun && (
        <>
          <div style={statBox}>
            <Stat label="檔案總列數" value={dryRun.totalRowsInFile} />
            <Stat label="商品數" value={dryRun.totalProductsParsed} />
            <Stat label="變體數" value={dryRun.totalVariantsParsed} />
            <Stat label="將處理" value={dryRun.willProcess} />
            <Stat
              label="未對應分類"
              value={dryRun.unmappedCategories.length}
            />
          </div>

          {dryRun.unmappedCategories.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: '#fff8e1',
                border: '1px solid #f0c14b',
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              ⚠️ 無法對應的分類（將全部落到「Shopline 匯入」分類）：
              <div style={{ marginTop: 4, color: '#8a6d3b' }}>
                {dryRun.unmappedCategories.join('、')}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600 }}>
            前 5 筆樣本：
          </div>
          <div style={{ marginTop: 6 }}>
            {dryRun.sample.map((s) => (
              <div
                key={s.shoplineProductId}
                style={{
                  padding: 10,
                  border: '1px solid #eee',
                  borderRadius: 6,
                  marginBottom: 6,
                  background: '#fff',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {s.name}{' '}
                  <span style={{ color: '#888', fontWeight: 400 }}>
                    ({s.shoplineProductId})
                  </span>
                </div>
                <div style={{ color: '#666' }}>
                  slug: <code>{s.slug}</code> · 價格: {s.price}
                  {s.salePrice ? ` / 特價 ${s.salePrice}` : ''} · 狀態: {s.status}
                  {' · '}分類: {s.category?.name || s.category?.slug || '—'}
                  {' · '}變體: {s.variantCount}
                </div>
                {s.firstVariant && (
                  <div style={{ color: '#888', marginTop: 2 }}>
                    首筆變體: {s.firstVariant.colorName || '—'} /{' '}
                    {s.firstVariant.size} / SKU {s.firstVariant.sku} / 庫存{' '}
                    {s.firstVariant.stock}
                  </div>
                )}
                {s.warnings.length > 0 && (
                  <div style={{ color: '#c80', marginTop: 2 }}>
                    ⚠️ {s.warnings.join('; ')}
                  </div>
                )}
                {s.errors.length > 0 && (
                  <div style={{ color: '#c00', marginTop: 2 }}>
                    ❌ {s.errors.join('; ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Commit 結果 ── */}
      {commit && (
        <>
          <div style={statBox}>
            <Stat label="處理總數" value={commit.processed} />
            <Stat label="新增" value={commit.created} />
            <Stat label="更新" value={commit.updated} />
            <Stat label="失敗" value={commit.failed} />
          </div>
          {commit.failed > 0 && (
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <strong>失敗列表：</strong>
              {commit.results
                .filter((r) => r.action === 'error')
                .slice(0, 20)
                .map((r) => (
                  <div key={r.shoplineProductId} style={{ color: '#c00', marginTop: 4 }}>
                    {r.name} ({r.shoplineProductId}): {r.message}
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ShoplineXlsxImporter
