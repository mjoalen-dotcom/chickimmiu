import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getOwnAffiliate } from '@/lib/affiliate/getOwnAffiliate'
import type { Order } from '@/payload-types'
import { EarningsClient } from './EarningsClient'

const STATUS_LABEL: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  paid: '已撥款',
  cancelled: '已取消',
}

export default async function EarningsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) return null

  const affiliate = await getOwnAffiliate(payload, user.id)
  if (!affiliate) {
    return (
      <div className="bg-white rounded-2xl border border-cream-200 p-8 text-center">
        <p className="text-sm text-muted-foreground">您的帳號尚未建立合作夥伴分潤資料。</p>
      </div>
    )
  }

  const ordersResult = await payload.find({
    collection: 'orders',
    where: { 'affiliateInfo.affiliateUser': { equals: user.id } },
    sort: '-createdAt',
    limit: 200,
    depth: 0,
  })
  const orders = ordersResult.docs as unknown as Order[]

  const records = orders.map((order) => ({
    date: new Date(order.createdAt).toLocaleDateString('zh-TW'),
    orderNumber: order.orderNumber,
    total: order.total || 0,
    rate: order.affiliateInfo?.commissionRate ?? affiliate.commissionRate,
    commission: order.affiliateInfo?.commissionAmount || 0,
    status: order.affiliateInfo?.commissionStatus || 'pending',
    statusLabel: STATUS_LABEL[order.affiliateInfo?.commissionStatus || 'pending'] || '待確認',
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">佣金明細</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '累計總收益', value: affiliate.totalEarnings || 0 },
          { label: '待確認', value: affiliate.pendingAmount || 0 },
          { label: '可提領', value: affiliate.withdrawableAmount || 0 },
          { label: '累計已提領', value: affiliate.totalWithdrawn || 0 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-cream-200">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-medium mt-1">NT$ {s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <EarningsClient records={records} />
    </div>
  )
}
