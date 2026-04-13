'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package, ChevronRight, Eye, Truck, CheckCircle, Clock, XCircle } from 'lucide-react'

// Demo data — in production, fetch from Payload API
const DEMO_ORDERS = [
  {
    id: '1',
    orderNumber: 'CKM-20241201-A1B2',
    date: '2024-12-01',
    status: 'delivered',
    paymentStatus: 'paid',
    total: 2580,
    items: [
      { name: '優雅蝴蝶結針織上衣', variant: '米白 / M', quantity: 1, price: 1280 },
      { name: '韓系高腰A字裙', variant: '黑色 / S', quantity: 1, price: 1300 },
    ],
  },
  {
    id: '2',
    orderNumber: 'CKM-20241215-C3D4',
    date: '2024-12-15',
    status: 'shipped',
    paymentStatus: 'paid',
    total: 980,
    items: [
      { name: '柔軟羊毛混紡圍巾', variant: '駝色', quantity: 1, price: 980 },
    ],
  },
  {
    id: '3',
    orderNumber: 'CKM-20241220-E5F6',
    date: '2024-12-20',
    status: 'pending',
    paymentStatus: 'unpaid',
    total: 1680,
    items: [
      { name: '法式小香風外套', variant: '粉色 / L', quantity: 1, price: 1680 },
    ],
  },
]

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: '待處理', icon: Clock, color: 'text-amber-500' },
  processing: { label: '處理中', icon: Package, color: 'text-blue-500' },
  shipped: { label: '已出貨', icon: Truck, color: 'text-indigo-500' },
  delivered: { label: '已送達', icon: CheckCircle, color: 'text-green-500' },
  cancelled: { label: '已取消', icon: XCircle, color: 'text-red-500' },
}

export default function OrdersPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">我的訂單</h2>
        <span className="text-xs text-muted-foreground">{DEMO_ORDERS.length} 筆訂單</span>
      </div>

      {DEMO_ORDERS.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-cream-200">
          <Package size={48} className="mx-auto text-cream-200 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">目前還沒有訂單</p>
          <Link href="/products" className="text-sm text-gold-600 hover:underline">
            去逛逛 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {DEMO_ORDERS.map((order) => {
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
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.variant} × {item.quantity}
                            </p>
                          </div>
                          <p>NT$ {item.price.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-cream-100">
                      <span className="text-xs text-muted-foreground">
                        付款狀態：{order.paymentStatus === 'paid' ? '已付款' : '未付款'}
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
