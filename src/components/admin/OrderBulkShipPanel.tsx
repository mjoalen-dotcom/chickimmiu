'use client'

import React, { useMemo, useState } from 'react'

const CARRIERS: Array<{ code: string; label: string }> = [
  { code: '711', label: '7-ELEVEN 取貨' },
  { code: 'family', label: '全家便利商店' },
  { code: 'hilife', label: '萊爾富' },
  { code: 'ok', label: 'OK 超商' },
  { code: 'tcat', label: '黑貓宅急便' },
  { code: 'hct', label: '新竹物流' },
  { code: 'kerry', label: '嘉里大榮' },
  { code: 'post', label: '中華郵政' },
]

type Mode = 'uniform' | 'mapping'

type ResultRow = { orderNumber: string; reason?: string }

type Result = {
  succeededCount: number
  skippedCount: number
  succeeded: ResultRow[]
  skipped: ResultRow[]
}

const panelStyle: React.CSSProperties = {
  marginBottom: 24,
  border: '1px solid #E8DDD0',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#fff',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  cursor: 'pointer',
  background: '#f5f3ee',
  borderBottom: '1px solid #E8DDD0',
  userSelect: 'none',
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  background: '#C19A5B',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnOutline: React.CSSProperties = {
  ...btnStyle,
  background: 'transparent',
  color: '#C19A5B',
  border: '1px solid #C19A5B',
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 500,
  background: active ? '#1A1F36' : 'transparent',
  color: active ? '#fff' : '#1A1F36',
  border: '1px solid #1A1F36',
  borderRadius: 6,
  cursor: 'pointer',
})

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 13,
  border: '1px solid #d0cec7',
  borderRadius: 4,
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#6B6560',
  marginBottom: 4,
}

function parseCsvRows(text: string): Array<{ orderNumber: string; carrier: string; trackingNumber: string }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  // Skip header if first line contains non-numeric carrier-like token
  const startIdx =
    lines[0].toLowerCase().includes('ordernumber') || lines[0].includes('訂單') ? 1 : 0
  const out: Array<{ orderNumber: string; carrier: string; trackingNumber: string }> = []
  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim())
    if (cells.length < 3) continue
    const [orderNumber, carrier, trackingNumber] = cells
    if (!orderNumber || !carrier || !trackingNumber) continue
    out.push({ orderNumber, carrier, trackingNumber })
  }
  return out
}

export default function OrderBulkShipPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('uniform')

  // uniform-mode state
  const [orderNumbersText, setOrderNumbersText] = useState('')
  const [uniformCarrier, setUniformCarrier] = useState('tcat')
  const [uniformTracking, setUniformTracking] = useState('')

  // mapping-mode state
  const [csvText, setCsvText] = useState('')

  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string>('')

  const uniformOrderNumbers = useMemo(
    () =>
      orderNumbersText
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean),
    [orderNumbersText],
  )
  const mappingRows = useMemo(() => parseCsvRows(csvText), [csvText])

  const previewCount = mode === 'uniform' ? uniformOrderNumbers.length : mappingRows.length

  const submit = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const body =
        mode === 'uniform'
          ? {
              mode: 'uniform' as const,
              orderNumbers: uniformOrderNumbers,
              carrier: uniformCarrier,
              trackingNumber: uniformTracking,
            }
          : {
              mode: 'mapping' as const,
              rows: mappingRows,
            }
      const res = await fetch('/api/admin/orders/bulk-ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '送出失敗')
      } else {
        setResult(data)
        if (data.succeededCount > 0) {
          // Refresh list view to reflect new status
          setTimeout(() => window.location.reload(), 1500)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = !busy && previewCount > 0 &&
    (mode === 'uniform' ? Boolean(uniformCarrier && uniformTracking) : true)

  return (
    <div style={panelStyle}>
      <div style={headerStyle} onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#1A1F36' }}>
          <span style={{ fontSize: 16 }}>批次出貨</span>
          <span style={{ fontSize: 12, color: '#6B6560', fontWeight: 400 }}>
            （填託運單號 + 自動標記 shipped + 寄出貨通知信）
          </span>
        </div>
        <span style={{ fontSize: 18, color: '#888', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          v
        </span>
      </div>

      {isOpen && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" style={tabStyle(mode === 'uniform')} onClick={() => setMode('uniform')}>
              統一託運（同一物流商 + 同一單號）
            </button>
            <button type="button" style={tabStyle(mode === 'mapping')} onClick={() => setMode('mapping')}>
              CSV 對應（一行一張單）
            </button>
          </div>

          {mode === 'uniform' && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>訂單編號（一行一個，或用逗號分隔）</label>
                <textarea
                  value={orderNumbersText}
                  onChange={(e) => setOrderNumbersText(e.target.value)}
                  rows={5}
                  placeholder={'CKMU-20260427-001\nCKMU-20260427-002\n...'}
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>物流商</label>
                  <select
                    value={uniformCarrier}
                    onChange={(e) => setUniformCarrier(e.target.value)}
                    style={inputStyle}
                  >
                    {CARRIERS.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>託運單號</label>
                  <input
                    type="text"
                    value={uniformTracking}
                    onChange={(e) => setUniformTracking(e.target.value)}
                    style={inputStyle}
                    placeholder="所有勾選訂單將套用此單號"
                  />
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#6B6560' }}>
                ⚠ 統一託運會把所有列印同一個單號，通常用於先標 carrier、再用 CSV 模式補各別單號。
              </p>
            </div>
          )}

          {mode === 'mapping' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                CSV 格式：<code style={{ background: '#fafaf7', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>orderNumber,carrier,trackingNumber</code>
                （第一行可選 header）
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                placeholder={'orderNumber,carrier,trackingNumber\nCKMU-20260427-001,tcat,1234567890\nCKMU-20260427-002,711,8765432109'}
                style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>
          )}

          {previewCount > 0 && (
            <div style={{ background: '#fafaf7', border: '1px solid #E8DDD0', borderRadius: 6, padding: 12, marginBottom: 12, fontSize: 12 }}>
              <strong style={{ color: '#1A1F36' }}>將處理 {previewCount} 張訂單</strong>
              {mode === 'uniform' && uniformOrderNumbers.length > 0 && (
                <div style={{ marginTop: 6, color: '#6B6560' }}>
                  {uniformOrderNumbers.slice(0, 5).join(', ')}
                  {uniformOrderNumbers.length > 5 && ` ... 等 ${uniformOrderNumbers.length} 筆`}
                </div>
              )}
              {mode === 'mapping' && (
                <div style={{ marginTop: 6, color: '#6B6560' }}>
                  {mappingRows.slice(0, 3).map((r, i) => (
                    <div key={i} style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {r.orderNumber} → {r.carrier} / {r.trackingNumber}
                    </div>
                  ))}
                  {mappingRows.length > 3 && <div>... 等 {mappingRows.length} 筆</div>}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={submit} disabled={!canSubmit} style={canSubmit ? btnStyle : { ...btnStyle, opacity: 0.5, cursor: 'not-allowed' }}>
              {busy ? '處理中…' : `執行批次出貨（${previewCount}）`}
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderNumbersText('')
                setUniformTracking('')
                setCsvText('')
                setResult(null)
                setError('')
              }}
              style={btnOutline}
              disabled={busy}
            >
              清空
            </button>
            {error && <span style={{ color: '#B91C1C', fontSize: 12 }}>{error}</span>}
          </div>

          {result && (
            <div style={{ marginTop: 16, padding: 12, background: '#fafaf7', border: '1px solid #E8DDD0', borderRadius: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                ✅ 成功 {result.succeededCount} 筆
                {result.skippedCount > 0 && <span style={{ color: '#B45309' }}> · 略過 {result.skippedCount} 筆</span>}
              </div>
              {result.skipped.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: '#6B6560', marginBottom: 4 }}>略過原因：</div>
                  {result.skipped.map((r, i) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B6560' }}>
                      {r.orderNumber} — {r.reason}
                    </div>
                  ))}
                </div>
              )}
              {result.succeededCount > 0 && (
                <div style={{ fontSize: 11, color: '#6B6560', marginTop: 6 }}>
                  頁面將在 1.5 秒後自動 reload。
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
