'use client'

import { useState, type FormEvent } from 'react'

const CATEGORIES = [
  { value: 'order_inquiry', label: '訂單查詢' },
  { value: 'shipping_status', label: '物流狀態' },
  { value: 'return_exchange', label: '退換貨' },
  { value: 'size_advice', label: '尺寸建議' },
  { value: 'product_recommendation', label: '商品推薦 / 合作' },
  { value: 'points_inquiry', label: '點數 / 會員' },
  { value: 'complaint', label: '客訴' },
  { value: 'other', label: '其他' },
] as const

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; ticketNumber?: string }
  | { status: 'error'; message: string }

export function ContactForm() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('order_inquiry')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [subscribe, setSubscribe] = useState(false)
  const [consent, setConsent] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!consent) {
      setState({ status: 'error', message: '請同意隱私權政策後再送出' })
      return
    }
    setState({ status: 'submitting' })

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, phone, category, subject, message, subscribe }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        ticketNumber?: string
        error?: string
      }

      if (!res.ok || !data.success) {
        setState({
          status: 'error',
          message: data.error || `提交失敗（${res.status}），請稍後再試`,
        })
        return
      }

      setState({ status: 'success', ticketNumber: data.ticketNumber })
      setName('')
      setEmail('')
      setPhone('')
      setCategory('order_inquiry')
      setSubject('')
      setMessage('')
      setSubscribe(false)
      setConsent(false)
    } catch {
      setState({ status: 'error', message: '網路連線失敗，請稍後再試' })
    }
  }

  if (state.status === 'success') {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[#2C2C2C] mb-2">訊息已送出</h3>
        <p className="text-sm text-[#2C2C2C]/70 leading-relaxed max-w-md mx-auto">
          感謝您的聯繫，我們將於 1-2 個工作天內以您留下的 Email 或電話回覆您。
        </p>
        {state.ticketNumber && (
          <p className="mt-4 text-xs text-[#2C2C2C]/50">
            工單編號：<span className="font-mono text-[#2C2C2C]">{state.ticketNumber}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => setState({ status: 'idle' })}
          className="mt-6 inline-block text-sm text-[#C19A5B] hover:underline"
        >
          再提一個問題
        </button>
      </div>
    )
  }

  const submitting = state.status === 'submitting'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="姓名" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            className={inputCls}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="電話（選填）">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
            autoComplete="tel"
            className={inputCls}
          />
        </Field>
        <Field label="主題分類" required>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="主題" required>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          maxLength={200}
          placeholder="例：訂單 #12345 尚未收到"
          className={inputCls}
        />
      </Field>

      <Field label="訊息內容" required>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          maxLength={5000}
          placeholder="請盡量詳述您的問題、訂單編號、商品款式或日期，以便我們更快為您處理。"
          className={`${inputCls} resize-y min-h-[140px]`}
        />
        <p className="text-xs text-[#2C2C2C]/40 mt-1 text-right">{message.length} / 5000</p>
      </Field>

      <div className="space-y-2.5 pt-1">
        <label className="flex items-start gap-2.5 text-sm text-[#2C2C2C]/70 cursor-pointer">
          <input
            type="checkbox"
            checked={subscribe}
            onChange={(e) => setSubscribe(e.target.checked)}
            className="mt-0.5 accent-[#C19A5B]"
          />
          <span>我願意訂閱 CHIC KIM & MIU 新品與優惠資訊（可隨時取消）</span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-[#2C2C2C]/70 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="mt-0.5 accent-[#C19A5B]"
          />
          <span>
            我已閱讀並同意
            <a href="/privacy-policy" className="text-[#C19A5B] underline underline-offset-2 mx-1">
              隱私權政策
            </a>
            <span className="text-red-500">*</span>
          </span>
        </label>
      </div>

      {state.status === 'error' && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 bg-[#C19A5B] hover:bg-[#A07A3B] disabled:bg-[#C19A5B]/50 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium tracking-wider transition-colors"
      >
        {submitting ? '送出中…' : '送出訊息'}
      </button>
    </form>
  )
}

const inputCls =
  'w-full px-4 py-2.5 rounded-lg bg-white border border-cream-200 text-sm text-[#2C2C2C] placeholder:text-[#2C2C2C]/40 focus:outline-none focus:ring-2 focus:ring-[#C19A5B]/40 focus:border-[#C19A5B]/50 transition'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}
