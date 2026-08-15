import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getOwnAffiliate } from '@/lib/affiliate/getOwnAffiliate'
import type { Order, User } from '@/payload-types'
import { ReferralsClient } from './ReferralsClient'

function maskName(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.length >= 2) {
    return name[0] + '*'.repeat(Math.max(1, name.length - 2)) + name[name.length - 1]
  }
  if (name) return name + '**'
  if (email) {
    const local = email.split('@')[0]
    return local.length >= 2 ? local[0] + '*'.repeat(local.length - 1) : local + '**'
  }
  return '會員'
}

export default async function ReferralsPage() {
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
    limit: 20,
    depth: 1,
  })
  const orders = ordersResult.docs as unknown as Order[]

  const referralOrders = orders.map((order) => {
    const customer = order.customer as unknown as User | number
    const customerObj = typeof customer === 'object' ? customer : null
    return {
      orderNumber: order.orderNumber,
      date: new Date(order.createdAt).toLocaleDateString('zh-TW'),
      customer: maskName(customerObj?.name, customerObj?.email),
      total: order.total || 0,
      status: order.affiliateInfo?.commissionStatus === 'pending' ? 'pending' : 'confirmed',
    }
  })

  return (
    <ReferralsClient referralCode={affiliate.referralCode} referralOrders={referralOrders} />
  )
}
