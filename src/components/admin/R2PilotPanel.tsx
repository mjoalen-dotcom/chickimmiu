'use client'

/**
 * R2PilotPanel
 * ────────────
 * automation P0 PR3 配套 — 跑 1 顆商品的 1-5 張圖直寫 R2 來驗 wiring，
 * 在 7226 個商品 bulk migration 之前先看：
 *   - R2 plugin 真的 takeover 了？
 *   - 上傳延遲多久？
 *   - PDP 載圖速度有沒有變慢？
 *   - 設了 custom domain 的話 CSP / CORS 有沒有擋？
 *
 * 對應後端：POST /api/products/r2-pilot
 */

import React, { useState } from 'react'

type PilotResult = {
  url: string
  success: boolean
  mediaId?: number
  mediaFilename?: string
  sizeBytes?: number
  fetchMs?: number
  uploadMs?: number
  error?: string
}

type PilotResponse = {
  success: boolean
  productId: number
  productSlug?: string
  pdpUrl: string | null
  totalElapsedMs: number
  successCount: number
  failCount: number
  results: PilotResult[]
}

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  marginTop: 8,
  marginBottom: 4,
  color: 'var(--theme-elevation-700, #444)',
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--theme-elevation-200, #ddd)',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: 'inherit',
  background: 'var(--theme-input-bg, #fff)',
  color: 'var(--theme-input-fg, #111)',
}

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 100,
  fontFamily: 'monospace',
  fontSize: 12,
}

const btn: React.CSSProperties = {
  background: 'var(--theme-success-500, #16a34a)',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}

const btnDisabled: React.CSSProperties = {
  ...btn,
  background: 'var(--theme-elevation-300, #ccc)',
  cursor: 'not-allowed',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  marginTop: 12,
}

const thStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--theme-elevation-200, #e4e4e7)',
  padding: '6px 8px',
  textAlign: 'left',
  background: 'var(--theme-elevation-100, #f5f5f5)',
}

const tdStyle: React.CSSProperties = {
  borderBottom: '1px dashed var(--theme-elevation-100, #f0f0f0)',
  padding: '6px 8px',
  verticalAlign: 'top',
}

const R2PilotPanel: React.FC = () => {
  const [productSlugOrId, setProductSlugOrId] = useState('')
  const [imageUrls, setImageUrls] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<PilotResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const urlList = imageUrls
    .split(/[\n,;]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u))

  const canRun = !busy && productSlugOrId.trim().length > 0 && urlList.length > 0 && urlList.length <= 5

  const reset = () => {
    setReport(null)
    setErrorMsg(null)
  }

  const submit = async () => {
    setBusy(true)
    setReport(null)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/products/r2-pilot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSlugOrId: productSlugOrId.trim(),
          imageUrls: urlList,
        }),
      })
      const json = (await res.json()) as PilotResponse | { success: false; message?: string }
      if (!res.ok || !('results' in json)) {
        setErrorMsg(
          ('message' in json && json.message) ||
            `pilot 失敗 (HTTP ${res.status})`,
        )
        setBusy(false)
        return
      }
      setReport(json as PilotResponse)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <details style={panel} open>
      <summary style={{ cursor: 'pointer', listStyle: 'revert' }}>
        <span style={title}>🚀 R2 Pilot — 跑這顆商品 1-5 張圖到 R2</span>
      </summary>
      <p style={hint}>
        在跑全 7226 個商品 bulk migration 之前，先用 1 顆商品驗 R2 wiring +
        PDP 載圖速度。每張圖會：HTTP GET → Payload Media → s3Storage plugin → R2 bucket，
        並計時 fetch / upload latency。新圖會 <strong>append</strong> 到該商品 images
        （不覆蓋既有），同時把 <code>imageMigration.status</code> 標 <code>done</code>。
      </p>

      <label style={labelStyle}>商品 slug 或 ID</label>
      <input
        type="text"
        value={productSlugOrId}
        onChange={(e) => setProductSlugOrId(e.target.value)}
        placeholder="例如 black-formal-dress-ss25-001 或 1234"
        style={input}
        disabled={busy}
      />

      <label style={labelStyle}>圖片 URLs（每行 1 個，最多 5 個 https）</label>
      <textarea
        value={imageUrls}
        onChange={(e) => setImageUrls(e.target.value)}
        placeholder={'https://example.com/img1.jpg\nhttps://example.com/img2.jpg'}
        style={textarea}
        disabled={busy}
      />
      <p style={{ ...hint, marginTop: 4 }}>
        當前偵測到 <strong>{urlList.length}</strong> 個有效 URL。
        {urlList.length > 5 && ' ⚠️ 超過 5 個，只取前 5。'}
      </p>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={submit}
          disabled={!canRun}
          style={canRun ? btn : btnDisabled}
        >
          {busy ? '跑 pilot 中…' : '🚀 跑 R2 pilot'}
        </button>
        {(report || errorMsg) && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            style={{
              ...btn,
              background: 'var(--theme-elevation-200, #e4e4e7)',
              color: 'var(--theme-elevation-800, #333)',
            }}
          >
            清空結果
          </button>
        )}
      </div>

      {errorMsg && (
        <p style={{ ...hint, color: 'var(--theme-error-500, #dc2626)', marginTop: 12 }}>
          ❌ {errorMsg}
        </p>
      )}

      {report && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 8 }}>
            <span>
              ✅ 成功 <strong>{report.successCount}</strong> 張
            </span>
            <span>
              ❌ 失敗 <strong>{report.failCount}</strong> 張
            </span>
            <span>
              ⏱ 總計 <strong>{report.totalElapsedMs} ms</strong>
            </span>
            {report.pdpUrl && (
              <a
                href={report.pdpUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--theme-success-500, #16a34a)' }}
              >
                🔗 開 PDP 驗載圖：{report.pdpUrl}
              </a>
            )}
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>URL</th>
                <th style={thStyle}>結果</th>
                <th style={thStyle}>大小</th>
                <th style={thStyle}>fetch ms</th>
                <th style={thStyle}>upload ms</th>
                <th style={thStyle}>media</th>
              </tr>
            </thead>
            <tbody>
              {report.results.map((r, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {r.url}
                  </td>
                  <td style={tdStyle}>
                    {r.success ? '✅' : `❌ ${r.error || ''}`}
                  </td>
                  <td style={tdStyle}>
                    {r.sizeBytes ? `${(r.sizeBytes / 1024).toFixed(1)} KB` : '—'}
                  </td>
                  <td style={tdStyle}>{r.fetchMs ?? '—'}</td>
                  <td style={tdStyle}>{r.uploadMs ?? '—'}</td>
                  <td style={tdStyle}>
                    {r.mediaId ? `#${r.mediaId} ${r.mediaFilename || ''}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}

export default R2PilotPanel
