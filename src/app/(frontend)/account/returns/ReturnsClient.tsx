'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Package,
  RotateCcw,
  ArrowRightLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Inbox,
} from 'lucide-react'

export type ReturnLite = {
  id: string
  returnNumber: string
  orderNumber: string
  createdAt: string
  status: string
  items: Array<{ productName: string; variant?: string; qty: number; reasonLabel: string }>
  refundAmount?: number
  refundMethodLabel?: string
}

export type ExchangeLite = {
  id: string
  exchangeNumber: string
  orderNumber: string
  createdAt: string
  status: string
  items: Array<{
    productName: string
    from: string
    to: string
    qty: number
    reasonLabel: string
  }>
  priceDifference: number
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '待審核', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  approved: { label: '已核准', color: 'text-blue-600 bg-blue-50', icon: CheckCircle },
  returning: { label: '退回中', color: 'text-orange-600 bg-orange-50', icon: Truck },
  received: { label: '已收到', color: 'text-indigo-600 bg-indigo-50', icon: Package },
  shipped: { label: '新品寄出', color: 'text-purple-600 bg-purple-50', icon: Truck },
  completed: { label: '已完成', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  rejected: { label: '已拒絕', color: 'text-red-600 bg-red-50', icon: XCircle },
  cancelled: { label: '已取消', color: 'text-gray-600 bg-gray-50', icon: XCircle },
  refunded: { label: '已退款', color: 'text-green-600 bg-green-50', icon: CheckCircle },
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return '—'
  }
}

type TabType = 'returns' | 'exchanges'

export function ReturnsClient({
  returns,
  exchanges,
}: {
  returns: ReturnLite[]
  exchanges: ExchangeLite[]
}) {
  const [tab, setTab] = useState<TabType>('returns')

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex gap-1 bg-cream-100 rounded-full p-1 w-fit">
        <button
          onClick={() => setTab('returns')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm transition-all ${
            tab === 'returns'
              ? 'bg-foreground text-cream-50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <RotateCcw size={14} />
          退貨（{returns.length}）
        </button>
        <button
          onClick={() => setTab('exchanges')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm transition-all ${
            tab === 'exchanges'
              ? 'bg-foreground text-cream-50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowRightLeft size={14} />
          換貨（{exchanges.length}）
        </button>
      </div>

      {/* CTA to pick an order */}
      <div className="flex justify-end">
        <Link
          href="/account/orders"
          className="px-5 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors"
        >
          從我的訂單申請{tab === 'returns' ? '退貨' : '換貨'}
        </Link>
      </div>

      {/* Returns list */}
      {tab === 'returns' && (
        <div className="space-y-4">
          {returns.length === 0 ? (
            <EmptyState label="目前還沒有退貨申請" />
          ) : (
            returns.map((r) => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending
              return (
                <Link
                  key={r.id}
                  href={`/account/returns/${r.id}`}
                  className="block bg-white rounded-2xl border border-cream-200 p-5 hover:border-gold-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium font-mono">{r.returnNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        原訂單 {r.orderNumber}・{fmtDate(r.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${st.color}`}
                    >
                      {st.label}
                    </span>
                  </div>
                  {r.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-t border-cream-100"
                    >
                      <div>
                        <p className="text-sm">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.variant ? `${item.variant}・` : ''}x{item.qty}・
                          {item.reasonLabel}
                        </p>
                      </div>
                    </div>
                  ))}
                  {r.refundAmount != null && r.refundAmount > 0 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-cream-200">
                      <p className="text-sm text-muted-foreground">
                        退款方式：{r.refundMethodLabel || '—'}
                      </p>
                      <p className="text-sm font-medium text-gold-600">
                        NT$ {r.refundAmount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </Link>
              )
            })
          )}
        </div>
      )}

      {/* Exchanges list */}
      {tab === 'exchanges' && (
        <div className="space-y-4">
          {exchanges.length === 0 ? (
            <EmptyState label="目前還沒有換貨申請" />
          ) : (
            exchanges.map((e) => {
              const st = STATUS_MAP[e.status] || STATUS_MAP.pending
              return (
                <Link
                  key={e.id}
                  href={`/account/exchanges/${e.id}`}
                  className="block bg-white rounded-2xl border border-cream-200 p-5 hover:border-gold-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium font-mono">{e.exchangeNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        原訂單 {e.orderNumber}・{fmtDate(e.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${st.color}`}
                    >
                      {st.label}
                    </span>
                  </div>
                  {e.items.map((item, i) => (
                    <div key={i} className="py-2 border-t border-cream-100">
                      <p className="text-sm">{item.productName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>{item.from}</span>
                        <ChevronRight size={12} />
                        <span className="text-gold-600 font-medium">{item.to}</span>
                        <span>
                          ・x{item.qty}・{item.reasonLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                  {e.priceDifference !== 0 && (
                    <div className="mt-3 pt-3 border-t border-cream-200 text-right">
                      <p className="text-sm">
                        {e.priceDifference > 0 ? '需補差價' : '退差價'}：
                        <span className="font-medium text-gold-600">
                          NT$ {Math.abs(e.priceDifference).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  )}
                </Link>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-14 bg-white rounded-2xl border border-cream-200">
      <Inbox size={40} className="mx-auto text-cream-200 mb-3" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
