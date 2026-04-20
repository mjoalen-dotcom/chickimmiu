'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'

export type OrderLineLite = {
  productId: string
  productName: string
  variant: string
  sku: string
  quantity: number
  unitPrice: number
}

type RowState = {
  selected: boolean
  qty: number
  newVariant: string
  reason: string
}

const REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wrong_size', label: '尺寸不合' },
  { value: 'color_mismatch', label: '顏色不符' },
  { value: 'defective', label: '商品瑕疵' },
  { value: 'other', label: '其他' },
]

export function ExchangeForm({
  orderId,
  orderNumber,
  items,
}: {
  orderId: string
  orderNumber: string
  items: OrderLineLite[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<RowState[]>(() =>
    items.map(() => ({ selected: false, qty: 1, newVariant: '', reason: '' })),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows],
  )

  function update(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = rows
      .map((row, idx) => ({ row, item: items[idx] }))
      .filter(({ row }) => row.selected)
      .map(({ row, item }) => ({
        product: item.productId,
        originalVariant: item.variant,
        newVariant: row.newVariant.trim(),
        quantity: row.qty,
        reason: row.reason,
      }))

    if (payload.length === 0) {
      setError('請勾選至少一項要換貨的商品')
      return
    }
    for (const it of payload) {
      if (!it.originalVariant) {
        setError('此訂單商品缺少款式資訊，無法申請換貨。請聯繫客服協助。')
        return
      }
      if (!it.newVariant) {
        setError('請填寫想換成的款式')
        return
      }
      if (it.newVariant === it.originalVariant) {
        setError('新款式與原款式相同，請確認')
        return
      }
      if (!it.reason) {
        setError('請為每項換貨商品選擇原因')
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, items: payload }),
      })
      const body = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            exchangeId?: string | number
            error?: string
            message?: string
          }
        | null
      if (!res.ok || !body?.ok) {
        setError(body?.message || body?.error || `送出失敗（HTTP ${res.status}）`)
        setSubmitting(false)
        return
      }
      router.push(`/account/exchanges/${body.exchangeId}`)
    } catch (err) {
      console.error('[ExchangeForm] submit failed:', err)
      setError('網路錯誤，請稍後重試')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl border border-cream-200 p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-gold-500" />
          勾選要換貨的商品
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          訂單 <span className="font-mono">{orderNumber}</span> 共 {items.length} 項商品；請勾選要換貨的品項、填寫想換成的款式（例如「白色 / M」）及原因。
        </p>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">此訂單目前沒有可換貨的商品。</p>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => {
              const row = rows[idx]
              return (
                <div
                  key={`${item.productId}-${item.variant}-${idx}`}
                  className={`rounded-xl border p-4 transition-colors ${
                    row.selected
                      ? 'border-gold-400 bg-cream-50'
                      : 'border-cream-200 bg-white'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-gold-500"
                      checked={row.selected}
                      onChange={(e) => update(idx, { selected: e.target.checked })}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.productName}</p>
                      {item.variant ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          原款式：{item.variant}
                        </p>
                      ) : (
                        <p className="text-[11px] text-rose-500 mt-0.5">
                          （此商品無款式資訊，無法換貨）
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        NT$ {item.unitPrice.toLocaleString()} × 原購 {item.quantity} 件
                      </p>
                    </div>
                  </label>

                  {row.selected && item.variant && (
                    <div className="mt-4 space-y-3 pl-7">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-xs text-muted-foreground">
                          換貨數量
                        </label>
                        <select
                          className="text-sm border border-cream-200 rounded-lg px-3 py-1.5 bg-white"
                          value={row.qty}
                          onChange={(e) => update(idx, { qty: Number(e.target.value) })}
                        >
                          {Array.from({ length: item.quantity }, (_, i) => i + 1).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          想換成款式 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 bg-white"
                          placeholder={`例如：${item.variant.replace(/\w+$/, 'M') || '黑色 / M'}`}
                          maxLength={200}
                          value={row.newVariant}
                          onChange={(e) =>
                            update(idx, { newVariant: e.target.value })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          庫存實際狀況以客服確認為準。
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          換貨原因 <span className="text-rose-500">*</span>
                        </label>
                        <select
                          className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 bg-white"
                          value={row.reason}
                          onChange={(e) => update(idx, { reason: e.target.value })}
                        >
                          <option value="">請選擇…</option>
                          {REASON_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-muted-foreground">
          已勾選 {selectedCount} 項商品
        </p>
        <button
          type="submit"
          disabled={submitting || selectedCount === 0}
          className="px-6 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '送出中…' : '送出換貨申請'}
        </button>
      </div>
    </form>
  )
}
