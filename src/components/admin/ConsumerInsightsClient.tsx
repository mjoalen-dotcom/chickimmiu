'use client'

import React, { useEffect, useState } from 'react'

/**
 * ConsumerInsightsClient — /admin/consumer-insights 的客端 UI
 * ──────────────────────────────────────────────────────────
 * 6 個面板 + 經營建議 + 視窗切換器。
 * 圖表用 inline SVG / DIV bar，不引第三方 chart 套件。
 * 資料源：GET /api/users/consumer-insights?days=30
 */

const GOLD = '#C19A5B'
const GOLD_LIGHT = '#F3E8D5'
const BORDER = 'var(--theme-elevation-150, #e4e4e7)'
const CARD_BG = 'var(--theme-elevation-0, #fff)'
const TEXT = 'var(--theme-elevation-900, #111)'
const MUTED = 'var(--theme-elevation-600, #666)'
const DANGER = '#dc2626'
const WARN = '#d97706'
const INFO = '#0284c7'

type FunnelStage = {
  key: string
  label: string
  sessions: number
  events: number
  conversionFromPrev: number
}

type TopPageRow = {
  pagePath: string
  views: number
  uniqueSessions: number
  avgDwellSec: number
  medianScrollPct: number
}

type ClickHotspotRow = {
  elementKey: string
  count: number
  topPagePath?: string
}

type CartAbandonRow = {
  productId: string | number
  productName: string
  addToCartCount: number
  purchaseCount: number
  abandonCount: number
  abandonRate: number
}

type SourceDeviceRow = {
  source: string
  deviceType: string
  pageviews: number
  addToCarts: number
  purchases: number
  atcRate: number
  purchaseRate: number
}

type Recommendation = {
  id: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  body: string
  metric?: string
}

type ApiData = {
  generatedAt: string
  windowDays: number
  totals: { events: number; orders: number }
  funnel: FunnelStage[]
  topPages: TopPageRow[]
  clickHotspots: ClickHotspotRow[]
  cartAbandonment: CartAbandonRow[]
  sourceDeviceMatrix: SourceDeviceRow[]
  recommendations: Recommendation[]
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

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: `2px solid ${BORDER}`,
  fontWeight: 600,
  color: MUTED,
  fontSize: 12,
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
}

const numStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

function fmt(n: number): string {
  return n.toLocaleString('zh-TW')
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function severityColor(sev: Recommendation['severity']): string {
  if (sev === 'critical') return DANGER
  if (sev === 'warn') return WARN
  return INFO
}

function severityIcon(sev: Recommendation['severity']): string {
  if (sev === 'critical') return '🔴'
  if (sev === 'warn') return '🟡'
  return '🔵'
}

function severityLabel(sev: Recommendation['severity']): string {
  if (sev === 'critical') return '高優先'
  if (sev === 'warn') return '注意'
  return '參考'
}

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

/** 漏斗單一 stage：背景塊寬度依序減少代表轉換流失 */
function FunnelRow({ stage, max, prev }: { stage: FunnelStage; max: number; prev?: FunnelStage }) {
  const widthPct = max > 0 ? Math.max(2, (stage.sessions / max) * 100) : 0
  const cvr = prev ? stage.conversionFromPrev : null
  const cvrColor = cvr == null ? MUTED : cvr >= 0.5 ? '#16a34a' : cvr >= 0.2 ? WARN : DANGER
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px 100px',
        gap: 12,
        alignItems: 'center',
        padding: '8px 0',
      }}
    >
      <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{stage.label}</div>
      <div style={{ height: 28, background: GOLD_LIGHT, borderRadius: 6, overflow: 'hidden' }}>
        <div
          style={{
            width: `${widthPct}%`,
            height: '100%',
            background: GOLD,
            borderRadius: 6,
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <div style={{ fontSize: 13, color: TEXT, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fmt(stage.sessions)} <span style={{ color: MUTED }}>session</span>
      </div>
      <div
        style={{
          fontSize: 13,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: cvrColor,
          fontWeight: 600,
        }}
      >
        {cvr == null ? '—' : fmtPct(cvr)}
      </div>
    </div>
  )
}

const ConsumerInsightsClient: React.FC = () => {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number>(30)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/users/consumer-insights?days=${days}`, { credentials: 'include' })
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
  }, [days])

  if (loading) {
    return <p style={{ fontSize: 14, color: MUTED }}>📊 正在載入消費者行為資料…</p>
  }
  if (error) {
    return (
      <div style={{ ...cardStyle, borderColor: DANGER }}>
        <h2 style={{ ...h2Style, color: DANGER }}>載入失敗</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{error}</p>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
          常見原因：BehaviorEvents collection 未 migrate（先去後台跑 migrate）；或 API endpoint
          沒部署。
        </p>
      </div>
    )
  }
  if (!data) return null

  const funnelMax = data.funnel.reduce((m, f) => Math.max(m, f.sessions), 0)

  return (
    <>
      {/* 視窗切換器 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12, color: MUTED }}>分析窗口：</span>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 999,
              border: `1px solid ${days === d ? GOLD : BORDER}`,
              background: days === d ? GOLD : CARD_BG,
              color: days === d ? '#fff' : TEXT,
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >
            最近 {d} 天
          </button>
        ))}
        <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>
          最後更新：{new Date(data.generatedAt).toLocaleString('zh-TW')}
        </span>
      </div>

      {/* KPI 列 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Kpi label="行為事件總數" value={fmt(data.totals.events)} sub={`近 ${data.windowDays} 天`} />
        <Kpi label="完成的訂單" value={fmt(data.totals.orders)} sub="processing+ 以上" />
        <Kpi
          label="總瀏覽 session"
          value={fmt(data.funnel[0]?.sessions || 0)}
          sub="獨立 sessionId 數"
        />
        <Kpi
          label="加購 → 結帳 → 購買"
          value={`${fmtPct(data.funnel[2]?.conversionFromPrev || 0).split('.')[0]}% / ${fmtPct(data.funnel[3]?.conversionFromPrev || 0).split('.')[0]}% / ${fmtPct(data.funnel[4]?.conversionFromPrev || 0).split('.')[0]}%`}
          sub="後三段 stage-to-stage 轉換率"
        />
      </div>

      {/* 經營建議（最重要、頂端） */}
      <section style={cardStyle}>
        <h2 style={h2Style}>🤖 經營建議</h2>
        <p style={hintStyle}>
          依即時資料計算的 rule-based 建議。出現條件：流量 / 加購 / 流失 / 停留 等門檻達標才提醒。
          無建議 = 訊號良好或樣本不足。
        </p>
        {data.recommendations.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            目前沒有觸發任何建議規則。等資料量再多一點再回來看。
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.recommendations.map((r) => (
              <div
                key={r.id}
                style={{
                  border: `1px solid ${BORDER}`,
                  borderLeft: `4px solid ${severityColor(r.severity)}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                  background: 'var(--theme-elevation-50, #fafafa)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                    {severityIcon(r.severity)} {r.title}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: severityColor(r.severity),
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {severityLabel(r.severity)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: TEXT }}>{r.body}</p>
                {r.metric ? (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: MUTED }}>📈 {r.metric}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Panel 1: Funnel */}
      <section style={cardStyle}>
        <h2 style={h2Style}>1. 消費者購物漏斗</h2>
        <p style={hintStyle}>
          每階段「獨立 session 數」。從進站、商品瀏覽、加購、結帳，到完成購買 — 哪一段流失最多就修哪段。
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 100px 100px',
            gap: 12,
            padding: '0 0 8px 0',
            borderBottom: `1px solid ${BORDER}`,
            marginBottom: 4,
          }}
        >
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>階段</div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>佔比</div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textAlign: 'right' }}>
            session 數
          </div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textAlign: 'right' }}>
            前段轉換
          </div>
        </div>
        {data.funnel.map((f, idx) => (
          <FunnelRow key={f.key} stage={f} max={funnelMax} prev={idx > 0 ? data.funnel[idx - 1] : undefined} />
        ))}
      </section>

      {/* Panel 2: Top pages */}
      <section style={cardStyle}>
        <h2 style={h2Style}>2. 熱門頁面排行（top 30）</h2>
        <p style={hintStyle}>
          各頁面瀏覽量、獨立 session、平均停留秒數、scroll 中位數。停留 &lt; 10s 或 scroll 中位數
          &lt; 30% 表示首屏沒抓住人。
        </p>
        {data.topPages.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>尚未收到瀏覽事件。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>頁面路徑</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>瀏覽</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>獨立 session</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>平均停留 (s)</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Scroll 中位數</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((p) => (
                  <tr key={p.pagePath}>
                    <td style={{ ...tdStyle, maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.pagePath}>
                      {p.pagePath}
                    </td>
                    <td style={numStyle}>{fmt(p.views)}</td>
                    <td style={numStyle}>{fmt(p.uniqueSessions)}</td>
                    <td
                      style={{
                        ...numStyle,
                        color: p.avgDwellSec > 0 && p.avgDwellSec < 10 ? WARN : TEXT,
                      }}
                    >
                      {p.avgDwellSec || '—'}
                    </td>
                    <td
                      style={{
                        ...numStyle,
                        color:
                          p.medianScrollPct > 0 && p.medianScrollPct < 30 ? WARN : TEXT,
                      }}
                    >
                      {p.medianScrollPct > 0 ? `${p.medianScrollPct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Panel 3: Click hotspots */}
      <section style={cardStyle}>
        <h2 style={h2Style}>3. 點擊熱點（top 20）</h2>
        <p style={hintStyle}>
          帶 <code style={{ background: 'var(--theme-elevation-100, #eee)', padding: '1px 6px', borderRadius: 4 }}>data-track="..."</code>{' '}
          屬性的元素被點擊次數。要新增追蹤點：對該 DOM 元素加 <code>data-track="key-name"</code> 即可。
        </p>
        {data.clickHotspots.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            還沒收到點擊事件。如果頁面已上 data-track 但沒進，先確認 cookie consent 有同意。
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>元素 key</th>
                  <th style={thStyle}>主要出現頁</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>點擊次數</th>
                </tr>
              </thead>
              <tbody>
                {data.clickHotspots.map((c) => (
                  <tr key={c.elementKey}>
                    <td style={tdStyle}>
                      <code
                        style={{
                          background: 'var(--theme-elevation-100, #eee)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {c.elementKey}
                      </code>
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        maxWidth: 360,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={c.topPagePath || '—'}
                    >
                      {c.topPagePath || '—'}
                    </td>
                    <td style={numStyle}>{fmt(c.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Panel 4: Cart abandonment */}
      <section style={cardStyle}>
        <h2 style={h2Style}>4. 加購未結帳商品（top 20）</h2>
        <p style={hintStyle}>
          被加購但沒被購買的商品 ranking。流失率 ≥ 70% 列為「燙手山芋」（高關注但結不掉）— 通常是缺貨、定價偏高、或運費攤不平。
        </p>
        {data.cartAbandonment.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>還沒收到加購事件。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>商品</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>加購</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>購買</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>流失</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>流失率</th>
                </tr>
              </thead>
              <tbody>
                {data.cartAbandonment.map((row) => {
                  const hot = row.abandonRate >= 0.7 && row.addToCartCount >= 5
                  return (
                    <tr key={String(row.productId)}>
                      <td style={tdStyle}>
                        <a
                          href={`/admin/collections/products/${row.productId}`}
                          style={{ color: GOLD, textDecoration: 'none' }}
                        >
                          {row.productName}
                        </a>
                      </td>
                      <td style={numStyle}>{fmt(row.addToCartCount)}</td>
                      <td style={numStyle}>{fmt(row.purchaseCount)}</td>
                      <td style={numStyle}>{fmt(row.abandonCount)}</td>
                      <td
                        style={{
                          ...numStyle,
                          color: hot ? DANGER : row.abandonRate > 0.4 ? WARN : TEXT,
                          fontWeight: hot ? 700 : 500,
                        }}
                      >
                        {fmtPct(row.abandonRate)}
                        {hot ? ' 🔥' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Panel 5: Source × Device matrix */}
      <section style={cardStyle}>
        <h2 style={h2Style}>5. 來源 × 裝置 行為矩陣</h2>
        <p style={hintStyle}>
          各 UTM source × 裝置類別的 pageview / 加購 / 購買數量 + 加購率 / 結帳率。找出哪個來源在哪種裝置上轉換最差，對廣告投放預算分配很有用。
        </p>
        {data.sourceDeviceMatrix.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>尚無 source × device 資料。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>UTM Source</th>
                  <th style={thStyle}>裝置</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>瀏覽</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>加購</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>購買</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>加購率</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>結帳率</th>
                </tr>
              </thead>
              <tbody>
                {data.sourceDeviceMatrix.map((r, i) => (
                  <tr key={`${r.source}-${r.deviceType}-${i}`}>
                    <td style={tdStyle}>{r.source}</td>
                    <td style={tdStyle}>{r.deviceType}</td>
                    <td style={numStyle}>{fmt(r.pageviews)}</td>
                    <td style={numStyle}>{fmt(r.addToCarts)}</td>
                    <td style={numStyle}>{fmt(r.purchases)}</td>
                    <td
                      style={{
                        ...numStyle,
                        color: r.atcRate < 0.03 && r.pageviews >= 100 ? WARN : TEXT,
                      }}
                    >
                      {fmtPct(r.atcRate)}
                    </td>
                    <td style={numStyle}>{fmtPct(r.purchaseRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* footnote */}
      <p style={{ fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 24 }}>
        資料即時計算（不快取）。隱私：cookie consent 拒絕的訪客完全不會被追蹤。
      </p>
    </>
  )
}

export default ConsumerInsightsClient
