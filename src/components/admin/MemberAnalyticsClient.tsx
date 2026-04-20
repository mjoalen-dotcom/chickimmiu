'use client'

import React, { useEffect, useState } from 'react'

/**
 * MemberAnalyticsClient — /admin/member-analytics 的純 client 資料/呈現層。
 * 伺服端 wrapper 在 MemberAnalyticsView.tsx（DefaultTemplate + 標題 + 這個 client）。
 *
 * 資料源：GET /api/users/member-analytics（見 src/endpoints/memberAnalytics.ts）。
 * 圖表以 inline SVG 實作，避免為單頁引入 chart 套件造成 bundle 膨脹。
 */

const GOLD = '#C19A5B'
const GOLD_LIGHT = '#F3E8D5'
const BORDER = 'var(--theme-elevation-150, #e4e4e7)'
const CARD_BG = 'var(--theme-elevation-0, #fff)'
const TEXT = 'var(--theme-elevation-900, #111)'
const MUTED = 'var(--theme-elevation-600, #666)'
const ACCENT = '#1A1F36'

const MONTH_LABELS = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月']

type ApiData = {
  generatedAt: string
  kpi: {
    totalMembers: number
    withBirthday: number
    thisMonthCount: number
    nextMonthCount: number
    thisMonth: number
    nextMonth: number
  }
  byMonth: { month: number; count: number }[]
  byZodiac: { key: string; label: string; count: number }[]
  byAge: { key: string; label: string; count: number }[]
  byGender: { key: string; label: string; count: number }[]
  byTier: { tierId: string; label: string; count: number }[]
  thisMonthBirthdays: { id: string | number; name: string; day: number }[]
  nextMonthBirthdays: { id: string | number; name: string; day: number }[]
  ageCategoryMatrix: {
    categories: { categoryId: string; categoryName: string }[]
    rows: {
      key: string
      label: string
      total: number
      cells: { categoryId: string; categoryName: string; quantity: number }[]
    }[]
  }
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

// ── KPI card ─────────────────────────────────────────────────────────────
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
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
      <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>{sub}</div> : null}
    </div>
  )
}

// ── Horizontal bar (單一 bar，用在月份/星座/年齡) ─────────────────────────
function HBar({
  label,
  value,
  max,
  rightText,
  color = GOLD,
}: {
  label: string
  value: number
  max: number
  rightText?: string
  color?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 80px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
      <div style={{ fontSize: 13, color: TEXT, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ height: 20, background: GOLD_LIGHT, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: MUTED, textAlign: 'right' }}>
        {rightText || `${formatNumber(value)} 人`}
      </div>
    </div>
  )
}

// ── Bar section ──────────────────────────────────────────────────────────
function BarSection({
  title,
  hint,
  rows,
}: {
  title: string
  hint?: string
  rows: { label: string; value: number; rightText?: string }[]
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  return (
    <section style={cardStyle}>
      <h2 style={h2Style}>{title}</h2>
      {hint ? <p style={hintStyle}>{hint}</p> : null}
      <div>
        {rows.map((r, i) => (
          <HBar key={i} label={r.label} value={r.value} max={max} rightText={r.rightText} />
        ))}
      </div>
    </section>
  )
}

// ── Heatmap（年齡 × 商品分類）──────────────────────────────────────────
function HeatMap({
  categories,
  rows,
}: {
  categories: { categoryId: string; categoryName: string }[]
  rows: ApiData['ageCategoryMatrix']['rows']
}) {
  const globalMax = rows.reduce(
    (m, row) => Math.max(m, ...row.cells.map((c) => c.quantity)),
    0,
  )
  if (!rows.length || !categories.length) {
    return <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>目前還沒有可用的訂單資料。</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, position: 'sticky', left: 0, background: CARD_BG, zIndex: 1, minWidth: 90 }}>
              年齡
            </th>
            {categories.map((c) => (
              <th
                key={c.categoryId}
                style={{
                  textAlign: 'center',
                  padding: '8px 10px',
                  borderBottom: `1px solid ${BORDER}`,
                  fontWeight: 500,
                  color: MUTED,
                  minWidth: 70,
                  whiteSpace: 'nowrap',
                }}
              >
                {c.categoryName}
              </th>
            ))}
            <th style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, textAlign: 'right', color: MUTED, fontWeight: 500 }}>
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: TEXT, position: 'sticky', left: 0, background: CARD_BG, fontWeight: 500 }}>
                {r.label}
              </td>
              {categories.map((c) => {
                const cell = r.cells.find((x) => x.categoryId === c.categoryId)
                const q = cell?.quantity || 0
                const ratio = globalMax > 0 ? q / globalMax : 0
                // 漸層：透明 → GOLD；搭配白字僅在高強度
                const bg = ratio === 0 ? 'transparent' : `rgba(193, 154, 91, ${0.12 + ratio * 0.78})`
                const color = ratio > 0.55 ? '#fff' : TEXT
                return (
                  <td
                    key={c.categoryId}
                    title={`${r.label}｜${c.categoryName}：${formatNumber(q)} 件`}
                    style={{
                      textAlign: 'center',
                      padding: '8px 10px',
                      borderBottom: `1px solid ${BORDER}`,
                      background: bg,
                      color,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {q > 0 ? formatNumber(q) : '—'}
                  </td>
                )
              })}
              <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, textAlign: 'right', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(r.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Birthday list (名單可點進 user 編輯頁) ─────────────────────────────
function BirthdayList({
  title,
  monthLabel,
  items,
  emptyHint,
}: {
  title: string
  monthLabel: string
  items: ApiData['thisMonthBirthdays']
  emptyHint: string
}) {
  return (
    <section style={cardStyle}>
      <h2 style={h2Style}>
        {title}（{monthLabel}）
      </h2>
      <p style={hintStyle}>點名字直接跳 Users 編輯頁，方便寄生日優惠或手動補購物金。</p>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{emptyHint}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {items.map((u) => (
            <li key={u.id}>
              <a
                href={`/admin/collections/users/${u.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: TEXT,
                  textDecoration: 'none',
                  background: 'var(--theme-elevation-50, #fafafa)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{u.name}</span>
                <span style={{ color: GOLD, fontWeight: 600, whiteSpace: 'nowrap' }}>{monthLabel}/{u.day}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── 主元件 ────────────────────────────────────────────────────────────────
const MemberAnalyticsClient: React.FC = () => {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/users/member-analytics', { credentials: 'include' })
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

  if (loading) {
    return <p style={{ fontSize: 14, color: MUTED }}>📊 正在載入統計資料…</p>
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

  const birthdayFilled = data.kpi.totalMembers > 0
    ? Math.round((data.kpi.withBirthday / data.kpi.totalMembers) * 100)
    : 0

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
        <Kpi label="會員總數" value={formatNumber(data.kpi.totalMembers)} />
        <Kpi
          label="已填生日"
          value={formatNumber(data.kpi.withBirthday)}
          sub={`佔 ${birthdayFilled}%`}
        />
        <Kpi
          label={`本月壽星（${data.kpi.thisMonth} 月）`}
          value={formatNumber(data.kpi.thisMonthCount)}
          sub={data.kpi.thisMonthCount > 0 ? '點下方名單寄生日優惠' : '本月沒有壽星'}
        />
        <Kpi
          label={`下月壽星（${data.kpi.nextMonth} 月）`}
          value={formatNumber(data.kpi.nextMonthCount)}
          sub="可提前規劃行銷活動"
        />
      </div>

      {/* 生日月份 */}
      <BarSection
        title="生日月份分布"
        hint="12 個月份會員分布；行銷活動排程用。"
        rows={data.byMonth.map((b) => ({
          label: MONTH_LABELS[b.month - 1],
          value: b.count,
        }))}
      />

      {/* 兩欄：星座 + 年齡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 0 }}>
        <BarSection
          title="星座分布"
          hint="依西洋星座計算（摩羯座跨年 12/22–1/19）。"
          rows={data.byZodiac.map((b) => ({ label: b.label, value: b.count }))}
        />
        <BarSection
          title="年齡分布"
          hint="依生日推算當日實歲。未填生日者獨立歸類。"
          rows={data.byAge.map((b) => ({ label: b.label, value: b.count }))}
        />
      </div>

      {/* 兩欄：性別 + 等級 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 0 }}>
        <BarSection
          title="性別分布"
          hint="影響前台稱號顯示（male 走 frontNameMale fallback frontName）。"
          rows={data.byGender.map((b) => ({ label: b.label, value: b.count }))}
        />
        <BarSection
          title="會員等級分布"
          hint="以 users.memberTier 關聯到 MembershipTiers 為準。"
          rows={data.byTier.map((b) => ({ label: b.label, value: b.count }))}
        />
      </div>

      {/* 年齡 × 商品分類 heatmap */}
      <section style={cardStyle}>
        <h2 style={h2Style}>年齡 × 商品分類 偏好</h2>
        <p style={hintStyle}>
          以「已付款 / 已出貨 / 已送達 / 已完成」訂單計算購買件數；未填生日者獨立成一列。
          色塊越深表示該年齡段對該分類採購件數越高，用於排選品與檔期主打品。
        </p>
        <HeatMap
          categories={data.ageCategoryMatrix.categories}
          rows={data.ageCategoryMatrix.rows}
        />
      </section>

      {/* 本月 + 下月壽星名單 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        <BirthdayList
          title="本月壽星"
          monthLabel={String(data.kpi.thisMonth)}
          items={data.thisMonthBirthdays}
          emptyHint="本月沒有會員生日。"
        />
        <BirthdayList
          title="下月壽星"
          monthLabel={String(data.kpi.nextMonth)}
          items={data.nextMonthBirthdays}
          emptyHint="下月沒有會員生日。"
        />
      </div>

      <p style={{ fontSize: 11, color: MUTED, textAlign: 'right', marginTop: 8, marginBottom: 0 }}>
        資料時間：{new Date(data.generatedAt).toLocaleString('zh-TW')}
      </p>
    </>
  )
}

export default MemberAnalyticsClient
