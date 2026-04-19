import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  MapPin,
  FileText,
  CreditCard,
} from 'lucide-react'

export const metadata: Metadata = {
  title: '訂單詳情',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: '待處理', icon: Clock, color: 'text-amber-500' },
  processing: { label: '處理中', icon: Package, color: 'text-blue-500' },
  shipped: { label: '已出貨', icon: Truck, color: 'text-indigo-500' },
  delivered: { label: '已送達', icon: CheckCircle, color: 'text-green-500' },
  cancelled: { label: '已取消', icon: XCircle, color: 'text-red-500' },
  refunded: { label: '已退款', icon: RotateCcw, color: 'text-gray-500' },
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  refunding: '退款中',
  refunded: '已退款',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  paypal: 'PayPal',
  ecpay: '綠界科技 ECPay',
  newebpay: '藍新支付',
  linepay: 'LINE Pay',
  cash_cod: '宅配貨到付款',
  cash_meetup: '到辦公室取貨付款',
}

function formatDateTime(raw: unknown): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw as string)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${hh}:${mm}`
  } catch {
    return '—'
  }
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect(`/login?redirect=/account/orders/${id}`)

  let orderDoc: LooseRecord
  try {
    orderDoc = (await payload.findByID({
      collection: 'orders',
      id,
      depth: 1,
    })) as unknown as LooseRecord
  } catch {
    notFound()
  }

  // Prevent IDOR — ensure the order belongs to the current user.
  const rawCustomer = orderDoc.customer
  const customerId =
    typeof rawCustomer === 'string'
      ? rawCustomer
      : (rawCustomer as LooseRecord | null)?.id
  if (String(customerId ?? '') !== String(sessionUser.id)) {
    notFound()
  }

  const status = (orderDoc.status as string) || 'pending'
  const statusMeta = STATUS_MAP[status] || STATUS_MAP.pending
  const paymentStatus = (orderDoc.paymentStatus as string) || 'unpaid'
  const paymentMethod = (orderDoc.paymentMethod as string) || ''

  const items = ((orderDoc.items as LooseRecord[] | null | undefined) ?? []).map(
    (it) => ({
      productName: (it.productName as string) ?? '—',
      variant: (it.variant as string) ?? '',
      sku: (it.sku as string) ?? '',
      quantity: (it.quantity as number) ?? 0,
      unitPrice: (it.unitPrice as number) ?? 0,
      subtotal: (it.subtotal as number) ?? 0,
    }),
  )

  const subtotal = (orderDoc.subtotal as number) ?? 0
  const shippingFee = (orderDoc.shippingFee as number) ?? 0
  const codFee = (orderDoc.codFee as number) ?? 0
  const discountAmount = (orderDoc.discountAmount as number) ?? 0
  const pointsUsed = (orderDoc.pointsUsed as number) ?? 0
  const creditUsed = (orderDoc.creditUsed as number) ?? 0
  const total = (orderDoc.total as number) ?? 0

  const shippingAddress = (orderDoc.shippingAddress as LooseRecord | null) ?? {}
  const shippingMethod = (orderDoc.shippingMethod as LooseRecord | null) ?? {}
  const convenienceStore =
    (shippingMethod.convenienceStore as LooseRecord | null) ?? null
  const customerNote = (orderDoc.customerNote as string) ?? ''
  const trackingNumber = (orderDoc.trackingNumber as string) ?? ''

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          返回訂單列表
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-serif">訂單詳情</h2>
          <span className="text-xs text-muted-foreground font-mono">
            {(orderDoc.orderNumber as string) || '—'}
          </span>
        </div>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full bg-cream-100 flex items-center justify-center ${statusMeta.color}`}
          >
            <statusMeta.icon size={22} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${statusMeta.color}`}>
              {statusMeta.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              建立時間：{formatDateTime(orderDoc.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">付款狀態</p>
            <p className="text-sm font-medium">
              {PAYMENT_STATUS_LABEL[paymentStatus] ?? '—'}
            </p>
          </div>
        </div>
        {trackingNumber && (
          <div className="mt-4 pt-4 border-t border-cream-200 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">追蹤編號</span>
            <span className="font-mono">{trackingNumber}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Package size={16} className="text-gold-500" />
          商品明細
        </h3>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">本訂單無明細資料</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={`${item.sku || item.productName}-${idx}`}
                className="flex items-start gap-3 pb-3 border-b border-cream-100 last:border-b-0 last:pb-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  {item.variant && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.variant}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    NT$ {item.unitPrice.toLocaleString()} × {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-medium whitespace-nowrap">
                  NT$ {item.subtotal.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shipping */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-gold-500" />
          配送資訊
        </h3>
        <div className="space-y-2 text-sm">
          {shippingMethod.methodName ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">配送方式</span>
              <span>{shippingMethod.methodName as string}</span>
            </div>
          ) : null}
          {(shippingMethod.estimatedDays as string) && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">預計送達</span>
              <span>{shippingMethod.estimatedDays as string}</span>
            </div>
          )}
          {convenienceStore?.storeName ? (
            <div className="pt-2 mt-2 border-t border-cream-100">
              <p className="text-xs text-muted-foreground mb-1">取貨門市</p>
              <p>
                {convenienceStore.storeName as string}
                {convenienceStore.storeId ? `（${convenienceStore.storeId}）` : ''}
              </p>
              {(convenienceStore.storeAddress as string) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {convenienceStore.storeAddress as string}
                </p>
              )}
            </div>
          ) : (
            <div className="pt-2 mt-2 border-t border-cream-100 space-y-1">
              <p className="text-xs text-muted-foreground mb-1">收件資訊</p>
              <p>{(shippingAddress.recipientName as string) || '—'}</p>
              <p className="text-xs text-muted-foreground">
                {(shippingAddress.phone as string) || ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  shippingAddress.zipCode,
                  shippingAddress.city,
                  shippingAddress.district,
                  shippingAddress.address,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payment summary */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <CreditCard size={16} className="text-gold-500" />
          付款明細
        </h3>
        <div className="space-y-2 text-sm">
          {paymentMethod && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">付款方式</span>
              <span>{PAYMENT_METHOD_LABEL[paymentMethod] ?? paymentMethod}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">商品小計</span>
            <span>NT$ {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">運費</span>
            <span>
              {shippingFee === 0 ? (
                <span className="text-green-600">免運費</span>
              ) : (
                `NT$ ${shippingFee.toLocaleString()}`
              )}
            </span>
          </div>
          {codFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">貨到付款手續費</span>
              <span>NT$ {codFee.toLocaleString()}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>折扣</span>
              <span>- NT$ {discountAmount.toLocaleString()}</span>
            </div>
          )}
          {pointsUsed > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>點數折抵</span>
              <span>- NT$ {pointsUsed.toLocaleString()}</span>
            </div>
          )}
          {creditUsed > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>購物金折抵</span>
              <span>- NT$ {creditUsed.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between pt-3 mt-2 border-t border-cream-200 text-base">
            <span className="font-medium">合計</span>
            <span className="font-medium text-gold-600">
              NT$ {total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Customer note */}
      {customerNote && (
        <div className="bg-white rounded-2xl border border-cream-200 p-5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <FileText size={16} className="text-gold-500" />
            訂單備註
          </h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {customerNote}
          </p>
        </div>
      )}
    </div>
  )
}
