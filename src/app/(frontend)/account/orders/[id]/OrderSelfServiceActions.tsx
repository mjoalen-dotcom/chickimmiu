'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, MapPin, XCircle } from 'lucide-react'

import type { SelfServiceEligibility } from '@/lib/commerce/orderSelfService'

type AddressForm = {
  recipientName: string
  phone: string
  zipCode: string
  city: string
  district: string
  address: string
}

type Props = {
  orderId: string
  eligibility: SelfServiceEligibility
  initialAddress: AddressForm
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '已到期'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m} 分 ${String(s).padStart(2, '0')} 秒`
}

export function OrderSelfServiceActions({ orderId, eligibility, initialAddress }: Props) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const [editingAddress, setEditingAddress] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [submitting, setSubmitting] = useState<'cancel' | 'edit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AddressForm>(initialAddress)

  const expiresAtMs = eligibility.expiresAt ? new Date(eligibility.expiresAt).getTime() : null
  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : null
  const expired = remainingMs !== null && remainingMs <= 0

  useEffect(() => {
    if (!expiresAtMs) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [expiresAtMs])

  const showsAnyAction = eligibility.canCancel || eligibility.canEditAddress
  if (!showsAnyAction && !eligibility.reason) return null

  async function handleCancel() {
    setSubmitting('cancel')
    setError(null)
    try {
      const res = await fetch(`/api/account/orders/${orderId}/cancel`, { method: 'POST' })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        setError(data?.message ?? '取消失敗，請稍後再試')
        setSubmitting(null)
        return
      }
      router.refresh()
    } catch {
      setError('取消失敗，請檢查網路連線')
      setSubmitting(null)
    }
  }

  async function handleSaveAddress() {
    setSubmitting('edit')
    setError(null)
    try {
      const res = await fetch(`/api/account/orders/${orderId}/edit-address`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        setError(data?.message ?? '修改地址失敗，請稍後再試')
        setSubmitting(null)
        return
      }
      setEditingAddress(false)
      router.refresh()
    } catch {
      setError('修改地址失敗，請檢查網路連線')
      setSubmitting(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-medium mb-1">需要更改訂單嗎？</h3>
          <p className="text-xs text-muted-foreground">
            下單後 30 分鐘內，且訂單尚未開始處理時可自助取消或修改寄送地址。
          </p>
          {remainingMs !== null && !expired && showsAnyAction && (
            <p className="text-xs text-gold-600 mt-1.5 inline-flex items-center gap-1">
              <Clock size={12} />
              剩餘時間：{formatRemaining(remainingMs)}
            </p>
          )}
          {eligibility.reason && (
            <p className="text-xs text-muted-foreground mt-1.5">{eligibility.reason}</p>
          )}
        </div>
        {showsAnyAction && !expired && (
          <div className="flex items-center gap-2 flex-wrap">
            {eligibility.canEditAddress && (
              <button
                type="button"
                onClick={() => {
                  setEditingAddress((v) => !v)
                  setError(null)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-cream-200 text-sm hover:border-gold-400 hover:text-gold-600 transition-colors"
              >
                <MapPin size={14} />
                {editingAddress ? '取消編輯' : '修改寄送地址'}
              </button>
            )}
            {eligibility.canCancel && (
              <button
                type="button"
                onClick={() => {
                  setConfirmingCancel(true)
                  setError(null)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm hover:bg-rose-50 transition-colors"
              >
                <XCircle size={14} />
                取消訂單
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {confirmingCancel && (
        <div className="mt-4 pt-4 border-t border-cream-200 space-y-3">
          <p className="text-sm">
            確定要取消這筆訂單嗎？已扣抵的點數 / 購物金 / 圖鑑卡會自動退還，已付款訂單會在客服確認後辦理退款。
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm hover:bg-rose-600 transition-colors disabled:opacity-60"
            >
              {submitting === 'cancel' ? '取消中…' : '確認取消訂單'}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => setConfirmingCancel(false)}
              className="px-4 py-2 rounded-xl border border-cream-200 text-sm hover:bg-cream-50 transition-colors"
            >
              暫不取消
            </button>
          </div>
        </div>
      )}

      {editingAddress && eligibility.canEditAddress && (
        <div className="mt-4 pt-4 border-t border-cream-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ssa-recipient" className="text-xs text-muted-foreground">
                收件人姓名 *
              </label>
              <input
                id="ssa-recipient"
                name="recipientName"
                type="text"
                autoComplete="name"
                value={form.recipientName}
                onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
            <div>
              <label htmlFor="ssa-phone" className="text-xs text-muted-foreground">
                聯絡電話 *
              </label>
              <input
                id="ssa-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
            <div>
              <label htmlFor="ssa-zip" className="text-xs text-muted-foreground">
                郵遞區號
              </label>
              <input
                id="ssa-zip"
                name="zipCode"
                type="text"
                autoComplete="postal-code"
                value={form.zipCode}
                onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
            <div>
              <label htmlFor="ssa-city" className="text-xs text-muted-foreground">
                縣市 *
              </label>
              <input
                id="ssa-city"
                name="city"
                type="text"
                autoComplete="address-level1"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
            <div>
              <label htmlFor="ssa-district" className="text-xs text-muted-foreground">
                鄉鎮區
              </label>
              <input
                id="ssa-district"
                name="district"
                type="text"
                autoComplete="address-level2"
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="ssa-address" className="text-xs text-muted-foreground">
                詳細地址 *
              </label>
              <input
                id="ssa-address"
                name="address"
                type="text"
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={handleSaveAddress}
              className="px-4 py-2 rounded-xl bg-gold-500 text-white text-sm hover:bg-gold-600 transition-colors disabled:opacity-60"
            >
              {submitting === 'edit' ? '儲存中…' : '儲存地址'}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => setEditingAddress(false)}
              className="px-4 py-2 rounded-xl border border-cream-200 text-sm hover:bg-cream-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
