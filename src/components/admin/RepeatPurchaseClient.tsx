'use client'

import React, { useEffect, useMemo, useState } from 'react'

/**
 * RepeatPurchaseClient — /admin/repeat-purchase 客戶端渲染 & 互動層。
 * 伺服端 wrapper 在 RepeatPurchaseView.tsx。
 *
 * 資料源：GET /api/users/repeat-purchase（見 src/endpoints/repeatPurchaseAnalytics.ts）
 * 沒用 chart 套件，所有視覺化都 inline CSS / SVG。
 */

const GOLD = '#C19A5B'
const GOLD_LIGHT = '#F3E8D5'
const BORDER = 'var(--theme-elevation-150, #e4e4e7)'
const CARD_BG = 'var(--theme-elevation-0, #fff)'
const TEXT = 'var(--theme-elevation-900, #111)'
const MUTED = 'var(--theme-elevation-600, #666)'
const OK = '#16a34a'
const WARN = '#d97706'
const DANGER = '#dc2626'

type WindowStat = { eligible: number; repeated: number; rate: number | null }

type ApiData = {
  generatedAt: string
  summary: {
    totalFirstBuyers: number
    d30: WindowStat
    d60: WindowStat
    d90: WindowStat
    anyRepeatCount: number
    anyRepeatRate: number
    baselineNote: string
  }
  cohorts: Array<{
    key: string
    label: string
    startISO: string
    endISO: string
    firstBuyers: number
    avgFirstAOV: number
    d30: WindowStat
    d60: WindowStat
    d90: WindowStat
    soFar: { daysElapsed: number; repeated: number; rate: number }
  }>
  actionable: Array<{
    userId: string
    name: string
    email: string
    firstOrderISO: string
    firstOrderId: string | number
    firstOrderNumber: string
    firstOrderTotal: number
    daysSinceFirst: number
    tierLabel: string
    phase: 'd0_14' | 'd15_45' | 'd46_90' | 'beyond_90'
  }>
}

const cardStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: 20,
  background: CARD_BG,
  marginBottom: 20,
}

const h2Style: React.CSSProperties = {
  margin: 0,
  marginBottom: 4,
  fontSize: 17,
  fontWeight: 600,
  color: TEXT,
}

const hintStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 16,
  fontSize: 12,
  color: MUTED,
}

function formatNumber(n: number): string {
  return n.toLocaleString('zh-TW')
}

function fmtPct(rate: number | null): string {
  if (rate == null) return '—'
  return `${Math.round(rate * 1000) / 10}%`
}

function fmtMoney(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

// D30 / D60 / D90 顏色分級：行銷上常見 benchmark 是 fashion 電商 D90 大約 25–35%
function rateColor(rate: number | null): string {
  if (rate == null) return MUTED
  if (rate >= 0.3) return OK
  if (rate >= 0.15) return WARN
  return DANGER
}

// ── KPI ─────────────────────────────────────────────────────────────────
function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: 16,
        background: CARD_BG,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: color || TEXT,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>{sub}</div> : null}
    </div>
  )
}

// ── Rate cell (cohort table) ────────────────────────────────────────────
function RateCell({ stat }: { stat: WindowStat }) {
  const color = rateColor(stat.rate)
  return (
    <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ fontSize: 14, color, fontWeight: 600 }}>{fmtPct(stat.rate)}</div>
      {stat.eligible > 0 ? (
        <div style={{ fontSize: 11, color: MUTED }}>
          {stat.repeated}/{stat.eligible}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: MUTED }}>未到期</div>
      )}
    </div>
  )
}

// ── Cohort table ────────────────────────────────────────────────────────
function CohortTable({ rows }: { rows: ApiData['cohorts'] }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
        目前沒有 paid 訂單可以做 cohort。
      </p>
    )
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
                fontWeight: 500,
                minWidth: 110,
              }}
            >
              首購週期
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 12px',
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
                fontWeight: 500,
              }}
            >
              首購人數
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 12px',
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
                fontWeight: 500,
              }}
            >
              首購 AOV
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 12px',
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
                fontWeight: 500,
              }}
            >
              D30
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 12px',
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
                fontWeight: 500,
              }}
            >
              D60
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 12px',
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
                fontWeight: 500,
              }}
            >
              D90
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 12px',
                borderBottom: `1px solid ${BORDER}`,
                color: MUTED,
                fontWeight: 500,
                minWidth: 110,
              }}
              title="迄今已發生的回購率（不限時窗），用於早期信號，不該與 D30/60/90 直接比較。"
            >
              迄今（任何回購）
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${BORDER}`,
                  color: TEXT,
                  fontWeight: 500,
                }}
              >
                <div>{r.label}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  已累積 {r.soFar.daysElapsed} 天
                </div>
              </td>
              <td
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNumber(r.firstBuyers)}
              </td>
              <td
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: 'right',
                  color: MUTED,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(r.avgFirstAOV)}
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
                <RateCell stat={r.d30} />
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
                <RateCell stat={r.d60} />
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
                <RateCell stat={r.d90} />
              </td>
              <td
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: rateColor(r.soFar.rate),
                    fontWeight: 600,
                  }}
                >
                  {fmtPct(r.soFar.rate)}
                </div>
                <div style={{ fontSize: 11, color: MUTED }}>
                  {r.soFar.repeated}/{r.firstBuyers}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Actionable list ─────────────────────────────────────────────────────
const PHASE_META: Record<
  ApiData['actionable'][number]['phase'],
  { label: string; hint: string; emoji: string; accent: string }
> = {
  d0_14: {
    label: 'Delight 0–14 天',
    emoji: '💌',
    hint: '剛收到貨 — 寄保養 / 穿搭說明 + 邀請入封測 LINE 群，要求尺寸回饋。',
    accent: '#22c55e',
  },
  d15_45: {
    label: 'Discovery 15–45 天',
    emoji: '🔍',
    hint: '新品 push 鎖定他們第一次買的品類；UGC repost 情感黏著最強。',
    accent: '#3b82f6',
  },
  d46_90: {
    label: 'Conversion 46–90 天',
    emoji: '🎯',
    hint: '扣板機時機：升級誘因 / 點數到期提醒 / 第二次專屬券。',
    accent: '#f59e0b',
  },
  beyond_90: {
    label: 'Reactivation 90+ 天',
    emoji: '🌱',
    hint: 'Win-back 情境：個人化推薦 + 折扣券 + 主理人親信一封。',
    accent: '#ef4444',
  },
}

function PhaseList({
  phase,
  items,
}: {
  phase: ApiData['actionable'][number]['phase']
  items: ApiData['actionable']
}) {
  const meta = PHASE_META[phase]
  if (items.length === 0) {
    return (
      <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
        目前這個階段沒有需要接觸的會員。
      </p>
    )
  }
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 10,
      }}
    >
      {items.map((a) => (
        <li key={a.userId}>
          <a
            href={`/admin/collections/users/${a.userId}`}
            style={{
              display: 'block',
              padding: '12px 14px',
              border: `1px solid ${BORDER}`,
              borderLeft: `3px solid ${meta.accent}`,
              borderRadius: 8,
              background: 'var(--theme-elevation-50, #fafafa)',
              textDecoration: 'none',
              color: TEXT,
            }}
            title={`點擊跳至 ${a.name} 的 Users 編輯頁`}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: meta.accent,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {a.daysSinceFirst} 天
              </span>
            </div>
            {a.email ? (
              <div
                style={{
                  fontSize: 11,
                  color: MUTED,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 4,
                }}
              >
                {a.email}
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: MUTED,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{a.firstOrderNumber || `#${a.firstOrderId}`}</span>
              <span>{fmtMoney(a.firstOrderTotal)}</span>
            </div>
            {a.tierLabel ? (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: GOLD_LIGHT,
                  color: '#7a5a2e',
                }}
              >
                {a.tierLabel}
              </div>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  )
}

// ── 主元件 ──────────────────────────────────────────────────────────────
const RepeatPurchaseClient: React.FC = () => {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [phaseTab, setPhaseTab] = useState<ApiData['actionable'][number]['phase']>('d0_14')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/users/repeat-purchase', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => '')
          throw new Error(`HTTP ${r.status}: ${body || r.statusText}`)
        }
        return r.json() as Promise<ApiData>
      })
      .then((j) => {
        if (!cancelled) setData(j)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const phaseCounts = useMemo(() => {
    const c = { d0_14: 0, d15_45: 0, d46_90: 0, beyond_90: 0 }
    if (!data) return c
    for (const a of data.actionable) c[a.phase] += 1
    return c
  }, [data])

  const phaseItems = useMemo(
    () => (data ? data.actionable.filter((a) => a.phase === phaseTab) : []),
    [data, phaseTab],
  )

  if (loading) {
    return <p style={{ fontSize: 14, color: MUTED }}>🔁 正在計算回購 cohort…</p>
  }
  if (error) {
    return (
      <div style={{ ...cardStyle, borderColor: '#ef4444' }}>
        <h2 style={{ ...h2Style, color: '#ef4444' }}>載入失敗</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{error}</p>
      </div>
    )
  }
  if (!data) return null

  const s = data.summary

  return (
    <>
      {/* KPI 列 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Kpi
          label="首購會員總數"
          value={formatNumber(s.totalFirstBuyers)}
          sub={`其中 ${formatNumber(s.anyRepeatCount)} 位曾回購（${fmtPct(s.anyRepeatRate)}）`}
        />
        <Kpi
          label="D30 回購率"
          value={fmtPct(s.d30.rate)}
          sub={
            s.d30.eligible > 0
              ? `${s.d30.repeated}/${s.d30.eligible} 已滿 30 天`
              : '封測初期尚未成熟'
          }
          color={rateColor(s.d30.rate)}
        />
        <Kpi
          label="D60 回購率"
          value={fmtPct(s.d60.rate)}
          sub={
            s.d60.eligible > 0
              ? `${s.d60.repeated}/${s.d60.eligible} 已滿 60 天`
              : '封測初期尚未成熟'
          }
          color={rateColor(s.d60.rate)}
        />
        <Kpi
          label="D90 回購率"
          value={fmtPct(s.d90.rate)}
          sub={
            s.d90.eligible > 0
              ? `${s.d90.repeated}/${s.d90.eligible} 已滿 90 天`
              : '封測初期尚未成熟'
          }
          color={rateColor(s.d90.rate)}
        />
      </div>

      {/* Baseline note */}
      {s.baselineNote ? (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: GOLD_LIGHT,
            color: '#7a5a2e',
            fontSize: 13,
            marginBottom: 20,
            border: `1px solid ${GOLD}`,
          }}
        >
          ⏳ {s.baselineNote}
        </div>
      ) : null}

      {/* Cohort table */}
      <section style={cardStyle}>
        <h2 style={h2Style}>週 cohort × 回購率</h2>
        <p style={hintStyle}>
          每週首購會員一列；D30 / D60 / D90 只計入已滿觀察窗的會員（分母為 eligible）。
          顏色：≥30% 綠（健康）、15–30% 橘（需優化）、&lt;15% 紅（需介入）。
        </p>
        <CohortTable rows={data.cohorts} />
      </section>

      {/* Actionable list */}
      <section style={cardStyle}>
        <h2 style={h2Style}>尚未回購行動名單</h2>
        <p style={hintStyle}>
          已首購、尚未回購的會員，依距首購天數分成四段。點任一會員跳至 Users 編輯頁，
          用於 LINE / email 一對一觸及。
        </p>

        {/* Phase tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {(Object.keys(PHASE_META) as Array<keyof typeof PHASE_META>).map((p) => {
            const meta = PHASE_META[p]
            const active = phaseTab === p
            const count = phaseCounts[p]
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPhaseTab(p)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${active ? meta.accent : BORDER}`,
                  background: active ? meta.accent : CARD_BG,
                  color: active ? '#fff' : TEXT,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
                }}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 8px',
                    borderRadius: 999,
                    background: active ? 'rgba(255,255,255,0.2)' : GOLD_LIGHT,
                    color: active ? '#fff' : '#7a5a2e',
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Phase hint */}
        <p
          style={{
            fontSize: 12,
            color: MUTED,
            padding: '8px 12px',
            background: 'var(--theme-elevation-50, #fafafa)',
            borderRadius: 6,
            marginTop: 0,
            marginBottom: 14,
          }}
        >
          💡 {PHASE_META[phaseTab].hint}
        </p>

        <PhaseList phase={phaseTab} items={phaseItems} />
      </section>

      <p
        style={{
          fontSize: 11,
          color: MUTED,
          textAlign: 'right',
          marginTop: 8,
          marginBottom: 0,
        }}
      >
        資料時間：{new Date(data.generatedAt).toLocaleString('zh-TW')}
      </p>
    </>
  )
}

export default RepeatPurchaseClient
