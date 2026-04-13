'use client'

import { DollarSign, Users, ShoppingBag, TrendingUp, Link2, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

// Demo data — in production, fetch from Payload Affiliates + Orders
const STATS = {
  totalEarnings: 12580,
  pendingAmount: 3200,
  withdrawableAmount: 9380,
  totalWithdrawn: 5000,
  totalReferrals: 45,
  totalOrders: 23,
  conversionRate: 51.1,
  referralCode: 'PARTNER-ALICE',
}

const RECENT_ORDERS = [
  { orderNumber: 'CKM-20241220-A1B2', date: '2024-12-20', total: 2580, commission: 258 },
  { orderNumber: 'CKM-20241218-C3D4', date: '2024-12-18', total: 980, commission: 98 },
  { orderNumber: 'CKM-20241215-E5F6', date: '2024-12-15', total: 3680, commission: 368 },
]

export default function PartnerDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: '累計收益', value: `NT$ ${STATS.totalEarnings.toLocaleString()}`, color: 'text-green-600' },
          { icon: TrendingUp, label: '待確認', value: `NT$ ${STATS.pendingAmount.toLocaleString()}`, color: 'text-amber-500' },
          { icon: Users, label: '推薦人數', value: STATS.totalReferrals.toString(), color: 'text-blue-600' },
          { icon: ShoppingBag, label: '成交訂單', value: STATS.totalOrders.toString(), color: 'text-purple-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-cream-200">
            <stat.icon size={18} className={`${stat.color} mb-3`} />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-medium mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-gold-500/10 to-cream-100 rounded-2xl border border-gold-500/20 p-5">
          <h3 className="font-medium text-sm mb-2">可提領金額</h3>
          <p className="text-2xl font-medium text-gold-600 mb-3">
            NT$ {STATS.withdrawableAmount.toLocaleString()}
          </p>
          <Link
            href="/partner/withdraw"
            className="inline-flex items-center gap-1 text-xs text-gold-600 hover:underline"
          >
            申請提款 <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-cream-100 rounded-2xl border border-blue-500/20 p-5">
          <h3 className="font-medium text-sm mb-2">推廣連結</h3>
          <p className="text-sm font-mono text-blue-600 mb-3 break-all">
            ?ref={STATS.referralCode}
          </p>
          <Link
            href="/partner/referrals"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            生成連結 <Link2 size={12} />
          </Link>
        </div>
      </div>

      {/* Recent referral orders */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">最近推薦訂單</h3>
          <Link href="/partner/earnings" className="text-xs text-gold-600 hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="space-y-3">
          {RECENT_ORDERS.map((order) => (
            <div key={order.orderNumber} className="flex items-center justify-between py-3 border-b border-cream-100 last:border-0">
              <div>
                <p className="text-sm font-mono">{order.orderNumber}</p>
                <p className="text-[10px] text-muted-foreground">{order.date}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">NT$ {order.total.toLocaleString()}</p>
                <p className="text-[10px] text-green-600">佣金 NT$ {order.commission.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
