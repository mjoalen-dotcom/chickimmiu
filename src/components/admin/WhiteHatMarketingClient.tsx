'use client'

import React, { useCallback, useEffect, useState } from 'react'

type DashboardData = {
  ok: boolean
  overview?: {
    seoOpportunities: number
    publishedProductsSampled: number
    missingSeoInSample: number
    contentDrafts: number
    procurementRecords: number
    lifecycleEmailTemplates: number
    gscConfigured: boolean
    groqConfigured: boolean
  }
  operations?: {
    todayOrders: number
    todayRevenue: number
    estimatedGrossProfit: number
    lowStockProducts: Array<{ id: string | number; name: string; stock: number }>
    topProducts: Array<{ name: string; quantity: number; revenue: number }>
    logisticsAlerts: Array<{ orderNumber: string; ageDays: number; status: string }>
    customerQuestionCategories: Array<{ category: string; count: number }>
  }
  keywords?: Array<Record<string, unknown>>
  drafts?: Array<Record<string, unknown>>
  competitors?: Array<Record<string, unknown>>
}

const GOLD = '#C19A5B'
const BORDER = 'var(--theme-elevation-150, #e4e4e7)'
const MUTED = 'var(--theme-elevation-600, #666)'
const TEXT = 'var(--theme-elevation-900, #111)'
const BG = 'var(--theme-elevation-0, #fff)'

export default function WhiteHatMarketingClient() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/whitehat-marketing/dashboard', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (mode: string, commitSEO = false) => {
    setRunning(mode)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/whitehat-marketing/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode, commitSEO }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setMessage(`已完成 ${mode}：${JSON.stringify(json.result).slice(0, 360)}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  const overview = data?.overview
  const operations = data?.operations

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <Action label="每日營運摘要" busy={running === 'daily'} onClick={() => run('daily')} />
        <Action label="本週 3 篇文章 + 短影音" busy={running === 'weekly'} onClick={() => run('weekly', true)} />
        <Action label="SEO / GSC 建議" busy={running === 'seo'} onClick={() => run('seo', true)} />
        <Action label="Email 模板與旅程" busy={running === 'email'} onClick={() => run('email')} />
        <Action label="採購評分" busy={running === 'procurement'} onClick={() => run('procurement')} />
        <button type="button" onClick={() => void load()} style={secondaryButton}>
          重新整理
        </button>
      </div>

      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Metric title="SEO 機會字" value={loading ? '--' : String(overview?.seoOpportunities ?? 0)} />
        <Metric title="樣本中缺 SEO" value={loading ? '--' : String(overview?.missingSeoInSample ?? 0)} />
        <Metric title="內容草稿" value={loading ? '--' : String(overview?.contentDrafts ?? 0)} />
        <Metric title="競品紀錄" value={loading ? '--' : String(overview?.procurementRecords ?? 0)} />
        <Metric title="Email 模板" value={loading ? '--' : String(overview?.lifecycleEmailTemplates ?? 0)} />
        <Metric title="GSC 串接" value={overview?.gscConfigured ? '已設定' : '待設定'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: 16 }}>
        <Panel title="今日營運">
          <Line label="訂單 / 營收" value={`${operations?.todayOrders ?? 0} 筆 / NT$${(operations?.todayRevenue ?? 0).toLocaleString('zh-TW')}`} />
          <Line label="預估毛利" value={`NT$${(operations?.estimatedGrossProfit ?? 0).toLocaleString('zh-TW')}`} />
          <List
            title="熱賣商品"
            items={(operations?.topProducts ?? []).map((p) => `${p.name}：${p.quantity} 件`)}
            empty="尚無近 7 日熱賣資料"
          />
          <List
            title="低庫存"
            items={(operations?.lowStockProducts ?? []).map((p) => `${p.name}：庫存 ${p.stock}`)}
            empty="目前無低庫存商品"
          />
        </Panel>

        <Panel title="待處理提醒">
          <List
            title="物流異常"
            items={(operations?.logisticsAlerts ?? []).map((o) => `${o.orderNumber}：${o.status} ${o.ageDays} 天`)}
            empty="目前無物流異常"
          />
          <List
            title="客服分類"
            items={(operations?.customerQuestionCategories ?? []).map((c) => `${c.category}：${c.count}`)}
            empty="目前無待處理客服分類"
          />
        </Panel>

        <Panel title="SEO 關鍵字">
          <Table
            rows={(data?.keywords ?? []).map((k) => [
              String(k.query ?? ''),
              String(k.impressions ?? 0),
              String(k.ctr ?? 0),
              String(k.opportunityScore ?? 0),
            ])}
            headers={['Query', '曝光', 'CTR', '分數']}
            empty="尚無 GSC 關鍵字資料"
          />
        </Panel>

        <Panel title="近期草稿">
          <Table
            rows={(data?.drafts ?? []).slice(0, 8).map((d) => [
              labelForType(String(d.type ?? '')),
              String(d.title ?? ''),
              String(d.status ?? ''),
            ])}
            headers={['類型', '標題', '狀態']}
            empty="尚無自動化草稿"
          />
        </Panel>
      </div>
    </div>
  )
}

function Action({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={busy} onClick={onClick} style={{ ...primaryButton, opacity: busy ? 0.55 : 1 }}>
      {busy ? '執行中...' : label}
    </button>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: TEXT }}>{value}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{title}</h2>
      {children}
    </section>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '7px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: MUTED }}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 13 }}>{empty}</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  )
}

function Table({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <div style={{ color: MUTED, fontSize: 13 }}>{empty}</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: 'left', color: MUTED, borderBottom: `1px solid ${BORDER}`, padding: '8px 6px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, cidx) => (
                <td key={cidx} style={{ borderBottom: `1px solid ${BORDER}`, padding: '8px 6px', verticalAlign: 'top' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      background: tone === 'success' ? '#F0FDF4' : '#FEF2F2',
      border: `1px solid ${tone === 'success' ? '#BBF7D0' : '#FECACA'}`,
      color: tone === 'success' ? '#166534' : '#991B1B',
      fontSize: 13,
    }}>
      {children}
    </div>
  )
}

function labelForType(type: string) {
  const map: Record<string, string> = {
    seo_product_meta: 'SEO',
    product_faq: 'FAQ',
    weekly_article: '文章',
    short_video_script: '短影音',
    email_lifecycle: 'Email',
    ops_summary: '營運',
    customer_reply: '客服',
    restock_advice: '補貨',
    purchase_recommendation: '採購',
  }
  return map[type] || type
}

const card: React.CSSProperties = {
  background: BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const primaryButton: React.CSSProperties = {
  border: 'none',
  borderRadius: 6,
  background: GOLD,
  color: '#fff',
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButton: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  background: BG,
  color: TEXT,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
