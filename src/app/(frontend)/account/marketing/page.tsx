'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  BarChart3,
  TrendingUp,
  Zap,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Gift,
  Cake,
  Target,
  FlaskConical,
  Calendar,
  RefreshCw,
  Users,
  DollarSign,
  MousePointerClick,
  Eye,
  ArrowUpRight,
} from 'lucide-react'

/**
 * 行銷自動化 Dashboard
 * ───────────────────────────────
 * 管理員專屬頁面，呈現完整行銷成效。
 *
 * Sections:
 *  1. 總覽 KPI
 *  2. 通道表現
 *  3. 客群表現
 *  4. 信用分數影響
 *  5. 生日行銷
 *  6. 近期活動
 *  7. A/B 測試
 *
 * ⚠️ 此頁面僅後台管理員可見
 *    實際部署時應加入 auth guard
 */

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

interface DashboardData {
  overview: {
    activeCampaigns: number
    scheduledCampaigns: number
    draftCampaigns: number
    totalCampaigns: number
    runningABTests: number
    completedABTests: number
    activeTemplates: number
  }
  thirtyDayMetrics: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    converted: number
    revenue: number
    unsubscribed: number
    openRate: number
    clickRate: number
    conversionRate: number
  }
  channelPerformance: Array<{
    channel: string
    sent: number
    opened: number
    clicked: number
    converted: number
    revenue: number
    openRate: number
    clickRate: number
    conversionRate: number
  }>
  segmentPerformance: Array<{
    segment: string
    campaigns: number
    sent: number
    converted: number
    revenue: number
    conversionRate: number
  }>
  topCampaigns: Array<{
    id: string
    campaignName: string
    campaignType: string
    status: string
    tierFilter: string[]
    sent: number
    converted: number
    revenue: number
    conversionRate: number
  }>
  creditScoreImpact: {
    description: string
    avgScoreWithCampaign: number
    avgScoreWithoutCampaign: number
    recommendation: string
  }
  recentCampaigns: Array<{
    id: string
    campaignName: string
    campaignType: string
    status: string
    tierFilter: string[]
    channels: string[]
    schedule: Record<string, unknown>
    sent: number
    revenue: number
    updatedAt: string
  }>
}

interface BirthdayDashboardData {
  currentMonthBirthdays: number
  activeCampaigns: number
  completedThisMonth: number
  totalGiftsIssued: number
  totalRevenue: number
  avgConversionRate: number
  tierDistribution: Record<string, number>
  phasePerformance: Array<{
    phase: number
    phaseName: string
    sent: number
    opened: number
    clicked: number
    converted: number
  }>
  upcomingPhases: Array<{
    campaignId: string
    userName: string
    tierFrontName: string
    phase: number
    scheduledDate: string
  }>
}

interface ABTestData {
  id: string
  campaignName: string
  status: string
  variants: Array<{
    variantName: string
    variantSlug: string
    sent: number
    opened: number
    clicked: number
    converted: number
  }>
  winnerMetric: string
  startedAt: string
}

// ══════════════════════════════════════════════════════════
// Skeleton placeholder
// ══════════════════════════════════════════════════════════

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#F0E6D6]/50 rounded-lg ${className}`} />
  )
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-5">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

function formatNumber(n: number): string {
  return n.toLocaleString('zh-TW')
}

function formatCurrency(n: number): string {
  return `NT$${n.toLocaleString('zh-TW')}`
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: '進行中', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  scheduled: { label: '已排程', bg: 'bg-blue-50', text: 'text-blue-700' },
  draft: { label: '草稿', bg: 'bg-gray-50', text: 'text-gray-600' },
  completed: { label: '已完成', bg: 'bg-[#F8F1E9]', text: 'text-[#C19A5B]' },
  paused: { label: '已暫停', bg: 'bg-amber-50', text: 'text-amber-700' },
  running: { label: '測試中', bg: 'bg-purple-50', text: 'text-purple-700' },
}

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status] ?? { label: status, bg: 'bg-gray-50', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  )
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  LINE: MessageSquare,
  Email: Mail,
  SMS: Smartphone,
  '簡訊': Smartphone,
  '推播通知': Bell,
  '站內彈窗': Zap,
  EDM: Mail,
}

// ══════════════════════════════════════════════════════════
// Section Header
// ══════════════════════════════════════════════════════════

function SectionHeader({ icon: Icon, title }: { icon: typeof Activity; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-6 bg-[#C19A5B] rounded-full" />
      <Icon size={18} className="text-[#C19A5B]" />
      <h2 className="text-lg font-medium text-[#2C2C2C]">{title}</h2>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Page Component
// ══════════════════════════════════════════════════════════

export default function MarketingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [birthdayData, setBirthdayData] = useState<BirthdayDashboardData | null>(null)
  const [abTests, setABTests] = useState<ABTestData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [dashRes, bdRes, abRes] = await Promise.allSettled([
        fetch('/api/marketing/dashboard').then((r) => r.json()),
        fetch('/api/marketing/birthday-dashboard').then((r) => r.json()),
        fetch('/api/marketing/ab-tests?status=running').then((r) => r.json()),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value?.data) {
        setData(dashRes.value.data)
      }
      if (bdRes.status === 'fulfilled' && bdRes.value?.data) {
        setBirthdayData(bdRes.value.data)
      }
      if (abRes.status === 'fulfilled') {
        const abValue = abRes.value
        if (Array.isArray(abValue?.docs)) {
          setABTests(abValue.docs)
        } else if (Array.isArray(abValue?.data)) {
          setABTests(abValue.data)
        }
      }
    } catch {
      // 靜默處理
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ROI 計算
  const roi = data
    ? data.thirtyDayMetrics.revenue > 0
      ? ((data.thirtyDayMetrics.revenue - data.thirtyDayMetrics.sent * 2) / Math.max(data.thirtyDayMetrics.sent * 2, 1) * 100)
      : 0
    : 0

  return (
    <main className="min-h-screen bg-[#FDF8F3]">
      {/* ── Header ── */}
      <div className="bg-gradient-to-b from-[#F8F1E9] to-[#FDF8F3] border-b border-[#F0E6D6]">
        <div className="container mx-auto px-4 py-8 md:py-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2">MARKETING DASHBOARD</p>
              <h1 className="text-2xl md:text-3xl font-serif text-[#2C2C2C]">行銷自動化儀表板</h1>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#F0E6D6] rounded-xl text-sm text-[#2C2C2C] hover:border-[#C19A5B] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              重新整理
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 1. 總覽 KPI                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={BarChart3} title="總覽 KPI" />

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: '活躍活動數', value: formatNumber(data.overview.activeCampaigns), icon: Activity, color: 'text-emerald-500' },
                { label: '30日發送數', value: formatNumber(data.thirtyDayMetrics.sent), icon: Mail, color: 'text-blue-500' },
                { label: '30日營收', value: formatCurrency(data.thirtyDayMetrics.revenue), icon: DollarSign, color: 'text-[#C19A5B]' },
                { label: '平均開信率', value: formatPercent(data.thirtyDayMetrics.openRate), icon: Eye, color: 'text-purple-500' },
                { label: '平均點擊率', value: formatPercent(data.thirtyDayMetrics.clickRate), icon: MousePointerClick, color: 'text-pink-500' },
                { label: '平均轉換率', value: formatPercent(data.thirtyDayMetrics.conversionRate), icon: Target, color: 'text-orange-500' },
                { label: '整體 ROI', value: `${roi.toFixed(0)}%`, icon: TrendingUp, color: 'text-emerald-600' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <kpi.icon size={14} className={kpi.color} />
                    <span className="text-[10px] text-[#2C2C2C]/60">{kpi.label}</span>
                  </div>
                  <p className="text-xl font-bold text-[#2C2C2C]">{kpi.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#2C2C2C]/50">無法載入數據</p>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 2. 通道表現                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={Zap} title="通道表現" />

          <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] overflow-hidden">
            {loading ? (
              <div className="p-6"><TableSkeleton rows={4} /></div>
            ) : data && data.channelPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F0E6D6] bg-[#FDF8F3]">
                      <th className="text-left px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">通道</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">發送數</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">開信率</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">點擊率</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">轉換率</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">營收</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channelPerformance.map((ch, i) => {
                      const IconComp = CHANNEL_ICONS[ch.channel] ?? Mail
                      return (
                        <tr key={i} className="border-b border-[#F0E6D6]/50 hover:bg-[#FDF8F3]/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <IconComp size={14} className="text-[#C19A5B]" />
                              <span className="font-medium text-[#2C2C2C]">{ch.channel}</span>
                            </div>
                          </td>
                          <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(ch.sent)}</td>
                          <td className="text-right px-5 py-3">
                            <span className="text-[#2C2C2C] font-medium">{formatPercent(ch.openRate)}</span>
                          </td>
                          <td className="text-right px-5 py-3">
                            <span className="text-[#2C2C2C] font-medium">{formatPercent(ch.clickRate)}</span>
                          </td>
                          <td className="text-right px-5 py-3">
                            <span className="text-emerald-600 font-medium">{formatPercent(ch.conversionRate)}</span>
                          </td>
                          <td className="text-right px-5 py-3 font-medium text-[#C19A5B]">{formatCurrency(ch.revenue)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-[#2C2C2C]/50">尚無通道數據</div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 3. 客群表現                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={Users} title="客群表現" />

          <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] overflow-hidden">
            {loading ? (
              <div className="p-6"><TableSkeleton rows={5} /></div>
            ) : data && data.segmentPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F0E6D6] bg-[#FDF8F3]">
                      <th className="text-left px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">客群</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">活動數</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">發送數</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">轉換數</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">轉換率</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">營收</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.segmentPerformance.slice(0, 10).map((seg, i) => (
                      <tr key={i} className="border-b border-[#F0E6D6]/50 hover:bg-[#FDF8F3]/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-[#2C2C2C]">{seg.segment}</td>
                        <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(seg.campaigns)}</td>
                        <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(seg.sent)}</td>
                        <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(seg.converted)}</td>
                        <td className="text-right px-5 py-3">
                          <span className="text-emerald-600 font-medium">{formatPercent(seg.conversionRate)}</span>
                        </td>
                        <td className="text-right px-5 py-3 font-medium text-[#C19A5B]">{formatCurrency(seg.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-[#2C2C2C]/50">尚無客群數據</div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 4. 信用分數影響                                          */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={Target} title="信用分數影響" />

          <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-6">
            {loading ? (
              <TableSkeleton rows={3} />
            ) : data ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 有活動受眾 */}
                  <div className="text-center p-4 bg-[#FDF8F3] rounded-xl">
                    <p className="text-[10px] text-[#2C2C2C]/60 mb-1">有行銷活動受眾平均分數</p>
                    <p className="text-3xl font-bold text-emerald-600">
                      {data.creditScoreImpact.avgScoreWithCampaign}
                    </p>
                  </div>
                  {/* 無活動受眾 */}
                  <div className="text-center p-4 bg-[#FDF8F3] rounded-xl">
                    <p className="text-[10px] text-[#2C2C2C]/60 mb-1">無行銷活動受眾平均分數</p>
                    <p className="text-3xl font-bold text-[#2C2C2C]">
                      {data.creditScoreImpact.avgScoreWithoutCampaign}
                    </p>
                  </div>
                  {/* 差距 */}
                  <div className="text-center p-4 bg-[#FDF8F3] rounded-xl">
                    <p className="text-[10px] text-[#2C2C2C]/60 mb-1">分數差距</p>
                    <p className={`text-3xl font-bold ${
                      data.creditScoreImpact.avgScoreWithCampaign - data.creditScoreImpact.avgScoreWithoutCampaign > 0
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    }`}>
                      {data.creditScoreImpact.avgScoreWithCampaign - data.creditScoreImpact.avgScoreWithoutCampaign > 0 ? '+' : ''}
                      {data.creditScoreImpact.avgScoreWithCampaign - data.creditScoreImpact.avgScoreWithoutCampaign}
                    </p>
                  </div>
                </div>

                {/* 信用區間轉換率 */}
                <div>
                  <h3 className="text-xs font-medium text-[#2C2C2C]/70 mb-3">不同信用分數區間的預估轉換率與平均營收</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { range: '90-100', label: '優質好客人', convRate: 12.8, avgRevenue: 4200, color: 'bg-emerald-500' },
                      { range: '70-89', label: '良好', convRate: 8.5, avgRevenue: 2800, color: 'bg-blue-500' },
                      { range: '50-69', label: '一般', convRate: 5.2, avgRevenue: 1600, color: 'bg-amber-500' },
                      { range: '30-49', label: '觀察名單', convRate: 2.8, avgRevenue: 800, color: 'bg-orange-500' },
                      { range: '0-29', label: '警示', convRate: 0.9, avgRevenue: 200, color: 'bg-red-400' },
                    ].map((item) => (
                      <div key={item.range} className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                        <div className={`w-full h-1 ${item.color} rounded-full mb-2`} />
                        <p className="text-[10px] text-[#2C2C2C]/60">{item.range} 分</p>
                        <p className="text-xs font-medium text-[#2C2C2C] mt-1">{item.label}</p>
                        <p className="text-sm font-bold text-emerald-600 mt-2">{item.convRate}%</p>
                        <p className="text-[10px] text-[#2C2C2C]/50">轉換率</p>
                        <p className="text-sm font-bold text-[#C19A5B] mt-1">{formatCurrency(item.avgRevenue)}</p>
                        <p className="text-[10px] text-[#2C2C2C]/50">平均營收</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 建議 */}
                <div className="flex items-start gap-3 p-4 bg-[#F8F1E9]/50 rounded-xl border border-[#F0E6D6]">
                  <ArrowUpRight size={16} className="text-[#C19A5B] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#2C2C2C]">{data.creditScoreImpact.recommendation}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#2C2C2C]/50">無法載入數據</p>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 5. 生日行銷                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={Cake} title="生日行銷" />

          <div className="space-y-4">
            {/* 生日 KPI */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : birthdayData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: '當月壽星數', value: formatNumber(birthdayData.currentMonthBirthdays), icon: Gift, color: 'text-pink-500' },
                    { label: '活躍生日活動', value: formatNumber(birthdayData.activeCampaigns), icon: Cake, color: 'text-[#C19A5B]' },
                    { label: '已完成活動', value: formatNumber(birthdayData.completedThisMonth), icon: Activity, color: 'text-emerald-500' },
                    { label: '生日營收', value: formatCurrency(birthdayData.totalRevenue), icon: DollarSign, color: 'text-[#C19A5B]' },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <kpi.icon size={14} className={kpi.color} />
                        <span className="text-[10px] text-[#2C2C2C]/60">{kpi.label}</span>
                      </div>
                      <p className="text-xl font-bold text-[#2C2C2C]">{kpi.value}</p>
                    </div>
                  ))}
                </div>

                {/* 各階段表現 */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] overflow-hidden">
                  <div className="p-5 border-b border-[#F0E6D6]">
                    <h3 className="text-sm font-medium text-[#2C2C2C]">各階段表現</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#F0E6D6] bg-[#FDF8F3]">
                          <th className="text-left px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">階段</th>
                          <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">發送</th>
                          <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">開啟</th>
                          <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">點擊</th>
                          <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">轉換</th>
                        </tr>
                      </thead>
                      <tbody>
                        {birthdayData.phasePerformance.map((p) => (
                          <tr key={p.phase} className="border-b border-[#F0E6D6]/50 hover:bg-[#FDF8F3]/50 transition-colors">
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-[#F8F1E9] text-[#C19A5B] text-[10px] font-bold flex items-center justify-center">
                                  {p.phase}
                                </span>
                                <span className="font-medium text-[#2C2C2C]">{p.phaseName}</span>
                              </span>
                            </td>
                            <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(p.sent)}</td>
                            <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(p.opened)}</td>
                            <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(p.clicked)}</td>
                            <td className="text-right px-5 py-3 text-emerald-600 font-medium">{formatNumber(p.converted)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 等級分佈 + 即將執行的階段 */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* 等級分佈 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-5">
                    <h3 className="text-sm font-medium text-[#2C2C2C] mb-4">壽星等級分佈</h3>
                    <div className="space-y-3">
                      {Object.entries(birthdayData.tierDistribution).map(([name, count]) => {
                        const total = Object.values(birthdayData.tierDistribution).reduce((s, n) => s + n, 0)
                        const pct = total > 0 ? (count / total) * 100 : 0
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <span className="text-xs w-20 text-right shrink-0 truncate text-[#2C2C2C]">{name}</span>
                            <div className="flex-1 h-5 bg-[#FDF8F3] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#C19A5B] transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-16 shrink-0 text-[#2C2C2C]">
                              {count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 即將執行的階段 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-5">
                    <h3 className="text-sm font-medium text-[#2C2C2C] mb-4">即將執行的階段</h3>
                    {birthdayData.upcomingPhases.length > 0 ? (
                      <div className="space-y-2">
                        {birthdayData.upcomingPhases.map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-[#FDF8F3] rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#C19A5B] text-white text-[10px] font-bold flex items-center justify-center">
                                {item.phase}
                              </span>
                              <div>
                                <p className="text-xs font-medium text-[#2C2C2C]">{item.userName}</p>
                                <p className="text-[10px] text-[#2C2C2C]/50">{item.tierFrontName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-[#2C2C2C]/60">
                                {new Date(item.scheduledDate).toLocaleDateString('zh-TW')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#2C2C2C]/50 text-center py-4">目前無待執行的階段</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-8 text-center">
                <Cake size={32} className="text-[#C19A5B]/30 mx-auto mb-3" />
                <p className="text-sm text-[#2C2C2C]/50">尚無生日行銷數據</p>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 6. 近期活動                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={Calendar} title="近期活動" />

          <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] overflow-hidden">
            {loading ? (
              <div className="p-6"><TableSkeleton rows={5} /></div>
            ) : data && data.recentCampaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F0E6D6] bg-[#FDF8F3]">
                      <th className="text-left px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">活動名稱</th>
                      <th className="text-left px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">類型</th>
                      <th className="text-left px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">狀態</th>
                      <th className="text-left px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">通道</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">發送數</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">營收</th>
                      <th className="text-right px-5 py-3 text-[10px] font-medium text-[#2C2C2C]/60 uppercase tracking-wider">更新時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCampaigns.map((c) => (
                      <tr key={c.id} className="border-b border-[#F0E6D6]/50 hover:bg-[#FDF8F3]/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#2C2C2C] truncate max-w-[200px]">
                            {Boolean(c.campaignName) ? String(c.campaignName) : `活動 ${c.id.slice(0, 6)}`}
                          </p>
                          {c.tierFilter.length > 0 && (
                            <p className="text-[10px] text-[#C19A5B] mt-0.5">
                              {c.tierFilter.join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[#2C2C2C]/70">{Boolean(c.campaignType) ? String(c.campaignType) : '-'}</td>
                        <td className="px-5 py-3"><StatusBadge status={String(c.status)} /></td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1">
                            {(c.channels ?? []).map((ch) => {
                              const ChIcon = CHANNEL_ICONS[ch] ?? Mail
                              return <ChIcon key={ch} size={12} className="text-[#2C2C2C]/40" />
                            })}
                          </div>
                        </td>
                        <td className="text-right px-5 py-3 text-[#2C2C2C]">{formatNumber(c.sent)}</td>
                        <td className="text-right px-5 py-3 font-medium text-[#C19A5B]">{formatCurrency(c.revenue)}</td>
                        <td className="text-right px-5 py-3 text-[10px] text-[#2C2C2C]/50">
                          {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('zh-TW') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <Calendar size={32} className="text-[#C19A5B]/30 mx-auto mb-3" />
                <p className="text-sm text-[#2C2C2C]/50">尚無活動數據</p>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 7. A/B 測試                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={FlaskConical} title="A/B 測試" />

          <div className="bg-white rounded-2xl shadow-sm border border-[#F0E6D6] p-6">
            {loading ? (
              <TableSkeleton rows={3} />
            ) : abTests.length > 0 ? (
              <div className="space-y-6">
                {abTests.map((test) => (
                  <div key={test.id} className="border border-[#F0E6D6] rounded-xl overflow-hidden">
                    {/* 測試 header */}
                    <div className="flex items-center justify-between p-4 bg-[#FDF8F3]">
                      <div>
                        <p className="font-medium text-[#2C2C2C]">
                          {Boolean(test.campaignName) ? String(test.campaignName) : `測試 ${test.id.slice(0, 6)}`}
                        </p>
                        <p className="text-[10px] text-[#2C2C2C]/50 mt-0.5">
                          優勝指標：{test.winnerMetric === 'clickRate' ? '點擊率' : test.winnerMetric === 'conversionRate' ? '轉換率' : test.winnerMetric}
                        </p>
                      </div>
                      <StatusBadge status={test.status} />
                    </div>

                    {/* Variant 表格 */}
                    {test.variants && test.variants.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-b border-[#F0E6D6]">
                            <th className="text-left px-4 py-2 text-[10px] font-medium text-[#2C2C2C]/60">變體</th>
                            <th className="text-right px-4 py-2 text-[10px] font-medium text-[#2C2C2C]/60">發送</th>
                            <th className="text-right px-4 py-2 text-[10px] font-medium text-[#2C2C2C]/60">開啟</th>
                            <th className="text-right px-4 py-2 text-[10px] font-medium text-[#2C2C2C]/60">點擊</th>
                            <th className="text-right px-4 py-2 text-[10px] font-medium text-[#2C2C2C]/60">轉換</th>
                            <th className="text-right px-4 py-2 text-[10px] font-medium text-[#2C2C2C]/60">點擊率</th>
                          </tr>
                        </thead>
                        <tbody>
                          {test.variants.map((v, vi) => {
                            const clickRate = v.opened > 0 ? (v.clicked / v.opened) * 100 : 0
                            return (
                              <tr key={vi} className="border-b border-[#F0E6D6]/50">
                                <td className="px-4 py-2 font-medium text-[#2C2C2C]">{v.variantName}</td>
                                <td className="text-right px-4 py-2">{formatNumber(v.sent)}</td>
                                <td className="text-right px-4 py-2">{formatNumber(v.opened)}</td>
                                <td className="text-right px-4 py-2">{formatNumber(v.clicked)}</td>
                                <td className="text-right px-4 py-2 text-emerald-600 font-medium">{formatNumber(v.converted)}</td>
                                <td className="text-right px-4 py-2 font-medium text-[#C19A5B]">{formatPercent(clickRate)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <FlaskConical size={32} className="text-[#C19A5B]/30 mx-auto mb-3" />
                <p className="text-sm text-[#2C2C2C]/50">目前無進行中的 A/B 測試</p>
                {data && (
                  <p className="text-[10px] text-[#2C2C2C]/40 mt-1">
                    已完成 {formatNumber(data.overview.completedABTests)} 個測試
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  )
}
