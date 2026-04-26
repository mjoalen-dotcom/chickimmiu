'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

/**
 * 忘記密碼頁
 * ---------
 * POST `/api/users/forgot-password`（Payload 內建）
 * 成功不論 email 是否存在都回傳同樣訊息，避免 email enumeration。
 *
 * ⚠️ Prod 未設 email adapter — token 會 log 到 systemd journal，
 *    封測期客服可從 server log 撈 token 發給使用者。SMTP adapter 另案。
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      // Payload forgot-password 即使 email 不存在也回 200 以防枚舉；
      // 我們照樣顯示統一成功訊息即可
      if (!res.ok && res.status >= 500) {
        setError('伺服器錯誤，請稍後再試')
        return
      }
      setSubmitted(true)
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-cream-50">
      <div className="w-full max-w-md space-y-8 bg-white rounded-2xl p-8 border border-cream-200 shadow-sm animate-fade-in">
        <div className="text-center">
          <h1 className="text-2xl font-serif mb-2">忘記密碼</h1>
          <p className="text-sm text-muted-foreground">
            輸入註冊時的 email，我們會寄送重設密碼連結給你
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-800">
              若該 email 有註冊帳號，我們已寄出重設密碼連結，請於 1 小時內點擊完成重設。
            </div>
            <p className="text-xs text-muted-foreground">
              沒收到信？請檢查垃圾信匣，或聯繫客服 line: @ckmu。
            </p>
            <Link href="/login" className="inline-block text-sm text-gold-600 hover:underline">
              返回登入頁
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <input
              id="forgot-email"
              name="email"
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />

            {error && (
              <p className="text-sm text-red-600 text-center" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? '寄送中…' : '寄送重設連結'}
            </button>

            <div className="text-center pt-2">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-gold-600 hover:underline">
                ← 返回登入頁
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
