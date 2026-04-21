'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle } from 'lucide-react'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function ContactForm() {
  const [state, setState] = useState<FormState>('idle')
  const [error, setError] = useState<string>('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'general',
    message: '',
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('請填寫姓名、信箱與訊息內容')
      setState('error')
      return
    }
    setState('submitting')
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      setState('success')
      setForm({ name: '', email: '', phone: '', subject: 'general', message: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '送出失敗，請稍後再試')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-8">
        <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-4" />
        <div className="text-base font-medium text-foreground mb-2">訊息已送出</div>
        <p className="text-sm text-foreground/60 leading-relaxed">
          感謝您的來信，客服將於 1-2 個工作日內與您聯繫。
        </p>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="mt-6 text-xs text-gold-600 hover:text-gold-700 underline underline-offset-4"
        >
          再送一封訊息
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-foreground/60 mb-1.5">
            姓名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-foreground/15 rounded-md focus:outline-none focus:border-gold-500 transition-colors bg-white disabled:bg-gray-50"
            placeholder="您的名字"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground/60 mb-1.5">
            電子信箱 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-foreground/15 rounded-md focus:outline-none focus:border-gold-500 transition-colors bg-white disabled:bg-gray-50"
            placeholder="name@example.com"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-foreground/60 mb-1.5">電話（選填）</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-foreground/15 rounded-md focus:outline-none focus:border-gold-500 transition-colors bg-white disabled:bg-gray-50"
            placeholder="0912-xxx-xxx"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground/60 mb-1.5">問題類別</label>
          <select
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-foreground/15 rounded-md focus:outline-none focus:border-gold-500 transition-colors bg-white disabled:bg-gray-50"
          >
            <option value="general">一般諮詢</option>
            <option value="order">訂單相關</option>
            <option value="shipping">物流 / 配送</option>
            <option value="return">退換貨</option>
            <option value="product">商品諮詢</option>
            <option value="partnership">合作邀約</option>
            <option value="other">其他</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-foreground/60 mb-1.5">
          訊息內容 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
          disabled={state === 'submitting'}
          rows={5}
          className="w-full px-3 py-2 text-sm border border-foreground/15 rounded-md focus:outline-none focus:border-gold-500 transition-colors bg-white disabled:bg-gray-50 resize-none"
          placeholder="請詳細描述您的問題或需求"
        />
      </div>

      {state === 'error' && error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-md border border-red-100">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 text-white rounded-md text-sm tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'submitting' ? '送出中…' : '送出訊息'}
        {state !== 'submitting' && <Send size={14} />}
      </button>

      <p className="text-xs text-foreground/40 leading-relaxed">
        我們會妥善處理您的個人資料，僅用於客服回覆用途，詳見
        <a href="/privacy-policy" className="underline underline-offset-2 hover:text-gold-600 mx-1">
          隱私權政策
        </a>
        。
      </p>
    </form>
  )
}
