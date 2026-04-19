'use client'

import { useState } from 'react'
import { Package, RotateCcw, ArrowRightLeft, ChevronRight, Clock, CheckCircle, XCircle, Truck } from 'lucide-react'

type TabType = 'returns' | 'exchanges'

const DEMO_RETURNS = [
  {
    id: 'RTN-20260405-A1B2',
    orderNumber: 'ORD-20260401-X1Y2',
    date: '2026-04-05',
    status: 'approved',
    items: [{ name: 'Serene 名媛蕾絲層次洋裝', variant: 'M / 黑色', qty: 1, reason: '尺寸不合' }],
    refundAmount: 2980,
    refundMethod: '原路退回',
  },
  {
    id: 'RTN-20260320-C3D4',
    orderNumber: 'ORD-20260318-Z3W4',
    date: '2026-03-20',
    status: 'completed',
    items: [{ name: 'Y2K個性橢圓墨鏡', variant: '黑框', qty: 1, reason: '商品瑕疵' }],
    refundAmount: 780,
    refundMethod: '購物金',
  },
]

const DEMO_EXCHANGES = [
  {
    id: 'EXC-20260408-E5F6',
    orderNumber: 'ORD-20260405-A1B2',
    date: '2026-04-08',
    status: 'shipping',
    items: [{ name: 'Quincy 氣質裹身微開衩洋裝', from: 'S / 白色', to: 'M / 白色', qty: 1, reason: '尺寸不合' }],
    priceDiff: 0,
  },
]

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '待審核', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  approved: { label: '已核准', color: 'text-blue-600 bg-blue-50', icon: CheckCircle },
  returning: { label: '退回中', color: 'text-orange-600 bg-orange-50', icon: Truck },
  received: { label: '已收到', color: 'text-indigo-600 bg-indigo-50', icon: Package },
  shipping: { label: '新品寄出', color: 'text-purple-600 bg-purple-50', icon: Truck },
  completed: { label: '已完成', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  rejected: { label: '已拒絕', color: 'text-red-600 bg-red-50', icon: XCircle },
  refunded: { label: '已退款', color: 'text-green-600 bg-green-50', icon: CheckCircle },
}

export function ReturnsClient() {
  const [tab, setTab] = useState<TabType>('returns')

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex gap-1 bg-cream-100 rounded-full p-1 w-fit">
        <button
          onClick={() => setTab('returns')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm transition-all ${
            tab === 'returns' ? 'bg-foreground text-cream-50' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <RotateCcw size={14} />
          退貨
        </button>
        <button
          onClick={() => setTab('exchanges')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm transition-all ${
            tab === 'exchanges' ? 'bg-foreground text-cream-50' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowRightLeft size={14} />
          換貨
        </button>
      </div>

      {/* Apply button */}
      <div className="flex justify-end">
        <button className="px-5 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors">
          申請{tab === 'returns' ? '退貨' : '換貨'}
        </button>
      </div>

      {/* Returns list */}
      {tab === 'returns' && (
        <div className="space-y-4">
          {DEMO_RETURNS.map((r) => {
            const st = STATUS_MAP[r.status] || STATUS_MAP.pending
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-cream-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">{r.id}</p>
                    <p className="text-xs text-muted-foreground">原訂單 {r.orderNumber}・{r.date}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${st.color}`}>
                    {st.label}
                  </span>
                </div>
                {r.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-t border-cream-100">
                    <div>
                      <p className="text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.variant}・x{item.qty}・{item.reason}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-cream-200">
                  <p className="text-sm text-muted-foreground">退款方式：{r.refundMethod}</p>
                  <p className="text-sm font-medium text-gold-600">NT$ {r.refundAmount.toLocaleString()}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Exchanges list */}
      {tab === 'exchanges' && (
        <div className="space-y-4">
          {DEMO_EXCHANGES.map((e) => {
            const st = STATUS_MAP[e.status] || STATUS_MAP.pending
            return (
              <div key={e.id} className="bg-white rounded-2xl border border-cream-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">{e.id}</p>
                    <p className="text-xs text-muted-foreground">原訂單 {e.orderNumber}・{e.date}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${st.color}`}>
                    {st.label}
                  </span>
                </div>
                {e.items.map((item, i) => (
                  <div key={i} className="py-2 border-t border-cream-100">
                    <p className="text-sm">{item.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{item.from}</span>
                      <ChevronRight size={12} />
                      <span className="text-gold-600 font-medium">{item.to}</span>
                      <span>・x{item.qty}・{item.reason}</span>
                    </div>
                  </div>
                ))}
                {e.priceDiff !== 0 && (
                  <div className="mt-3 pt-3 border-t border-cream-200 text-right">
                    <p className="text-sm">
                      {e.priceDiff > 0 ? '需補差價' : '退差價'}：
                      <span className="font-medium text-gold-600">NT$ {Math.abs(e.priceDiff).toLocaleString()}</span>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
