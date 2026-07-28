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

type Mode = 'uniform' | 'mapping' | 'cvs' | 'home' | 'return'

type ResultRow = {
  orderNumber: string
  reason?: string
  // cvs（超商發號）模式回傳
  cvsPaymentNo?: string
  cvsValidationNo?: string
  allPayLogisticsID?: string
  // home（宅配發號）模式回傳：託運單號
  bookingNote?: string
}

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

  // cvs-mode state（超商發號：綠界 /Express/Create）
  const [cvsOrderNumbersText, setCvsOrderNumbersText] = useState('')

  // home-mode state（宅配發號：綠界 HOME 黑貓/郵政）
  const [homeOrderNumbersText, setHomeOrderNumbersText] = useState('')

  // return-mode state（宅配退貨：綠界 ReturnHome 黑貓）
  const [returnOrderNumbersText, setReturnOrderNumbersText] = useState('')

  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string>('')

  const splitOrderNumbers = (text: string) =>
    text
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)

  const uniformOrderNumbers = useMemo(() => splitOrderNumbers(orderNumbersText), [orderNumbersText])
  const cvsOrderNumbers = useMemo(() => splitOrderNumbers(cvsOrderNumbersText), [cvsOrderNumbersText])
  const homeOrderNumbers = useMemo(() => splitOrderNumbers(homeOrderNumbersText), [homeOrderNumbersText])
  const returnOrderNumbers = useMemo(() => splitOrderNumbers(returnOrderNumbersText), [returnOrderNumbersText])
  const mappingRows = useMemo(() => parseCsvRows(csvText), [csvText])

  const previewCount =
    mode === 'uniform'
      ? uniformOrderNumbers.length
      : mode === 'cvs'
        ? cvsOrderNumbers.length
        : mode === 'home'
          ? homeOrderNumbers.length
          : mode === 'return'
            ? returnOrderNumbers.length
            : mappingRows.length

  const submit = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const endpoint =
        mode === 'cvs'
          ? '/api/admin/orders/cvs-ship'
          : mode === 'home'
            ? '/api/admin/orders/home-ship'
            : mode === 'return'
              ? '/api/admin/orders/return-ship'
              : '/api/admin/orders/bulk-ship'
      const body =
        mode === 'cvs'
          ? { orderNumbers: cvsOrderNumbers }
          : mode === 'home'
            ? { orderNumbers: homeOrderNumbers }
            : mode === 'return'
              ? { orderNumbers: returnOrderNumbers }
              : mode === 'uniform'
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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '送出失敗')
      } else {
        setResult(data)
        // cvs / home 模式不自動 reload：留住寄貨編號/託運單號 + 列印按鈕
        if (data.succeededCount > 0 && mode !== 'cvs' && mode !== 'home') {
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

  // 發號結果列「列印託運單」：拿列印表單參數，開新視窗 form POST 到綠界
  const printLabel = async (orderNumber: string, kind: 'cvs' | 'home' = 'cvs') => {
    try {
      const res = await fetch(kind === 'home' ? '/api/admin/orders/home-ship/print' : '/api/admin/orders/cvs-ship/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      })
      const data = await res.json()
      if (!res.ok || !data.action) {
        setError(data.error || '取得列印參數失敗')
        return
      }
      const w = window.open('', '_blank')
      if (!w) {
        setError('瀏覽器擋了新視窗，請允許彈出視窗後再試')
        return
      }
      const form = w.document.createElement('form')
      form.method = 'POST'
      form.action = data.action
      Object.entries(data.params as Record<string, string>).forEach(([k, v]) => {
        const input = w.document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = v
        form.appendChild(input)
      })
      w.document.body.appendChild(form)
      form.submit()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
            <button type="button" style={tabStyle(mode === 'cvs')} onClick={() => setMode('cvs')}>
              超商發號（綠界 C2C 託運單）
            </button>
            <button type="button" style={tabStyle(mode === 'home')} onClick={() => setMode('home')}>
              宅配發號（綠界黑貓/郵政）
            </button>
            <button type="button" style={tabStyle(mode === 'return')} onClick={() => setMode('return')}>
              宅配退貨（黑貓收退件）
            </button>
          </div>

          {mode === 'cvs' && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>訂單編號（一行一個，或用逗號分隔）——限超商取貨訂單</label>
                <textarea
                  value={cvsOrderNumbersText}
                  onChange={(e) => setCvsOrderNumbersText(e.target.value)}
                  rows={5}
                  placeholder={'CKMU20260728001\nCKMU20260728002\n...'}
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>
              <p style={{ fontSize: 11, color: '#6B6560', margin: 0 }}>
                對綠界 /Express/Create 建 C2C 託運單：自動帶顧客選的門市（storeId）、
                回寫寄貨編號當追蹤碼、標 shipped + 寄出貨通知信。
                寄件人資料讀「訂單設定 → 超商託運寄件人」；已發號的訂單會自動略過。
              </p>
            </div>
          )}

          {mode === 'home' && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>訂單編號（一行一個，或用逗號分隔）——限黑貓/中華郵政宅配訂單</label>
                <textarea
                  value={homeOrderNumbersText}
                  onChange={(e) => setHomeOrderNumbersText(e.target.value)}
                  rows={5}
                  placeholder={'CKMU20260728001\nCKMU20260728002\n...'}
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>
              <p style={{ fontSize: 11, color: '#6B6560', margin: 0 }}>
                對綠界 /Express/Create（HOME）建宅配託運單：回寫託運單號當追蹤碼、
                標 shipped + 寄出貨通知信。寄件人讀「訂單設定 → 宅配託運寄件人」
                （名稱/手機/郵遞區號/地址都要填）。收件地址要有郵遞區號。
                貨到付款單自動帶代收（僅黑貓，上限 2 萬）。
                ⚠ 新竹物流綠界不支援——請用「統一託運 / CSV 對應」人工填單號。
              </p>
            </div>
          )}

          {mode === 'return' && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>訂單編號（一行一個，或用逗號分隔）——限已發號的黑貓宅配訂單</label>
                <textarea
                  value={returnOrderNumbersText}
                  onChange={(e) => setReturnOrderNumbersText(e.target.value)}
                  rows={5}
                  placeholder={'CKMU20260728001\n...'}
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>
              <p style={{ fontSize: 11, color: '#6B6560', margin: 0 }}>
                對綠界 /Express/ReturnHome 建逆物流託運單：黑貓到顧客地址收退貨、
                送回「訂單設定 → 宅配託運寄件人」地址。退貨貨態會寫進訂單的
                「逆物流狀態」欄。超商 C2C 沒有退貨 API：買家未取自動退回寄件門市
                （7-11 可在訂單設定指定退貨門市）。
              </p>
            </div>
          )}

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
              {mode === 'cvs' && cvsOrderNumbers.length > 0 && (
                <div style={{ marginTop: 6, color: '#6B6560' }}>
                  {cvsOrderNumbers.slice(0, 5).join(', ')}
                  {cvsOrderNumbers.length > 5 && ` ... 等 ${cvsOrderNumbers.length} 筆`}
                </div>
              )}
              {(mode === 'home' || mode === 'return') && (
                <div style={{ marginTop: 6, color: '#6B6560' }}>
                  {(mode === 'home' ? homeOrderNumbers : returnOrderNumbers).slice(0, 5).join(', ')}
                  {(mode === 'home' ? homeOrderNumbers : returnOrderNumbers).length > 5 &&
                    ` ... 等 ${(mode === 'home' ? homeOrderNumbers : returnOrderNumbers).length} 筆`}
                </div>
              )}
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
                setCvsOrderNumbersText('')
                setHomeOrderNumbersText('')
                setReturnOrderNumbersText('')
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
              {mode === 'cvs' && result.succeeded.some((r) => r.cvsPaymentNo || r.allPayLogisticsID) && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#6B6560', marginBottom: 4 }}>
                    發號結果（寄貨編號已寫入訂單追蹤號）：
                  </div>
                  {result.succeeded.map((r, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'monospace', color: '#1A1F36', marginBottom: 4 }}
                    >
                      <span>
                        {r.orderNumber} — 寄貨編號 {r.cvsPaymentNo || '(待綠界配號)'}
                        {r.cvsValidationNo ? ` / 驗證碼 ${r.cvsValidationNo}` : ''}
                      </span>
                      {r.cvsPaymentNo && (
                        <button
                          type="button"
                          onClick={() => printLabel(r.orderNumber)}
                          style={{ ...btnOutline, padding: '2px 10px', fontSize: 11 }}
                        >
                          列印託運單
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#6B6560', marginTop: 6 }}>
                    列印完請手動重新整理頁面查看訂單狀態。
                  </div>
                </div>
              )}
              {mode === 'home' && result.succeeded.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#6B6560', marginBottom: 4 }}>
                    發號結果（託運單號已寫入訂單追蹤號）：
                  </div>
                  {result.succeeded.map((r, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'monospace', color: '#1A1F36', marginBottom: 4 }}
                    >
                      <span>
                        {r.orderNumber} — 託運單號 {r.bookingNote || r.allPayLogisticsID || '(待綠界回填)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => printLabel(r.orderNumber, 'home')}
                        style={{ ...btnOutline, padding: '2px 10px', fontSize: 11 }}
                      >
                        列印託運單
                      </button>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#6B6560', marginTop: 6 }}>
                    列印完請手動重新整理頁面查看訂單狀態。
                  </div>
                </div>
              )}
              {mode === 'return' && result.succeeded.length > 0 && (
                <div style={{ fontSize: 11, color: '#6B6560', marginTop: 6 }}>
                  已向綠界建立退貨託運單，黑貓將去顧客地址收件；退貨貨態會自動寫進訂單「逆物流狀態」。
                </div>
              )}
              {result.succeededCount > 0 && mode !== 'cvs' && mode !== 'home' && (
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
