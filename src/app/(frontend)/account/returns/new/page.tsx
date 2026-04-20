import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ReturnForm, type OrderLineLite } from './ReturnForm'

type LooseRecord = Record<string, unknown>

export const dynamic = 'force-dynamic'

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>
}) {
  const { orderId } = await searchParams
  if (!orderId) notFound()

  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect(`/login?redirect=/account/returns/new?orderId=${orderId}`)

  let order: LooseRecord
  try {
    order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 1,
      overrideAccess: true,
    })) as unknown as LooseRecord
  } catch {
    notFound()
  }

  // IDOR guard
  const rawCustomer = order.customer
  const customerId =
    typeof rawCustomer === 'string' || typeof rawCustomer === 'number'
      ? rawCustomer
      : ((rawCustomer as LooseRecord | null)?.id as string | number | undefined)
  if (String(customerId ?? '') !== String(user.id)) notFound()

  const status = String(order.status ?? '')
  const eligible = status === 'shipped' || status === 'delivered'

  const orderNumber = String(order.orderNumber ?? '')
  const items: OrderLineLite[] = (
    (order.items as Array<LooseRecord> | undefined) ?? []
  )
    .filter((it) => !it.isGift) // 贈品不可退
    .map((it) => {
      const product = it.product as LooseRecord | null | undefined
      return {
        productId:
          typeof product === 'object' && product !== null
            ? String(product.id ?? '')
            : String(it.product ?? ''),
        productName: String(it.productName ?? product?.name ?? '商品'),
        variant: (it.variant as string | undefined) ?? '',
        sku: (it.sku as string | undefined) ?? '',
        quantity: (it.quantity as number) ?? 0,
        unitPrice: (it.unitPrice as number) ?? 0,
      }
    })

  return (
    <main className="space-y-6 animate-fade-in">
      <div>
        <Link
          href={`/account/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          返回訂單詳情
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-serif">申請退貨</h2>
          <span className="text-xs text-muted-foreground font-mono">
            {orderNumber}
          </span>
        </div>
      </div>

      {!eligible ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-6 text-sm text-muted-foreground">
          此訂單目前為「{status || '未知狀態'}」，僅已出貨或已送達的訂單可申請退貨。
        </div>
      ) : (
        <ReturnForm orderId={String(orderId)} orderNumber={orderNumber} items={items} />
      )}
    </main>
  )
}
