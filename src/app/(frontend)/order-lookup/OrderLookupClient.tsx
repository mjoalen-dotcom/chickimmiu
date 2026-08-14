'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Search, Package } from 'lucide-react'

/**
 * 訂單查詢頁（訪客用）
 * ------------------
 * 訪客結帳沒有帳號可以查單（臨時帳號用合成信箱、session 只有 2 小時），
 * 這裡用「訂單編號 + 聯絡信箱」查 —— 會員用註冊信箱一樣查得到。
 * 驗證與限流都在 `POST /api/orders/lookup`；查無資料與信箱不符回同一種訊息。
 */

type LookupItem = {
  productName?: string
  variant?: string
  quantity?: number
  unitPrice?: number
  subtotal?: number
  isGift?: boolean
}

type LookupResult = {
  orderNumber: string
  createdAt?: string
  status?: string
  paymentStatus?: string
  paymentMethod?: string
  items: LookupItem[]
  subtotal?: number
  discountAmount?: number
  shippingFee?: number
  codFee?: number
  total?: number
  shipping?: {
    methodName?: string
    carrier?: string
    trackingNumber?: string
    estimatedDays?: string
    storeName?: string
  }
  recipient?: {
    name?: string
    phone?: string
    city?: string
    district?: string
    address?: string
  }
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待處理',
  processing: '處理中',
  shipped: '已出貨',
  delivered: '已送達',
  returned: '已退回',
  cancelled: '已取消',
  refunded: '已退款',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: '待付款',
  paid: '已付款',
  partial_paid: '部分付款',
  refunded: '已退款',
  failed: '付款失敗',
}

const ntd = (n?: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export default function OrderLookupClient() {
  const search = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(search.get('order') ?? '')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LookupResult | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!orderNumber.trim() || !email.trim()) {
      setError('請填寫訂單編號與聯絡信箱')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), email: email.trim() }),
      })
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: LookupResult; error?: string }
        | null
      if (!res.ok || !body?.success || !body.data) {
        setError(body?.error || '查詢失敗，請稍後再試')
        return
      }
      setResult(body.data)
    } catch {
      setError('查詢失敗，請檢查網路連線後再試')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 border border-cream-200 rounded-lg text-base focus:outline-none focus:border-gold-500'

  return (
    <div className="container py-10 md:py-16 max-w-2xl">
      <h1 className="text-2xl font-light tracking-wide mb-2">訂單查詢</h1>
      <p className="text-sm text-muted-foreground mb-8">
        輸入訂單編號與下單時填寫的聯絡信箱即可查詢。已註冊會員也可以直接
        <Link href="/login?redirect=/account/orders" className="text-gold-600 underline underline-offset-2 mx-1">
          登入會員中心
        </Link>
        查看完整訂單紀錄。
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-cream-200 rounded-2xl p-6 space-y-4">
        <div>
          <label htmlFor="order-number" className="block text-sm font-medium mb-1">
            訂單編號 <span className="text-red-500">*</span>
          </label>
          <input
            id="order-number"
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="CKMU20260814001"
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="lookup-email" className="block text-sm font-medium mb-1">
            聯絡信箱 <span className="text-red-500">*</span>
          </label>
          <input
            id="lookup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search size={14} />
          {loading ? '查詢中…' : '查詢訂單'}
        </button>
        {error && (
          <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}
      </form>

      {result && (
        <div className="mt-8 bg-white border border-cream-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap border-b border-cream-200 pb-4 mb-4">
            <div>
              <div className="text-xs text-muted-foreground">訂單編號</div>
              <div className="text-lg tracking-wide">{result.orderNumber}</div>
              {result.createdAt && (
                <div className="text-xs text-muted-foreground mt-1">
                  下單時間 {new Date(result.createdAt).toLocaleString('zh-TW')}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm">{STATUS_LABEL[result.status ?? ''] ?? result.status}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {PAYMENT_STATUS_LABEL[result.paymentStatus ?? ''] ?? result.paymentStatus}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {result.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <div>
                    {item.productName}
                    {item.isGift && <span className="ml-2 text-xs text-gold-600">贈品</span>}
                  </div>
                  {item.variant && <div className="text-xs text-muted-foreground">{item.variant}</div>}
                  <div className="text-xs text-muted-foreground">數量 {item.quantity}</div>
                </div>
                <div className="whitespace-nowrap">{ntd(item.subtotal)}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-cream-200 mt-4 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">小計</span>
              <span>{ntd(result.subtotal)}</span>
            </div>
            {Boolean(result.discountAmount) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">折扣</span>
                <span>-{ntd(result.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">運費</span>
              <span>{ntd(result.shippingFee)}</span>
            </div>
            {Boolean(result.codFee) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">貨到付款手續費</span>
                <span>{ntd(result.codFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base pt-2 border-t border-cream-200 mt-2">
              <span>應付總額</span>
              <span>{ntd(result.total)}</span>
            </div>
          </div>

          {(result.shipping?.methodName || result.shipping?.trackingNumber) && (
            <div className="border-t border-cream-200 mt-4 pt-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Package size={14} className="text-gold-500" />
                <span>配送資訊</span>
              </div>
              {result.shipping?.methodName && (
                <div className="text-muted-foreground">{result.shipping.methodName}</div>
              )}
              {result.shipping?.storeName && (
                <div className="text-muted-foreground">取貨門市：{result.shipping.storeName}</div>
              )}
              {result.shipping?.trackingNumber && (
                <div className="mt-1">物流單號：{result.shipping.trackingNumber}</div>
              )}
              {result.recipient?.name && (
                <div className="text-muted-foreground mt-2">
                  {result.recipient.name}　{result.recipient.phone}
                  <br />
                  {result.recipient.city}
                  {result.recipient.district}
                  {result.recipient.address}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            訂單有問題嗎？請洽客服並提供訂單編號，我們會盡快協助。
          </p>
        </div>
      )}
    </div>
  )
}
