import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'

type LooseRecord = Record<string, unknown>

const RETURN_REASON_LABEL: Record<string, string> = {
  defective: '商品瑕疵',
  wrong_size: '尺寸不合',
  color_mismatch: '顏色與圖片不符',
  wrong_item: '收到錯誤商品',
  not_wanted: '不喜歡 / 不需要',
  other: '其他',
}

const REFUND_METHOD_LABEL: Record<string, string> = {
  original: '原路退回',
  credit: '購物金',
  bank_transfer: '銀行轉帳',
}

// Ordered timeline for return status.
// pending → approved → returning → received → refunded (happy path)
// rejected / cancelled are terminal branches.
const TIMELINE_STEPS: Array<{
  key: string
  label: string
  icon: React.ElementType
}> = [
  { key: 'pending', label: '待審核', icon: Clock },
  { key: 'approved', label: '已核准', icon: CheckCircle },
  { key: 'returning', label: '退貨中', icon: Truck },
  { key: 'received', label: '已收到退貨', icon: Package },
  { key: 'refunded', label: '已退款', icon: CheckCircle },
]

function statusReachedIndex(status: string): number {
  // For terminal-failure statuses, only the first step is reached.
  if (status === 'rejected' || status === 'cancelled') return 0
  const idx = TIMELINE_STEPS.findIndex((s) => s.key === status)
  return idx === -1 ? 0 : idx
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

export const dynamic = 'force-dynamic'

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect(`/login?redirect=/account/returns/${id}`)

  let record: LooseRecord
  try {
    record = (await payload.findByID({
      collection: 'returns',
      id,
      depth: 2,
      overrideAccess: true,
    })) as unknown as LooseRecord
  } catch {
    notFound()
  }

  // IDOR
  const rawCustomer = record.customer
  const customerId =
    typeof rawCustomer === 'string' || typeof rawCustomer === 'number'
      ? rawCustomer
      : ((rawCustomer as LooseRecord | null)?.id as string | number | undefined)
  if (String(customerId ?? '') !== String(user.id)) notFound()

  const returnNumber = String(record.returnNumber ?? '')
  const status = String(record.status ?? 'pending')
  const order = record.order as LooseRecord | null | undefined
  const orderNumber = String(order?.orderNumber ?? '')
  const orderId = order?.id as string | number | undefined

  const reachedIdx = statusReachedIndex(status)
  const isRejected = status === 'rejected'
  const isCancelled = status === 'cancelled'

  const items = ((record.items as Array<LooseRecord> | undefined) ?? []).map(
    (it) => {
      const product = it.product as LooseRecord | null | undefined
      return {
        productName: String(product?.name ?? it.productName ?? '商品'),
        variant: (it.variant as string | undefined) ?? '',
        quantity: (it.quantity as number) ?? 0,
        reasonLabel:
          RETURN_REASON_LABEL[String(it.reason ?? '')] ?? String(it.reason ?? '—'),
        reasonDetail: (it.reasonDetail as string | undefined) ?? '',
      }
    },
  )

  const refundAmount = record.refundAmount as number | undefined
  const refundMethod = record.refundMethod as string | undefined
  const adminNote = record.adminNote as string | undefined
  const trackingNumber = record.trackingNumber as string | undefined

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link
          href="/account/returns"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          返回退換貨列表
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-serif">退貨詳情</h2>
          <span className="text-xs text-muted-foreground font-mono">
            {returnNumber || '—'}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        {isRejected ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-rose-600">申請未通過</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                申請時間：{formatDateTime(record.createdAt)}
              </p>
            </div>
          </div>
        ) : isCancelled ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
              <XCircle size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">已取消</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                申請時間：{formatDateTime(record.createdAt)}
              </p>
            </div>
          </div>
        ) : (
          <ol className="flex items-start justify-between gap-1">
            {TIMELINE_STEPS.map((step, i) => {
              const done = i <= reachedIdx
              const Icon = step.icon
              return (
                <li key={step.key} className="flex-1 flex flex-col items-center">
                  <div className="flex items-center w-full">
                    <div
                      className={`h-0.5 flex-1 ${
                        i === 0 ? 'invisible' : done ? 'bg-gold-400' : 'bg-cream-200'
                      }`}
                    />
                    <div
                      className={`size-9 rounded-full flex items-center justify-center shrink-0 ${
                        done
                          ? 'bg-gold-500 text-white'
                          : 'bg-cream-100 text-muted-foreground'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div
                      className={`h-0.5 flex-1 ${
                        i === TIMELINE_STEPS.length - 1
                          ? 'invisible'
                          : i < reachedIdx
                            ? 'bg-gold-400'
                            : 'bg-cream-200'
                      }`}
                    />
                  </div>
                  <p
                    className={`text-[11px] mt-2 ${done ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {step.label}
                  </p>
                </li>
              )
            })}
          </ol>
        )}
        <div className="mt-4 pt-4 border-t border-cream-200 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
          <span>申請時間：{formatDateTime(record.createdAt)}</span>
          <span>
            原始訂單：
            {orderId ? (
              <Link
                href={`/account/orders/${orderId}`}
                className="text-gold-600 hover:underline font-mono"
              >
                {orderNumber}
              </Link>
            ) : (
              <span className="font-mono">{orderNumber || '—'}</span>
            )}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <RotateCcw size={16} className="text-gold-500" />
          退貨商品（{items.length} 項）
        </h3>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">（無商品）</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="pb-3 border-b border-cream-100 last:border-b-0 last:pb-0"
              >
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.variant ? `${item.variant}・` : ''}x{item.quantity}・
                  原因：{item.reasonLabel}
                </p>
                {item.reasonDetail && (
                  <p className="text-xs text-muted-foreground mt-1 bg-cream-50 rounded-lg px-3 py-2">
                    {item.reasonDetail}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refund info */}
      {(refundAmount != null && refundAmount > 0) || refundMethod ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-5">
          <h3 className="text-sm font-medium mb-4">退款資訊</h3>
          <div className="space-y-2 text-sm">
            {refundAmount != null && refundAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">退款金額</span>
                <span className="font-medium text-gold-600">
                  NT$ {refundAmount.toLocaleString()}
                </span>
              </div>
            )}
            {refundMethod && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">退款方式</span>
                <span>{REFUND_METHOD_LABEL[refundMethod] ?? refundMethod}</span>
              </div>
            )}
            {trackingNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">退貨物流單號</span>
                <span className="font-mono text-xs">{trackingNumber}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Admin note */}
      {adminNote && (
        <div className="bg-white rounded-2xl border border-cream-200 p-5">
          <h3 className="text-sm font-medium mb-3">審核備註</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {adminNote}
          </p>
        </div>
      )}
    </div>
  )
}
