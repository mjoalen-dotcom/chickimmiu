'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package, ChevronRight, Eye, Truck, CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react'

export type OrderItemLite = {
  name: string
  variant: string
  quantity: number
  price: number
}

export type OrderLite = {
  id: string
  orderNumber: string
  date: string
  status: string
  paymentStatus: string
  total: number
  items: OrderItemLite[]
}

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: '待處理', icon: Clock, color: 'text-amber-500' },
  processing: { label: '處理中', icon: Package, color: 'text-blue-500' },
  shipped: { label: '已出貨', icon: Truck, color: 'text-indigo-500' },
  delivered: { label: '已送達', icon: CheckCircle, color: 'text-green-500' },
  cancelled: { label: '已取消', icon: XCircle, color: 'text-red-500' },
  refunded: { label: '已退款', icon: RotateCcw, color: 'text-gray-500' },
}

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunding: '退款中',
  refunded: '已退款',
}

export default function OrdersClient({ orders }: { orders: OrderLite[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">我的訂單</h2>
        <span className="text-xs text-muted-foreground">{orders.length} 筆訂單</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-cream-200">
          <Package size={48} className="mx-auto text-cream-200 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">目前還沒有訂單</p>
          <Link href="/products" className="text-sm text-gold-600 hover:underline">
            去逛逛 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = STATUS_MAP[order.status] || STATUS_MAP.pending
            const isExpanded = expandedId === order.id
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-cream-200 overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-cream-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center ${status.color}`}>
                      <status.icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium font-mono">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">NT$ {order.total.toLocaleString()}</p>
                      <p className={`text-xs ${status.color}`}>{status.label}</p>
                    </div>
                    <ChevronRight
                      size={16}
                      className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>
                </button>

                {/* Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-cream-200">
                    <div className="pt-4 space-y-3">
                      {order.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">本訂單無明細資料</p>
                      ) : (
                        order.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.variant ? `${item.variant} × ${item.quantity}` : `× ${item.quantity}`}
                              </p>
                            </div>
                            <p>NT$ {item.price.toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-cream-100">
                      <span className="text-xs text-muted-foreground">
                        付款狀態：{PAYMENT_LABEL[order.paymentStatus] ?? '未知'}
                      </span>
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="flex items-center gap-1 text-xs text-gold-600 hover:underline"
                      >
                        <Eye size={12} />
                        查看詳情
                      </Link>
                    </div>
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
