'use client'

import { useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Users,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  CreditCard,
  Percent,
} from 'lucide-react'

/**
 * 財務儀表板
 * 管理後台首頁 — 營收、訂單、退貨、會員概覽
 * 正式上線後接 Payload REST API 取得即時資料
 */

type DateRange = '7d' | '30d' | '90d' | 'year'

interface MetricCard {
  label: string
  value: string
  change: number // 百分比
  icon: React.ElementType
  color: string
}

// Demo data — 上線後由 API 提供
const DEMO_METRICS: Record<DateRange, MetricCard[]> = {
  '7d': [
    { label: '營業額', value: 'NT$ 128,600', change: 12.5, icon: DollarSign, color: 'text-green-600 bg-green-50' },
    { label: '訂單數', value: '42', change: 8.3, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
    { label: '客單價', value: 'NT$ 3,062', change: 3.8, icon: CreditCard, color: 'text-purple-600 bg-purple-50' },
    { label: '新會員', value: '18', change: 20.0, icon: Users, color: 'text-gold-600 bg-gold-50' },
    { label: '退貨率', value: '2.4%', change: -0.5, icon: RefreshCw, color: 'text-orange-600 bg-orange-50' },
    { label: '轉換率', value: '3.8%', change: 0.6, icon: Percent, color: 'text-teal-600 bg-teal-50' },
  ],
  '30d': [
    { label: '營業額', value: 'NT$ 486,200', change: 15.2, icon: DollarSign, color: 'text-green-600 bg-green-50' },
    { label: '訂單數', value: '158', change: 10.1, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
    { label: '客單價', value: 'NT$ 3,077', change: 4.6, icon: CreditCard, color: 'text-purple-600 bg-purple-50' },
    { label: '新會員', value: '62', change: 18.5, icon: Users, color: 'text-gold-600 bg-gold-50' },
    { label: '退貨率', value: '2.1%', change: -1.2, icon: RefreshCw, color: 'text-orange-600 bg-orange-50' },
    { label: '轉換率', value: '4.1%', change: 1.2, icon: Percent, color: 'text-teal-600 bg-teal-50' },
  ],
  '90d': [
    { label: '營業額', value: 'NT$ 1,428,500', change: 22.8, icon: DollarSign, color: 'text-green-600 bg-green-50' },
    { label: '訂單數', value: '465', change: 18.4, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
    { label: '客單價', value: 'NT$ 3,072', change: 3.7, icon: CreditCard, color: 'text-purple-600 bg-purple-50' },
    { label: '新會員', value: '186', change: 25.0, icon: Users, color: 'text-gold-600 bg-gold-50' },
    { label: '退貨率', value: '2.3%', change: -0.8, icon: RefreshCw, color: 'text-orange-600 bg-orange-50' },
    { label: '轉換率', value: '3.9%', change: 0.9, icon: Percent, color: 'text-teal-600 bg-teal-50' },
  ],
  year: [
    { label: '營業額', value: 'NT$ 5,862,000', change: 35.6, icon: DollarSign, color: 'text-green-600 bg-green-50' },
    { label: '訂單數', value: '1,892', change: 28.2, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
    { label: '客單價', value: 'NT$ 3,098', change: 5.8, icon: CreditCard, color: 'text-purple-600 bg-purple-50' },
    { label: '新會員', value: '724', change: 42.0, icon: Users, color: 'text-gold-600 bg-gold-50' },
    { label: '退貨率', value: '2.2%', change: -1.5, icon: RefreshCw, color: 'text-orange-600 bg-orange-50' },
    { label: '轉換率', value: '4.0%', change: 1.5, icon: Percent, color: 'text-teal-600 bg-teal-50' },
  ],
}

const DEMO_TOP_PRODUCTS = [
  { name: 'Serene 名媛蕾絲層次洋裝', sold: 48, revenue: 143040 },
  { name: 'Amelia 優雅疊紗包釦洋裝', sold: 35, revenue: 93800 },
  { name: '螞蟻腰都會修身直筒褲', sold: 32, revenue: 47360 },
  { name: 'Quincy 氣質裹身微開衩洋裝', sold: 28, revenue: 75040 },
  { name: 'Y2K個性橢圓墨鏡', sold: 24, revenue: 18720 },
]

const DEMO_RECENT_ORDERS = [
  { id: 'ORD-20260411-001', customer: '王**', total: 5660, status: '處理中', time: '10 分鐘前' },
  { id: 'ORD-20260411-002', customer: '李**', total: 2980, status: '已付款', time: '25 分鐘前' },
  { id: 'ORD-20260410-018', customer: '陳**', total: 4160, status: '已出貨', time: '2 小時前' },
  { id: 'ORD-20260410-017', customer: '林**', total: 1480, status: '已送達', time: '5 小時前' },
  { id: 'ORD-20260410-016', customer: '張**', total: 6440, status: '已送達', time: '8 小時前' },
]

export function FinancialDashboard() {
  const [range, setRange] = useState<DateRange>('30d')
  const metrics = DEMO_METRICS[range]

  const rangeLabels: Record<DateRange, string> = {
    '7d': '近 7 天',
    '30d': '近 30 天',
    '90d': '近 90 天',
    year: '本年度',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif">財務總覽</h1>
          <p className="text-sm text-muted-foreground mt-1">CHIC KIM & MIU 營運數據一覽</p>
        </div>
        <div className="flex gap-1 bg-cream-100 rounded-xl p-1">
          {(Object.keys(rangeLabels) as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                range === r
                  ? 'bg-white text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-cream-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.color}`}>
                <m.icon size={18} />
              </div>
              <span
                className={`text-xs flex items-center gap-0.5 ${
                  m.change >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {m.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(m.change)}%
              </span>
            </div>
            <p className="text-lg font-medium">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart Placeholder */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium flex items-center gap-2">
              <BarChart3 size={18} className="text-gold-500" />
              營收趨勢
            </h3>
            <span className="text-xs text-muted-foreground">{rangeLabels[range]}</span>
          </div>
          <div className="h-48 flex items-end gap-2">
            {/* Simple bar chart — 正式版接 Recharts / Chart.js */}
            {[65, 45, 80, 55, 92, 78, 100, 68, 88, 72, 95, 82].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gold-500/20 rounded-t-md hover:bg-gold-500/40 transition-colors"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[8px] text-muted-foreground">
                  {i + 1}月
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <h3 className="font-medium flex items-center gap-2 mb-6">
            <Package size={18} className="text-gold-500" />
            熱銷排行
          </h3>
          <div className="space-y-3">
            {DEMO_TOP_PRODUCTS.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center ${
                    i < 3 ? 'bg-gold-500 text-white' : 'bg-cream-200 text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    售出 {p.sold} 件 ・ NT$ {p.revenue.toLocaleString()}
                  </p>
                </div>
                <div className="w-20 h-1.5 rounded-full bg-cream-200 overflow-hidden">
                  <div
                    className="h-full bg-gold-500 rounded-full"
                    style={{ width: `${(p.sold / DEMO_TOP_PRODUCTS[0].sold) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium flex items-center gap-2 mb-6">
          <ShoppingBag size={18} className="text-gold-500" />
          最近訂單
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left">
                <th className="pb-3 font-medium">訂單編號</th>
                <th className="pb-3 font-medium">顧客</th>
                <th className="pb-3 font-medium text-right">金額</th>
                <th className="pb-3 font-medium">狀態</th>
                <th className="pb-3 font-medium text-right">時間</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_RECENT_ORDERS.map((order) => (
                <tr key={order.id} className="border-b border-cream-100 last:border-0">
                  <td className="py-3 font-mono text-xs">{order.id}</td>
                  <td className="py-3">{order.customer}</td>
                  <td className="py-3 text-right text-gold-600">
                    NT$ {order.total.toLocaleString()}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        order.status === '已送達'
                          ? 'bg-green-50 text-green-600'
                          : order.status === '已出貨'
                            ? 'bg-blue-50 text-blue-600'
                            : order.status === '已付款'
                              ? 'bg-purple-50 text-purple-600'
                              : 'bg-gold-50 text-gold-600'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 text-right text-xs text-muted-foreground">{order.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
