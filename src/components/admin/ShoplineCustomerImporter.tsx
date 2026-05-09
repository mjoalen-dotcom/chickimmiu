'use client'

/**
 * ShoplineCustomerImporter
 * ─────────────────────────
 * 放在「會員」列表頁上方。直接接收 Shopline 後台匯出的
 * `chickimmiu_ShoplineCustomerReport_*.xls` 或 `.xlsx`，先 dry-run 預覽，
 * 確認後再 commit。
 *
 * 對應後端：`/api/users/shopline-customer-import`
 *   dryRun=1 → 預覽（預設）
 *   dryRun=0 → 實際 upsert
 *   limit=N → 僅處理前 N 筆（首次跑前可設 limit=10 試水溫）
 *   batchSize=N → 每批 N 筆
 */

import React, { useRef, useState } from 'react'

type SamplePreview = {
  row: number
  email: string | null
  shoplineCustomerId: string | null
  phone: string | null
  name: string | null
  gender: string | null
  memberTierLabel: string | null
  tags: string[]
  hasAddress: boolean
  hasUtm: boolean
  hasSocial: boolean
}

type DryRunReport = {
  success: true
  mode: 'dry-run'
  totalRowsInFile: number
  totalInPayload: number
  willProcess: number
  skippedNoIdentifier: number
  warnings: string[]
  stats: {
    withEmail: number
    withPhone: number
    withLine: number
    withFb: number
    withAddress: number
    withBirthday: number
    withBody: number
    withUtm: number
    blacklisted: number
    memberTierLabeled: number
  }
  samplePreview: SamplePreview[]
}

type CommitReport = {
  success: true
  mode: 'commit'
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  warnings: string[]
  totalResults: number
  results: {
    row: number
    action: 'created' | 'updated' | 'skipped' | 'error'
    email?: string
    shoplineCustomerId?: string
    matchedBy?: 'email' | 'shoplineCustomerId' | 'phone'
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

const ShoplineCustomerImporter: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [limit, setLimit] = useState<number>(10) // 預設先 10 筆試水溫
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
      setError('請先選擇 Shopline ShoplineCustomerReport 的 .xls 或 .xlsx 檔案')
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
      const res = await fetch(`/api/users/shopline-customer-import?${qs.toString()}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = (await res.json()) as { success?: boolean; message?: string } & ApiReport
      if (!res.ok || !data.success) {
        setError(data.message || `HTTP ${res.status}`)
        return
      }
      if (data.mode === 'dry-run') setDryRun(data)
      else setCommit(data)
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
        `即將寫入 ${willProcess} 筆會員到資料庫。\n\n` +
          `已存在（email / shoplineCustomerId / phone 對得上）→ 更新；不存在 → 新增。\n` +
          `新建會員會發隨機暫時密碼、_verified=true、不寄驗證信，使用者首次登入需走「忘記密碼」。\n\n` +
          `此動作無法自動回滾，建議先小批次（10–50 筆）試跑驗收再放大。\n` +
          `確定要繼續嗎？`,
      )
    )
      return
    await upload('commit')
  }

  return (
    <div style={panel}>
      <h4 style={title}>📥 SHOPLINE 會員匯入（.xls / .xlsx）</h4>
      <p style={hint}>
        直接上傳 Shopline 後台匯出的 <code>chickimmiu_ShoplineCustomerReport_*.xls</code>。
        系統會自動辨識中文欄頭、轉換 Y/N、解析地址、匯入 UTM、社群帳號（FB / LINE）、身體量測。
        以 <strong>email</strong>（fallback：shoplineCustomerId、phone）為 upsert key。
        <br />
        <strong>強烈建議</strong>先用「僅處理前 10 筆」按「預覽」→「確認匯入」走完整輪、
        到會員列表抽 5 筆檢查無誤後，再把 limit 調 0 跑全量。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
          處理中，請稍候⋯（17K 筆顧客全量約 30-60 秒）
        </div>
      )}

      {/* ── Dry-run 預覽 ── */}
      {dryRun && (
        <>
          <div style={statBox}>
            <Stat label="檔案總列數" value={dryRun.totalRowsInFile} />
            <Stat label="可解析" value={dryRun.totalInPayload} />
            <Stat label="將處理" value={dryRun.willProcess} />
            <Stat label="無識別跳過" value={dryRun.skippedNoIdentifier} />
          </div>

          <div style={statBox}>
            <Stat label="有 Email" value={dryRun.stats.withEmail} />
            <Stat label="有電話" value={dryRun.stats.withPhone} />
            <Stat label="有 LINE" value={dryRun.stats.withLine} />
            <Stat label="有 FB" value={dryRun.stats.withFb} />
            <Stat label="有地址" value={dryRun.stats.withAddress} />
            <Stat label="有生日" value={dryRun.stats.withBirthday} />
            <Stat label="有身體量測" value={dryRun.stats.withBody} />
            <Stat label="有 UTM" value={dryRun.stats.withUtm} />
            <Stat label="會員級別字串" value={dryRun.stats.memberTierLabeled} />
            <Stat label="黑名單" value={dryRun.stats.blacklisted} />
          </div>

          {dryRun.warnings.length > 0 && (
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
              ⚠️ 解析警告：
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {dryRun.warnings.map((w, i) => (
                  <li key={i} style={{ color: '#8a6d3b' }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600 }}>
            前 10 筆樣本：
          </div>
          <div style={{ marginTop: 6 }}>
            {dryRun.samplePreview.map((s, i) => (
              <div
                key={`${s.row}-${i}`}
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
                  Row {s.row} · {s.name || '(無姓名)'}{' '}
                  <span style={{ color: '#888', fontWeight: 400 }}>
                    {s.email || '(無 email)'}
                  </span>
                </div>
                <div style={{ color: '#666', marginTop: 2 }}>
                  Shopline ID: <code>{s.shoplineCustomerId || '—'}</code> · 電話: {s.phone || '—'}{' '}
                  · 性別: {s.gender || '—'} · 等級字串: {s.memberTierLabel || '—'}
                </div>
                <div style={{ color: '#888', marginTop: 2 }}>
                  {s.hasAddress ? '✓ 有地址 ' : ''}
                  {s.hasUtm ? '✓ 有 UTM ' : ''}
                  {s.hasSocial ? '✓ 有社群帳號 ' : ''}
                  {s.tags.length > 0 ? `· 標籤: ${s.tags.join('、')}` : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Commit 結果 ── */}
      {commit && (
        <>
          <div style={statBox}>
            <Stat label="處理總數" value={commit.total} />
            <Stat label="新增" value={commit.created} />
            <Stat label="更新" value={commit.updated} />
            <Stat label="跳過" value={commit.skipped} />
            <Stat label="失敗" value={commit.failed} />
          </div>
          {commit.warnings.length > 0 && (
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
              ⚠️ 警告：
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {commit.warnings.map((w, i) => (
                  <li key={i} style={{ color: '#8a6d3b' }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {commit.failed > 0 && (
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <strong>失敗列表（前 20 筆）：</strong>
              {commit.results
                .filter((r) => r.action === 'error')
                .slice(0, 20)
                .map((r, i) => (
                  <div key={`${r.row}-${i}`} style={{ color: '#c00', marginTop: 4 }}>
                    Row {r.row} · {r.email || r.shoplineCustomerId || '(無識別)'}: {r.message}
                  </div>
                ))}
            </div>
          )}
          {commit.totalResults > commit.results.length && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
              ※ 後端僅回傳前 {commit.results.length} 筆 result 樣本（總計 {commit.totalResults}），
              避免 response body 過大。整批 audit 可去 admin 會員列表查 signupSource = shopline。
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ShoplineCustomerImporter
