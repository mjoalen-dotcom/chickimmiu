import Link from 'next/link'
import { CheckCircle, Package, ArrowRight, Home } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ThankYouRecommendations } from '@/components/recommendation/ThankYouRecommendations'

type LooseRecord = Record<string, unknown>

const STATUS_LABEL: Record<string, string> = {
  pending: '待處理',
  processing: '處理中',
  shipped: '已出貨',
  delivered: '已送達',
  returned: '已退回',
  cancelled: '已取消',
  refunded: '已退款',
}

const PAYMENT_STATUS_CONF: Record<string, { label: string; className: string }> = {
  unpaid:       { label: '待付款',   className: 'text-amber-600' },
  paid:         { label: '已付款',   className: 'text-green-600' },
  partial_paid: { label: '部分付款', className: 'text-amber-600' },
  refunded:     { label: '已退款',   className: 'text-muted-foreground' },
  failed:       { label: '付款失敗', className: 'text-red-600' },
}

const PAYMENT_HINT: Record<string, string> = {
  cash_cod:    '貨到付款 — 請備妥現金，由配送員收款後完成付款確認。',
  cash_meetup: '面交付款 — 請至指定取貨地點現場付款。',
}

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  let orderStatus = 'pending'
  let paymentStatus = 'unpaid'
  let paymentMethod = ''
  let found = false
  // 訪客訂單沒有可用的會員中心（臨時帳號 + 2 小時 session）→ 導到訂單查詢頁
  let isGuestOrder = false

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'orders',
        where: { orderNumber: { equals: orderId } },
        limit: 1,
        depth: 0,
      })
      const order = ((result.docs[0] as unknown as LooseRecord) ?? null) as LooseRecord | null
      if (order) {
        found = true
        orderStatus = (order.status as string) ?? 'pending'
        paymentStatus = (order.paymentStatus as string) ?? 'unpaid'
        paymentMethod = (order.paymentMethod as string) ?? ''
        isGuestOrder = Boolean(order.guestEmail)
      }
    } catch {
      // fallback to pending/unpaid defaults
    }
  }

  const statusLabel = STATUS_LABEL[orderStatus] ?? orderStatus
  const pmConf = PAYMENT_STATUS_CONF[paymentStatus] ?? { label: paymentStatus, className: 'text-foreground' }
  const hint = PAYMENT_HINT[paymentMethod]

  return (
    <main className="bg-cream-50 min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle size={40} className="text-green-500" />
        </div>

        <h1 className="text-2xl md:text-3xl font-serif mb-3">感謝您的訂購！</h1>
        <p className="text-muted-foreground text-sm mb-2">
          我們已收到您的訂單，將儘快為您處理。
        </p>

        <div className="bg-white rounded-2xl border border-cream-200 p-6 mt-8 mb-8 space-y-4 text-left">
          <div className="flex items-center gap-3 pb-4 border-b border-cream-200">
            <Package size={20} className="text-gold-500" />
            <div>
              <p className="text-xs text-muted-foreground">訂單編號</p>
              <p className="text-sm font-medium font-mono">{orderId}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">訂單狀態</span>
              <span className="text-gold-600">{statusLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">付款狀態</span>
              <span className={pmConf.className}>{pmConf.label}</span>
            </div>
          </div>

          {hint && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {hint}
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t border-cream-200 pt-2">
            {isGuestOrder
              ? '訂單確認信已寄至您填寫的信箱。您可以用「訂單編號 + 聯絡信箱」隨時查詢訂單進度。'
              : found
                ? '訂單確認信已寄至您的信箱，您也可以在「我的帳戶」中查看訂單進度。'
                : '請至「我的帳戶 → 我的訂單」查看訂單進度。'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={isGuestOrder ? `/order-lookup?order=${encodeURIComponent(orderId)}` : '/account/orders'}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            查看訂單
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-foreground/20 text-foreground rounded-full text-sm tracking-wide hover:bg-foreground/5 transition-colors"
          >
            <Home size={16} />
            回首頁
          </Link>
        </div>

        <ThankYouRecommendations />
      </div>
    </main>
  )
}
