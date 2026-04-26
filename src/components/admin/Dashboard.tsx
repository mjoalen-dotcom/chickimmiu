'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Brand tokens ────────────────────────────────────────────────────────────
const GOLD = '#C19A5B'
const CREAM = '#F8F1E9'
const DARK = '#1A1F36'
const GOLD_LIGHT = '#F3E8D5'
const GOLD_DARK = '#9A7A3E'
const CARD_BG = '#FFFFFF'
const BORDER = '#D4C7B5'
const MUTED = '#544940'        // 6.7:1 on white (was #6B6560 = 4.6:1, too faint for KPI labels / axis ticks)
const MUTED_HEADER = '#E8DFC9' // header subtitle on navy (was #C4B49A = 4.0:1, just under WCAG AA)
const TEXT = '#1A1F36'
const GREEN = '#16A34A'
const RED = '#DC2626'
const BLUE = '#2563EB'
const ORANGE = '#EA580C'

// ─── Types ───────────────────────────────────────────────────────────────────
interface TodayStats {
  revenue: number
  orders: number
  visitors: number
  newMembers: number
  pendingOrders: number
  pendingTickets: number
  returns: number
  averageOrderValue: number
}

interface MonthStats {
  revenue: number
  orders: number
  newMembers: number
}

interface RecentOrder {
  id: string
  orderNumber: string
  customer: string
  total: number
  status: string
  paymentStatus: string
  createdAt: string
}

interface DailyRevenue {
  date: string
  label: string
  revenue: number
  orders: number
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: '待處理',  bg: '#FEF3C7', color: '#713F12' }, // 7.4:1
  processing: { label: '處理中',  bg: '#BFDBFE', color: '#1E3A8A' }, // 7.5:1 (was #DBEAFE/#1E40AF = 4.16:1)
  shipped:    { label: '已出貨',  bg: '#BBF7D0', color: '#14532D' }, // 7.7:1
  delivered:  { label: '已送達',  bg: '#A7F3D0', color: '#064E3B' }, // 8.4:1
  cancelled:  { label: '已取消',  bg: '#FECACA', color: '#7F1D1D' }, // 7.0:1
  refunded:   { label: '已退款',  bg: '#E5E7EB', color: '#1F2937' }, // 11.5:1
}

const PAYMENT_MAP: Record<string, { label: string; color: string }> = {
  pending:  { label: '待付款',  color: '#B45309' },
  unpaid:   { label: '未付款',  color: '#B45309' }, // alias for legacy orders missing paymentStatus
  paid:     { label: '已付款',  color: '#15803D' },
  failed:   { label: '付款失敗', color: '#B91C1C' },
  refunded: { label: '已退款',  color: '#374151' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatNTD(n: number) { return `NT$ ${n.toLocaleString('zh-TW')}` }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getToday() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function getMonthStart(year: number, month: number) {
  return new Date(year, month, 1)
}

function getMonthEnd(year: number, month: number) {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

function monthLabel(m: number) {
  return ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'][m]
}

function pctChange(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? '+100%' : '0%'
  const pct = ((cur - prev) / prev * 100).toFixed(1)
  return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`
}

// ─── Data fetching helpers ───────────────────────────────────────────────────
async function safeJson(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function fetchOrdersInRange(start: Date, end: Date): Promise<{ total: number; revenue: number; docs: unknown[] }> {
  const s = start.toISOString()
  const e = end.toISOString()
  const countRes = await safeJson(
    `/api/orders?limit=0&depth=0&where[createdAt][greater_than_equal]=${encodeURIComponent(s)}&where[createdAt][less_than_equal]=${encodeURIComponent(e)}`
  )
  const totalCount = countRes?.totalDocs ?? 0
  if (totalCount === 0) return { total: 0, revenue: 0, docs: [] }

  const allRes = await safeJson(
    `/api/orders?limit=${Math.min(totalCount, 500)}&depth=0&where[createdAt][greater_than_equal]=${encodeURIComponent(s)}&where[createdAt][less_than_equal]=${encodeURIComponent(e)}`
  )
  const docs: Array<{ total?: number; paymentStatus?: string; status?: string }> = allRes?.docs ?? []
  const revenue = docs
    .filter((d) => d.paymentStatus === 'paid')
    .reduce((sum, o) => sum + (o.total ?? 0), 0)
  return { total: totalCount, revenue, docs }
}

async function fetchTodayStats(): Promise<TodayStats> {
  const today = getToday()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [ordersData, usersRes, ticketsRes, returnsRes] = await Promise.all([
    fetchOrdersInRange(today, tomorrow),
    safeJson(`/api/users?limit=0&depth=0&where[createdAt][greater_than_equal]=${encodeURIComponent(today.toISOString())}&where[role][equals]=customer`),
    safeJson('/api/customer-service-tickets?limit=0&depth=0&where[status][in][0]=open&where[status][in][1]=pending'),
    safeJson('/api/returns?limit=0&depth=0&where[createdAt][greater_than_equal]=' + encodeURIComponent(today.toISOString())),
  ])

  const pendingOrders = (ordersData.docs as Array<{ status?: string }>)
    .filter(o => o.status === 'pending' || o.status === 'processing').length

  return {
    revenue: ordersData.revenue,
    orders: ordersData.total,
    visitors: 0, // Would need analytics integration
    newMembers: usersRes?.totalDocs ?? 0,
    pendingOrders,
    pendingTickets: ticketsRes?.totalDocs ?? 0,
    returns: returnsRes?.totalDocs ?? 0,
    averageOrderValue: ordersData.total > 0 ? Math.round(ordersData.revenue / ordersData.total) : 0,
  }
}

async function fetchMonthStats(year: number, month: number): Promise<MonthStats> {
  const start = getMonthStart(year, month)
  const end = getMonthEnd(year, month)
  const [ordersData, usersRes] = await Promise.all([
    fetchOrdersInRange(start, end),
    safeJson(`/api/users?limit=0&depth=0&where[createdAt][greater_than_equal]=${encodeURIComponent(start.toISOString())}&where[createdAt][less_than]=${encodeURIComponent(end.toISOString())}&where[role][equals]=customer`),
  ])
  return {
    revenue: ordersData.revenue,
    orders: ordersData.total,
    newMembers: usersRes?.totalDocs ?? 0,
  }
}

async function fetchDailyRevenue(year: number, month: number): Promise<DailyRevenue[]> {
  const start = getMonthStart(year, month)
  const end = getMonthEnd(year, month)
  const daysInMonth = end.getDate()

  const ordersData = await fetchOrdersInRange(start, end)
  const docs = ordersData.docs as Array<{ total?: number; paymentStatus?: string; createdAt?: string }>

  const dailyMap: Record<string, { revenue: number; orders: number }> = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dailyMap[key] = { revenue: 0, orders: 0 }
  }

  for (const doc of docs) {
    if (!doc.createdAt) continue
    const date = new Date(doc.createdAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (dailyMap[key]) {
      dailyMap[key].orders++
      if (doc.paymentStatus === 'paid') {
        dailyMap[key].revenue += doc.total ?? 0
      }
    }
  }

  return Object.entries(dailyMap).map(([date, data]) => ({
    date,
    label: `${parseInt(date.split('-')[2])}`,
    revenue: data.revenue,
    orders: data.orders,
  }))
}

async function fetchRecentOrders(): Promise<RecentOrder[]> {
  const json = await safeJson('/api/orders?limit=8&depth=1&sort=-createdAt')
  const docs: Array<{
    id: string; orderNumber?: string; customer?: { name?: string; email?: string } | string
    total?: number; status?: string; paymentStatus?: string; createdAt?: string
  }> = json?.docs ?? []
  return docs.map((d) => ({
    id: String(d.id),
    orderNumber: d.orderNumber ?? d.id,
    customer: typeof d.customer === 'object' ? (d.customer?.name ?? d.customer?.email ?? '--') : String(d.customer ?? '--'),
    total: d.total ?? 0,
    status: d.status ?? 'pending',
    paymentStatus: d.paymentStatus ?? 'pending',
    createdAt: d.createdAt ?? '',
  }))
}

async function fetchOverviewCounts() {
  const [products, lowStock] = await Promise.all([
    safeJson('/api/products?limit=0&depth=0'),
    safeJson('/api/products?limit=0&depth=0&where[isLowStock][equals]=true'),
  ])
  return {
    products: products?.totalDocs ?? 0,
    lowStock: lowStock?.totalDocs ?? 0,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, icon, sub, accent = GOLD, loading = false }: {
  label: string; value: string; icon: string; sub?: string; accent?: string; loading?: boolean
}) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', borderLeft: `4px solid ${accent}`,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, background: GOLD_LIGHT,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: loading ? MUTED : TEXT, letterSpacing: '-0.02em' }}>
          {loading ? '--' : value}
        </div>
        {sub && <div style={{ fontSize: 11, color: sub.startsWith('+') ? GREEN : sub.startsWith('-') ? RED : MUTED, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function MiniBarChart({ data, maxVal }: { data: DailyRevenue[]; maxVal: number }) {
  if (!data.length || maxVal === 0) return <div style={{ color: MUTED, fontSize: 12, textAlign: 'center', padding: 20 }}>No data</div>
  const barW = Math.max(4, Math.floor((100 / data.length) * 0.7))
  // Parent uses alignItems:stretch so each column flex-item fills 120px height
  // (was alignItems:flex-end which left columns at content-height — bar `height: ${h}%`
  // computed against ~22px and rounded to 0px → bars invisible).
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 2,
      height: 120, padding: '0 4px 22px',
      position: 'relative',
    }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.revenue / maxVal) * 100)
        const isToday = d.date === getToday().toISOString().slice(0, 10)
        const showLabel = i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)
        return (
          <div key={i} style={{
            flex: 1, height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            position: 'relative',
          }}>
            <div
              title={`${d.date}: ${formatNTD(d.revenue)} (${d.orders} 筆訂單)`}
              style={{
                width: `${barW}%`, minWidth: 4, height: `${h}%`,
                background: isToday ? GOLD_DARK : GOLD,
                borderRadius: '2px 2px 0 0', transition: 'height 0.3s',
                cursor: 'pointer',
              }}
            />
            {showLabel && (
              <div style={{
                position: 'absolute', bottom: -18, fontSize: 11, fontWeight: 500,
                color: MUTED, whiteSpace: 'nowrap',
              }}>{d.label}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Calendar component
function CalendarPicker({ year, month, onSelect }: {
  year: number; month: number; onSelect: (y: number, m: number) => void
}) {
  const months = Array.from({ length: 12 }, (_, i) => i)
  const years = [year - 1, year, year + 1]

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select
        value={year}
        onChange={(e) => onSelect(Number(e.target.value), month)}
        style={{
          padding: '6px 10px', borderRadius: 6, border: `1px solid ${BORDER}`,
          background: CARD_BG, color: TEXT, fontSize: 13, fontWeight: 600,
        }}
      >
        {years.map(y => <option key={y} value={y}>{y} 年</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {months.map(m => (
          <button
            key={m}
            onClick={() => onSelect(year, m)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: m === month ? 700 : 400,
              border: m === month ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
              background: m === month ? GOLD_LIGHT : CARD_BG,
              color: m === month ? GOLD_DARK : TEXT,
              cursor: 'pointer',
            }}
          >
            {m + 1}月
          </button>
        ))}
      </div>
    </div>
  )
}

// 業績比較 table row
function CompRow({ label, cur, prev, format = 'number' }: {
  label: string; cur: number; prev: number; format?: 'money' | 'number'
}) {
  const change = pctChange(cur, prev)
  const isUp = change.startsWith('+') && change !== '+0.0%'
  const isDown = change.startsWith('-')
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 8,
      padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, alignItems: 'center',
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, textAlign: 'right' }}>
        {format === 'money' ? formatNTD(cur) : cur.toLocaleString()}
      </span>
      <span style={{ fontSize: 12, color: MUTED, textAlign: 'right' }}>
        {format === 'money' ? formatNTD(prev) : prev.toLocaleString()}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700, textAlign: 'right',
        color: isUp ? GREEN : isDown ? RED : MUTED,
      }}>{change}</span>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState('')

  // Today
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null)

  // Monthly
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [curMonthStats, setCurMonthStats] = useState<MonthStats | null>(null)
  const [prevMonthStats, setPrevMonthStats] = useState<MonthStats | null>(null)
  const [dailyData, setDailyData] = useState<DailyRevenue[]>([])

  // 業績比較 mode
  const [compareMode, setCompareMode] = useState<'month' | 'year'>('month')
  const [compareStats, setCompareStats] = useState<MonthStats | null>(null)

  // Orders & overview
  const [orders, setOrders] = useState<RecentOrder[]>([])
  const [overview, setOverview] = useState({ products: 0, lowStock: 0 })

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'compare'>('overview')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [today, recent, ov] = await Promise.all([
        fetchTodayStats(),
        fetchRecentOrders(),
        fetchOverviewCounts(),
      ])
      setTodayStats(today)
      setOrders(recent)
      setOverview(ov)

      // Load current month data
      const curM = await fetchMonthStats(selYear, selMonth)
      setCurMonthStats(curM)

      // Load previous month for comparison
      const pm = selMonth === 0 ? 11 : selMonth - 1
      const py = selMonth === 0 ? selYear - 1 : selYear
      const prevM = await fetchMonthStats(py, pm)
      setPrevMonthStats(prevM)

      // Load daily breakdown
      const daily = await fetchDailyRevenue(selYear, selMonth)
      setDailyData(daily)

      setRefreshedAt(new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [selYear, selMonth])

  useEffect(() => { void loadAll() }, [loadAll])

  // Load compare data when mode changes
  useEffect(() => {
    if (activeTab !== 'compare') return
    const loadCompare = async () => {
      if (compareMode === 'month') {
        const pm = selMonth === 0 ? 11 : selMonth - 1
        const py = selMonth === 0 ? selYear - 1 : selYear
        const data = await fetchMonthStats(py, pm)
        setCompareStats(data)
      } else {
        // Year-over-year: same month last year
        const data = await fetchMonthStats(selYear - 1, selMonth)
        setCompareStats(data)
      }
    }
    void loadCompare()
  }, [activeTab, compareMode, selYear, selMonth])

  const handleMonthSelect = (y: number, m: number) => {
    setSelYear(y)
    setSelMonth(m)
  }

  const dateLabel = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const maxDailyRev = Math.max(...dailyData.map(d => d.revenue), 1)

  return (
    <div style={{ fontFamily: "'Noto Sans TC', 'PingFang TC', sans-serif", color: TEXT, padding: '0 0 48px', maxWidth: 1400 }}>

      {/* ── Header ─── */}
      <div style={{
        background: `linear-gradient(135deg, ${DARK} 0%, #3E3530 100%)`,
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: GOLD, letterSpacing: '0.06em' }}>
            CHIC KIM &amp; MIU
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED_HEADER }}>{dateLabel}</p>
        </div>
        <button
          onClick={() => void loadAll()}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: `1px solid ${GOLD}`, borderRadius: 8,
            color: GOLD, padding: '8px 16px', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>
            {loading ? '...' : ''}
          </span>
          {loading ? '載入中...' : `重新整理 ${refreshedAt ? `(${refreshedAt})` : ''}`}
        </button>
      </div>

      {/* ── Today's KPIs ─── */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: TEXT }}>
          今日業績
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <KPICard label="今日營收" value={todayStats ? formatNTD(todayStats.revenue) : '--'} icon="$" accent={GREEN} loading={loading} />
          <KPICard label="今日訂單" value={todayStats ? String(todayStats.orders) : '--'} icon="#" accent={BLUE} loading={loading} />
          <KPICard label="待處理訂單" value={todayStats ? String(todayStats.pendingOrders) : '--'} icon="!" accent={ORANGE} loading={loading} />
          <KPICard label="新會員" value={todayStats ? String(todayStats.newMembers) : '--'} icon="+" accent={GOLD} loading={loading} />
          <KPICard label="客服訊息" value={todayStats ? String(todayStats.pendingTickets) : '--'} icon="?" accent={todayStats && todayStats.pendingTickets > 0 ? RED : GOLD} loading={loading} />
          <KPICard label="退換貨" value={todayStats ? String(todayStats.returns) : '--'} icon="R" accent={todayStats && todayStats.returns > 0 ? RED : GOLD} loading={loading} />
          <KPICard label="平均客單價" value={todayStats ? formatNTD(todayStats.averageOrderValue) : '--'} icon="~" accent={GOLD} loading={loading} />
          <KPICard label="低庫存商品" value={String(overview.lowStock)} icon="!" accent={overview.lowStock > 0 ? RED : GOLD} loading={loading} />
        </div>
      </section>

      {/* ── Tab Navigation ─── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${BORDER}` }}>
        {[
          { key: 'overview' as const, label: '月度總覽' },
          { key: 'calendar' as const, label: '日曆查詢' },
          { key: 'compare' as const, label: '業績比較' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? GOLD : MUTED,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? `3px solid ${GOLD}` : '3px solid transparent',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─── */}
      {activeTab === 'overview' && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <KPICard
              label={`${monthLabel(selMonth)} 營收`}
              value={curMonthStats ? formatNTD(curMonthStats.revenue) : '--'}
              icon="$"
              accent={GREEN}
              sub={prevMonthStats ? pctChange(curMonthStats?.revenue ?? 0, prevMonthStats.revenue) + ' 較上月' : undefined}
              loading={loading}
            />
            <KPICard
              label={`${monthLabel(selMonth)} 訂單`}
              value={curMonthStats ? String(curMonthStats.orders) : '--'}
              icon="#"
              accent={BLUE}
              sub={prevMonthStats ? pctChange(curMonthStats?.orders ?? 0, prevMonthStats.orders) + ' 較上月' : undefined}
              loading={loading}
            />
            <KPICard
              label={`${monthLabel(selMonth)}新會員`}
              value={curMonthStats ? String(curMonthStats.newMembers) : '--'}
              icon="+"
              accent={GOLD}
              sub={prevMonthStats ? pctChange(curMonthStats?.newMembers ?? 0, prevMonthStats.newMembers) + ' 較上月' : undefined}
              loading={loading}
            />
          </div>

          {/* 每日營收 Chart */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: TEXT }}>
              {selYear}/{selMonth + 1} 每日營收
            </h3>
            <MiniBarChart data={dailyData} maxVal={maxDailyRev} />
          </div>
        </section>
      )}

      {activeTab === 'calendar' && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: TEXT }}>
              選擇月份查看
            </h3>
            <CalendarPicker year={selYear} month={selMonth} onSelect={handleMonthSelect} />

            {curMonthStats && (
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ padding: 16, background: GOLD_LIGHT, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>營收</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginTop: 4 }}>{formatNTD(curMonthStats.revenue)}</div>
                </div>
                <div style={{ padding: 16, background: '#EFF6FF', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>訂單數</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginTop: 4 }}>{curMonthStats.orders}</div>
                </div>
                <div style={{ padding: 16, background: '#F0FDF4', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>新會員</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginTop: 4 }}>{curMonthStats.newMembers}</div>
                </div>
              </div>
            )}

            {/* Daily breakdown chart */}
            {dailyData.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: TEXT }}>每日明細</h4>
                <MiniBarChart data={dailyData} maxVal={maxDailyRev} />
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'compare' && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>
                {selYear}年{selMonth + 1}月 業績比較
              </h3>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                <button
                  onClick={() => setCompareMode('month')}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`,
                    background: compareMode === 'month' ? GOLD : CARD_BG,
                    color: compareMode === 'month' ? '#fff' : TEXT,
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  逐月比較
                </button>
                <button
                  onClick={() => setCompareMode('year')}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`,
                    background: compareMode === 'year' ? GOLD : CARD_BG,
                    color: compareMode === 'year' ? '#fff' : TEXT,
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  年度比較
                </button>
              </div>
            </div>

            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 8,
              padding: '10px 16px', background: CREAM, borderBottom: `1px solid ${BORDER}`,
              fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: '0.05em',
            }}>
              <span>指標</span>
              <span style={{ textAlign: 'right' }}>
                {selYear}/{selMonth + 1}
              </span>
              <span style={{ textAlign: 'right' }}>
                {compareMode === 'month'
                  ? `${selMonth === 0 ? selYear - 1 : selYear}/${selMonth === 0 ? 12 : selMonth}`
                  : `${selYear - 1}/${selMonth + 1}`}
              </span>
              <span style={{ textAlign: 'right' }}>變化</span>
            </div>

            {curMonthStats && compareStats && (
              <>
                <CompRow label="營收" cur={curMonthStats.revenue} prev={compareStats.revenue} format="money" />
                <CompRow label="訂單數" cur={curMonthStats.orders} prev={compareStats.orders} />
                <CompRow label="新會員" cur={curMonthStats.newMembers} prev={compareStats.newMembers} />
                <CompRow
                  label="平均客單價"
                  cur={curMonthStats.orders > 0 ? Math.round(curMonthStats.revenue / curMonthStats.orders) : 0}
                  prev={compareStats.orders > 0 ? Math.round(compareStats.revenue / compareStats.orders) : 0}
                  format="money"
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* ── Bottom Grid: Quick Actions + Recent Orders ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 20, alignItems: 'start' }}>

        {/* Quick Actions */}
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: TEXT }}>快速操作</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { href: '/admin/collections/products/create', icon: '+', label: '新增商品', sub: '建立商品' },
              { href: '/admin/collections/orders', icon: '#', label: '訂單管理', sub: '查看所有訂單' },
              { href: '/admin/collections/users', icon: 'U', label: '會員管理', sub: '管理會員資料' },
              { href: '/admin/collections/marketing-campaigns', icon: 'M', label: '行銷活動', sub: '行銷管理' },
              { href: '/admin/collections/customer-service-tickets', icon: '?', label: '客服中心', sub: '處理客服訊息' },
              { href: '/admin/collections/products?where[isLowStock][equals]=true', icon: '!', label: '低庫存', sub: '補貨提醒' },
              { href: '/admin/collections/returns', icon: 'R', label: '退換貨', sub: '處理退換貨' },
            ].map((a, i) => (
              <a
                key={i}
                href={a.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', background: CARD_BG, border: `1px solid ${BORDER}`,
                  borderRadius: 8, textDecoration: 'none', color: TEXT, cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = GOLD }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = BORDER }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 8, background: GOLD_LIGHT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: GOLD_DARK,
                }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{a.sub}</div>
                </div>
                <span style={{ marginLeft: 'auto', color: GOLD, fontSize: 14 }}>{'>'}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Recent Orders */}
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: TEXT }}>最近訂單</h2>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 85px 85px 70px',
              padding: '10px 16px', background: CREAM, borderBottom: `1px solid ${BORDER}`,
              fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: '0.04em',
            }}>
              <span>訂單編號</span>
              <span>顧客</span>
              <span>金額</span>
              <span>狀態</span>
              <span>付款</span>
              <span style={{ textAlign: 'right' }}>日期</span>
            </div>

            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 85px 85px 70px',
                  padding: '12px 16px', borderBottom: i < 4 ? `1px solid ${BORDER}` : 'none',
                }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} style={{ height: 14, borderRadius: 4, background: '#F0EBE3', width: '75%' }} />
                  ))}
                </div>
              ))
            ) : orders.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: MUTED, fontSize: 13 }}>尚無訂單</div>
            ) : (
              orders.map((order, i) => {
                const st = STATUS_MAP[order.status] ?? { label: order.status, bg: '#F3F4F6', color: '#374151' }
                const pt = PAYMENT_MAP[order.paymentStatus] ?? { label: order.paymentStatus, color: MUTED }
                return (
                  <a
                    key={order.id}
                    href={`/admin/collections/orders/${order.id}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 85px 85px 70px',
                      padding: '10px 16px', borderBottom: i < orders.length - 1 ? `1px solid ${BORDER}` : 'none',
                      textDecoration: 'none', color: TEXT, alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = CREAM }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: GOLD_DARK, fontFamily: 'monospace' }}>{order.orderNumber}</span>
                    <span style={{ fontSize: 12, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{formatNTD(order.total)}</span>
                    <span>
                      <span style={{
                        display: 'inline-block', padding: '2px 6px', borderRadius: 12,
                        fontSize: 10, fontWeight: 600, background: st.bg, color: st.color,
                      }}>{st.label}</span>
                    </span>
                    <span style={{ fontSize: 11, color: pt.color, fontWeight: 600 }}>{pt.label}</span>
                    <span style={{ fontSize: 10, color: MUTED, textAlign: 'right' }}>
                      {order.createdAt ? formatDate(order.createdAt) : '--'}
                    </span>
                  </a>
                )
              })
            )}

            <div style={{ padding: '8px 16px', background: CREAM, borderTop: `1px solid ${BORDER}`, textAlign: 'right' }}>
              <a href="/admin/collections/orders" style={{ fontSize: 12, color: GOLD_DARK, textDecoration: 'none', fontWeight: 600 }}>
                查看所有訂單 &rarr;
              </a>
            </div>
          </div>
        </section>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
