'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  TrendingUp,
  ShieldAlert,
  CreditCard,
  RotateCcw,
  BarChart3,
  Tag,
  CalendarDays,
  Activity,
} from 'lucide-react'
import { motion } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════
   CHIC KIM & MIU — 會員行為分析 Dashboard
   ═══════════════════════════════════════════════════════════ */

// ── Types ──
interface AnalyticsData {
  overview: {
    totalMembers: number
    avgLTV: number
    avgChurnScore: number
    avgCreditScore: number
    overallReturnRate: number
  }
  segmentDistribution: Array<{ segment: string; count: number; percentage: number }>
  churnDistribution: Array<{ risk: string; count: number }>
  ltvDistribution: Array<{ range: string; count: number }>
  topTags: Array<{ tag: string; count: number }>
  monthlyTrends: Array<{
    month: string
    newMembers: number
    churnedMembers: number
    avgSpend: number
  }>
}

// ── Demo data ──
const DEMO_DATA: AnalyticsData = {
  overview: {
    totalMembers: 2847,
    avgLTV: 45200,
    avgChurnScore: 32,
    avgCreditScore: 82.5,
    overallReturnRate: 8.2,
  },
  segmentDistribution: [
    { segment: '冠軍客群', count: 245, percentage: 8.6 },
    { segment: '忠實客群', count: 520, percentage: 18.3 },
    { segment: '潛力忠誠客', count: 380, percentage: 13.4 },
    { segment: '優質新客', count: 612, percentage: 21.5 },
    { segment: '價格敏感客', count: 340, percentage: 11.9 },
    { segment: '流失高風險客', count: 420, percentage: 14.8 },
    { segment: '退貨高風險客', count: 95, percentage: 3.3 },
    { segment: '沉睡客', count: 235, percentage: 8.3 },
  ],
  churnDistribution: [
    { risk: '低風險', count: 1580 },
    { risk: '中風險', count: 720 },
    { risk: '高風險', count: 380 },
    { risk: '極高風險', count: 167 },
  ],
  ltvDistribution: [
    { range: 'NT$0-10K', count: 890 },
    { range: 'NT$10K-30K', count: 920 },
    { range: 'NT$30K-60K', count: 580 },
    { range: 'NT$60K-100K', count: 310 },
    { range: 'NT$100K+', count: 147 },
  ],
  topTags: [
    { tag: '韓系愛好者', count: 1245 },
    { tag: '偏好洋裝', count: 980 },
    { tag: '高回購客', count: 756 },
    { tag: '職場穿搭', count: 623 },
    { tag: '價格敏感', count: 540 },
    { tag: '偏好 M 碼', count: 498 },
    { tag: '高退貨風險', count: 312 },
    { tag: '沉睡客', count: 235 },
  ],
  monthlyTrends: [
    { month: '2025-11', newMembers: 156, churnedMembers: 23, avgSpend: 3200 },
    { month: '2025-12', newMembers: 245, churnedMembers: 18, avgSpend: 4100 },
    { month: '2026-01', newMembers: 189, churnedMembers: 31, avgSpend: 2800 },
    { month: '2026-02', newMembers: 167, churnedMembers: 28, avgSpend: 3500 },
    { month: '2026-03', newMembers: 198, churnedMembers: 22, avgSpend: 3900 },
    { month: '2026-04', newMembers: 89, churnedMembers: 15, avgSpend: 3600 },
  ],
}

// ── Segment colors ──
const SEGMENT_COLORS: Record<string, string> = {
  '冠軍客群': 'bg-emerald-500',
  '忠實客群': 'bg-emerald-400',
  '潛力忠誠客': 'bg-gold-500',
  '優質新客': 'bg-blue-400',
  '價格敏感客': 'bg-amber-400',
  '流失高風險客': 'bg-red-400',
  '退貨高風險客': 'bg-red-500',
  '沉睡客': 'bg-gray-400',
}

const CHURN_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  '低風險': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
  },
  '中風險': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: 'text-blue-500',
  },
  '高風險': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: 'text-amber-500',
  },
  '極高風險': {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-500',
  },
}

const TIME_RANGES = [
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
  { label: '90天', value: '90d' },
  { label: '1年', value: '365d' },
]

// ── Animation variants ──
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData>(DEMO_DATA)
  const [timeRange, setTimeRange] = useState('30d')
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (range: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/analytics?timeRange=${range}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        }
      }
    } catch {
      // keep demo data on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(timeRange)
  }, [timeRange, fetchData])

  const maxSegmentCount = Math.max(...data.segmentDistribution.map((s) => s.count), 1)
  const maxLtvCount = Math.max(...data.ltvDistribution.map((l) => l.count), 1)
  const totalChurn = data.churnDistribution.reduce((a, b) => a + b.count, 0)

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.25em] text-gold-500">
            BEHAVIOR ANALYTICS
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-[#2C2C2C] sm:text-3xl">
              會員行為分析
            </h1>

            {/* Time range filter */}
            <div className="flex gap-2">
              {TIME_RANGES.map((tr) => (
                <button
                  key={tr.value}
                  onClick={() => setTimeRange(tr.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    timeRange === tr.value
                      ? 'bg-gold-500 text-white shadow-md'
                      : 'bg-white text-[#2C2C2C] hover:bg-gold-300/20'
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Loading overlay */}
        {loading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gold-600">
            <Activity className="h-4 w-4 animate-spin" />
            <span>載入中...</span>
          </div>
        )}

        {/* ── KPI Overview Cards ── */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
        >
          <KPICard
            icon={<Users className="h-5 w-5" />}
            label="總會員數"
            value={data.overview.totalMembers.toLocaleString()}
            suffix="人"
            color="text-gold-500"
          />
          <KPICard
            icon={<TrendingUp className="h-5 w-5" />}
            label="平均 LTV"
            value={`NT$${data.overview.avgLTV.toLocaleString()}`}
            color="text-emerald-600"
          />
          <KPICard
            icon={<ShieldAlert className="h-5 w-5" />}
            label="平均流失分數"
            value={data.overview.avgChurnScore.toString()}
            suffix="/100"
            color="text-amber-600"
          />
          <KPICard
            icon={<CreditCard className="h-5 w-5" />}
            label="平均信用分數"
            value={data.overview.avgCreditScore.toString()}
            suffix="/100"
            color="text-blue-600"
          />
          <KPICard
            icon={<RotateCcw className="h-5 w-5" />}
            label="退貨率"
            value={data.overview.overallReturnRate.toString()}
            suffix="%"
            color="text-red-500"
          />
        </motion.div>

        {/* ── Two-column: Segments + Churn ── */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* RFM Segment Distribution */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gold-500" />
              <h2 className="text-lg font-semibold text-[#2C2C2C]">RFM 客群分佈</h2>
            </div>
            <div className="space-y-3">
              {data.segmentDistribution.map((seg, i) => (
                <div key={seg.segment} className="group">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#2C2C2C]">{seg.segment}</span>
                    <span className="text-gray-500">
                      {seg.count.toLocaleString()} ({seg.percentage}%)
                    </span>
                  </div>
                  <div className="h-6 overflow-hidden rounded-full bg-gray-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(seg.count / maxSegmentCount) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
                      className={`h-full rounded-full ${SEGMENT_COLORS[seg.segment] || 'bg-gold-400'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Churn Risk Distribution */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-gold-500" />
              <h2 className="text-lg font-semibold text-[#2C2C2C]">流失風險分佈</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {data.churnDistribution.map((ch) => {
                const colors = CHURN_COLORS[ch.risk] || CHURN_COLORS['低風險']
                const pct = totalChurn > 0 ? Math.round((ch.count / totalChurn) * 100) : 0
                return (
                  <motion.div
                    key={ch.risk}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}
                  >
                    <p className={`text-sm font-medium ${colors.text}`}>{ch.risk}</p>
                    <p className={`mt-1 text-2xl font-bold ${colors.text}`}>
                      {ch.count.toLocaleString()}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${colors.icon.replace('text-', 'bg-')}`}
                      />
                    </div>
                    <p className={`mt-1 text-xs ${colors.text} opacity-70`}>{pct}% 佔比</p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* ── LTV Distribution ── */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-8 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gold-500" />
            <h2 className="text-lg font-semibold text-[#2C2C2C]">LTV 分佈</h2>
          </div>
          <div className="flex items-end gap-3">
            {data.ltvDistribution.map((ltv, i) => {
              const heightPct = (ltv.count / maxLtvCount) * 100
              return (
                <div key={ltv.range} className="flex flex-1 flex-col items-center">
                  <span className="mb-1 text-xs font-medium text-gray-500">
                    {ltv.count.toLocaleString()}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPct, 8)}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
                    className="w-full max-w-[80px] rounded-t-lg bg-gradient-to-t from-gold-500 to-gold-300"
                    style={{ minHeight: 20, maxHeight: 180 }}
                  />
                  <span className="mt-2 text-center text-xs text-gray-600">{ltv.range}</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ── Monthly Trends ── */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mb-8 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gold-500" />
            <h2 className="text-lg font-semibold text-[#2C2C2C]">月度趨勢</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left">
                  <th className="pb-3 pr-4 font-medium text-gray-500">月份</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">新會員</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">流失會員</th>
                  <th className="pb-3 font-medium text-gray-500">平均消費</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyTrends.map((trend, i) => (
                  <motion.tr
                    key={trend.month}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * i }}
                    className="border-b border-cream-100 last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium text-[#2C2C2C]">{trend.month}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                        +{trend.newMembers}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                        -{trend.churnedMembers}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-[#2C2C2C]">
                      NT${trend.avgSpend.toLocaleString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Top Tags ── */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, delay: 0.6 }}
          className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-2">
            <Tag className="h-5 w-5 text-gold-500" />
            <h2 className="text-lg font-semibold text-[#2C2C2C]">熱門標籤</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {data.topTags.map((t, i) => (
              <motion.span
                key={t.tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
                className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-cream-100 px-4 py-2 text-sm font-medium text-[#2C2C2C] transition-colors hover:border-gold-400 hover:bg-gold-300/10"
              >
                {t.tag}
                <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-xs font-semibold text-gold-600">
                  {t.count.toLocaleString()}
                </span>
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── KPI Card Component ── */
function KPICard({
  icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  suffix?: string
  color: string
}) {
  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className={`mb-3 ${color}`}>{icon}</div>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#2C2C2C] sm:text-2xl">
        {value}
        {Boolean(suffix) && (
          <span className="ml-0.5 text-sm font-normal text-gray-400">{suffix}</span>
        )}
      </p>
    </motion.div>
  )
}
