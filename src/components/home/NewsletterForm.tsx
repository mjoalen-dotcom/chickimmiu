'use client'

import { useState, type FormEvent } from 'react'

/**
 * 首頁 / 頁尾「訂閱最新消息」表單（client）
 * ───────────────────────────────────────
 * 取代原本的死按鈕（type="button" 無 onClick）。POST /api/newsletter/subscribe，
 * 顯示成功 / 重複訂閱 / 錯誤訊息。版面樣式與原 server 版維持一致。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface NewsletterFormProps {
  placeholder: string
  buttonText: string
  source?: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export function NewsletterForm({ placeholder, buttonText, source = 'homepage' }: NewsletterFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return

    const value = email.trim()
    if (!value || !EMAIL_RE.test(value)) {
      setStatus('error')
      setMessage('請輸入正確的 Email')
      return
    }

    setStatus('loading')
    setMessage('')
    try {
      const locale =
        typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: value, source, locale }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean
        alreadySubscribed?: boolean
        error?: string
      }

      if (res.ok && body?.success) {
        setStatus('success')
        setMessage(
          body.alreadySubscribed
            ? '您已在訂閱名單中，感謝您的支持！'
            : '訂閱成功！期待與您分享最新消息。',
        )
        setEmail('')
      } else {
        setStatus('error')
        setMessage(body?.error || '訂閱失敗，請稍後再試')
      }
    } catch {
      setStatus('error')
      setMessage('網路異常，請稍後再試')
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          disabled={status === 'loading'}
          className="flex-1 px-5 py-3 rounded-full border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-8 py-3 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-60"
        >
          {status === 'loading' ? '訂閱中…' : buttonText}
        </button>
      </form>
      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-sm ${status === 'success' ? 'text-green-600' : 'text-red-500'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
