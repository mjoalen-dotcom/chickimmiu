import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DollarSign, TrendingUp, Wallet, ShoppingBag, Link2, ArrowUpRight } from 'lucide-react'
import { getOwnAffiliate } from '@/lib/affiliate/getOwnAffiliate'
import type { Order } from '@/payload-types'

export default async function PartnerDashboard() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  // layout.tsx 已擋過一次，這裡 user 必為登入狀態；型別上仍需防禦
  if (!user) return null

  const affiliate = await getOwnAffiliate(payload, user.id)

  if (!affiliate) {
    return (
      <div className="bg-white rounded-2xl border border-cream-200 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          您的帳號尚未建立合作夥伴分潤資料，請聯繫客服協助設定推薦碼與佣金比例。
        </p>
      </div>
    )
  }

  const ordersResult = await payload.find({
    collection: 'orders',
    where: { 'affiliateInfo.affiliateUser': { equals: user.id } },
    sort: '-createdAt',
    limit: 5,
    depth: 0,
  })
  const recentOrders = ordersResult.docs as unknown as Order[]

  const stats = [
    { icon: DollarSign, label: '累計收益', value: `NT$ ${(affiliate.totalEarnings || 0).toLocaleString()}`, color: 'text-green-600' },
    { icon: TrendingUp, label: '待確認', value: `NT$ ${(affiliate.pendingAmount || 0).toLocaleString()}`, color: 'text-amber-500' },
    { icon: Wallet, label: '已提領', value: `NT$ ${(affiliate.totalWithdrawn || 0).toLocaleString()}`, color: 'text-blue-600' },
    { icon: ShoppingBag, label: '成交訂單', value: String(ordersResult.totalDocs), color: 'text-purple-600' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
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
            NT$ {(affiliate.withdrawableAmount || 0).toLocaleString()}
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
            ?ref={affiliate.referralCode}
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
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">尚無推薦訂單</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-3 border-b border-cream-100 last:border-0">
                <div>
                  <p className="text-sm font-mono">{order.orderNumber}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString('zh-TW')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">NT$ {(order.total || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-green-600">
                    佣金 NT$ {(order.affiliateInfo?.commissionAmount || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
