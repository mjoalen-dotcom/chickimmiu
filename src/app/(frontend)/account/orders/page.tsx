import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import OrdersClient, { type OrderLite, type OrderItemLite } from './OrdersClient'

export const metadata: Metadata = {
  title: '我的訂單',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

function formatDate(raw: unknown): string {
  if (!raw) return ''
  try {
    const d = new Date(raw as string)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

export default async function OrdersPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/orders')

  const result = await payload.find({
    collection: 'orders',
    where: { customer: { equals: sessionUser.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
  })

  const orders: OrderLite[] = (result.docs as unknown as LooseRecord[]).map((o) => {
    const rawItems = (o.items as LooseRecord[] | null | undefined) ?? []
    const items: OrderItemLite[] = rawItems.map((it) => ({
      name: (it.productName as string) ?? '—',
      variant: (it.variant as string) ?? '',
      quantity: (it.quantity as number) ?? 0,
      price: (it.subtotal as number) ?? (it.unitPrice as number) ?? 0,
    }))
    return {
      id: String(o.id),
      orderNumber: (o.orderNumber as string) ?? '—',
      date: formatDate(o.createdAt),
      status: (o.status as string) ?? 'pending',
      paymentStatus: (o.paymentStatus as string) ?? 'unpaid',
      total: (o.total as number) ?? 0,
      items,
    }
  })

  return <OrdersClient orders={orders} />
}
