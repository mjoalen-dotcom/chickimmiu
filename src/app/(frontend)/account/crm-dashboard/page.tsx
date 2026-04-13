'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  TrendingUp,
  Shield,
  Zap,
  Award,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Star,
  UserX,
  Activity,
} from 'lucide-react'
import { motion } from 'framer-motion'

/**
 * CRM Dashboard — 會員管理儀表板
 * ───────────────────────────────
 * 關鍵 KPI：會員概覽、信用分數分佈、等級分佈、自動化執行、近期警報
 *
 * ⚠️ 此頁面僅後台管理員可見（前台路由，但需驗證 admin 權限）
 *    實際部署時應加入 auth guard
 */

interface DashboardData {
  overview: {
    totalMembers: number
    activeMembers30d: number
    newMembers7d: number
    avgCreditScore: number
    avgLifetimeSpend: number
  }
  tierDistribution: Record<string, number>
  creditDistribution: Record<string, number>
  creditKPIs: {
    avgScore: number
    goodCustomerRate: number
    blacklistRate: number
    returnRateCorrelation: number
    scoreDistributionChart: Array<{ range: string; count: number }>
  }
  journeyStats: {
    activeJourneys: number
    triggeredToday: number
    completionRate: number
  }
  recentAlerts: Array<{ type: string; message: string; userId: string; timestamp: string }>
}

// Demo data
const DEMO_DATA: DashboardData = {
  overview: {
    totalMembers: 2847,
    activeMembers30d: 1423,
    newMembers7d: 89,
    avgCreditScore: 82.5,
    avgLifetimeSpend: 15680,
  },
  tierDistribution: {
    '優雅初遇者': 1240,
    '曦漾仙子': 820,
    '優漾女神': 480,
    '金曦女王': 195,
    '星耀皇后': 78,
    '璀璨天后': 34,
  },
  creditDistribution: {
    '優質好客人': 1580,
    '一般': 820,
    '觀察名單': 280,
    '警示名單': 112,
    '黑名單': 42,
    '停權': 13,
  },
  creditKPIs: {
    avgScore: 82.5,
    goodCustomerRate: 55.5,
    blacklistRate: 1.9,
    returnRateCorrelation: -0.72,
    scoreDistributionChart: [
      { range: '0-9', count: 13 },
      { range: '10-29', count: 42 },
      { range: '30-49', count: 112 },
      { range: '50-69', count: 280 },
      { range: '70-89', count: 820 },
      { range: '90-100', count: 1580 },
    ],
  },
  journeyStats: {
    activeJourneys: 12,
    triggeredToday: 156,
    completionRate: 87.3,
  },
  recentAlerts: [
    { type: 'credit_low', message: '會員 #1842 信用分數降至 28 分，已加入黑名單', userId: '1842', timestamp: '2026-04-11T09:15:00Z' },
    { type: 'consecutive_return', message: '會員 #2156 連續 3 次無理由退貨', userId: '2156', timestamp: '2026-04-11T08:30:00Z' },
    { type: 'vip_upgrade', message: '會員 #0923 升級為「星耀皇后」', userId: '0923', timestamp: '2026-04-10T22:10:00Z' },
    { type: 'good_customer', message: '會員 #1105 信用分數達 95 分，已發送好客人表揚', userId: '1105', timestamp: '2026-04-10T18:45:00Z' },
    { type: 'dormant', message: '387 位會員超過 30 天未登入，已觸發沉睡喚回', userId: '', timestamp: '2026-04-10T06:00:00Z' },
  ],
}

const ALERT_ICONS: Record<string, { icon: typeof AlertTriangle; color: string }> = {
  credit_low: { icon: AlertTriangle, color: 'text-red-500' },
  consecutive_return: { icon: RefreshCw, color: 'text-orange-500' },
  vip_upgrade: { icon: Award, color: 'text-gold-500' },
  good_customer: { icon: Star, color: 'text-emerald-500' },
  dormant: { icon: UserX, color: 'text-amber-500' },
}

export default function CRMDashboardPage() {
  const [data, setData] = useState<DashboardData>(DEMO_DATA)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/crm/dashboard')
      .then((r) => r.json())
      .then((d) => { if (d.overview) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxChartCount = Math.max(...data.creditKPIs.scoreDistributionChart.map((d) => d.count), 1)

  return (
    <main className="bg-cream-50 min-h-screen">
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-10">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">CRM DASHBOARD</p>
          <h1 className="text-2xl md:text-3xl font-serif">會員 CRM 儀表板</h1>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* ── 概覽 KPI ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: '總會員數', value: data.overview.totalMembers.toLocaleString(), icon: Users, color: 'text-blue-500' },
            { label: '30天活躍', value: data.overview.activeMembers30d.toLocaleString(), icon: Activity, color: 'text-emerald-500' },
            { label: '7天新增', value: `+${data.overview.newMembers7d}`, icon: TrendingUp, color: 'text-gold-500' },
            { label: '平均信用分數', value: data.overview.avgCreditScore.toFixed(1), icon: Shield, color: 'text-purple-500' },
            { label: '平均消費', value: `NT$${Math.round(data.overview.avgLifetimeSpend).toLocaleString()}`, icon: BarChart3, color: 'text-pink-500' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-cream-200 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon size={16} className={kpi.color} />
                <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── 信用分數分佈圖 ── */}
          <div className="bg-white rounded-2xl border border-cream-200 p-6">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Shield size={16} className="text-gold-500" />
              信用分數分佈
            </h3>
            <div className="space-y-3">
              {data.creditKPIs.scoreDistributionChart.map((item) => (
                <div key={item.range} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                    {item.range}
                  </span>
                  <div className="flex-1 h-6 bg-cream-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        item.range === '90-100' ? 'bg-emerald-500' :
                        item.range === '70-89' ? 'bg-blue-500' :
                        item.range === '50-69' ? 'bg-amber-500' :
                        item.range === '30-49' ? 'bg-orange-500' :
                        item.range === '10-29' ? 'bg-red-400' : 'bg-gray-400'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / maxChartCount) * 100}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                  <span className="text-xs font-medium w-12 shrink-0">{item.count}</span>
                </div>
              ))}
            </div>

            {/* Credit KPIs */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-cream-200">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{data.creditKPIs.goodCustomerRate}%</p>
                <p className="text-[10px] text-muted-foreground">好客人比例</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-500">{data.creditKPIs.blacklistRate}%</p>
                <p className="text-[10px] text-muted-foreground">黑名單比例</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-600">{data.creditKPIs.returnRateCorrelation}</p>
                <p className="text-[10px] text-muted-foreground">退貨率關聯</p>
              </div>
            </div>
          </div>

          {/* ── 等級分佈 ── */}
          <div className="bg-white rounded-2xl border border-cream-200 p-6">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Award size={16} className="text-gold-500" />
              會員等級分佈
            </h3>
            <div className="space-y-3">
              {Object.entries(data.tierDistribution).map(([name, count]) => {
                const total = Object.values(data.tierDistribution).reduce((s, n) => s + n, 0)
                const pct = total > 0 ? (count / total) * 100 : 0
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs w-20 text-right shrink-0 truncate">{name}</span>
                    <div className="flex-1 h-6 bg-cream-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gold-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                    <span className="text-xs font-medium w-14 shrink-0">
                      {count} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Journey stats */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-cream-200">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap size={12} className="text-gold-500" />
                </div>
                <p className="text-lg font-bold">{data.journeyStats.activeJourneys}</p>
                <p className="text-[10px] text-muted-foreground">活躍 Journey</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">{data.journeyStats.triggeredToday}</p>
                <p className="text-[10px] text-muted-foreground">今日觸發</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{data.journeyStats.completionRate}%</p>
                <p className="text-[10px] text-muted-foreground">完成率</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 近期警報 ── */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-gold-500" />
            近期系統警報
          </h3>
          <div className="space-y-2">
            {data.recentAlerts.map((alert, i) => {
              const iconInfo = ALERT_ICONS[alert.type] || { icon: AlertTriangle, color: 'text-gray-400' }
              const IconComponent = iconInfo.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 py-3 px-4 bg-cream-50 rounded-xl"
                >
                  <IconComponent size={16} className={`${iconInfo.color} mt-0.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">{alert.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {new Date(alert.timestamp).toLocaleString('zh-TW', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* ── 信用分數狀態分佈 ── */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <h3 className="text-sm font-medium mb-4">信用狀態快覽</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {Object.entries(data.creditDistribution).map(([label, count]) => {
              const colorMap: Record<string, string> = {
                '優質好客人': 'bg-emerald-50 border-emerald-200 text-emerald-700',
                '一般': 'bg-blue-50 border-blue-200 text-blue-700',
                '觀察名單': 'bg-amber-50 border-amber-200 text-amber-700',
                '警示名單': 'bg-orange-50 border-orange-200 text-orange-700',
                '黑名單': 'bg-red-50 border-red-200 text-red-700',
                '停權': 'bg-gray-50 border-gray-200 text-gray-700',
              }
              return (
                <div
                  key={label}
                  className={`rounded-xl border p-3 text-center ${colorMap[label] || 'bg-cream-50 border-cream-200'}`}
                >
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-[10px] mt-1">{label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
