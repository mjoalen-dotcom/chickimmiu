'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'

/**
 * 重設密碼頁
 * ---------
 * 從 `/forgot-password` 寄出的 email 連結點進來，URL 帶 `?token=...`
 * POST `/api/users/reset-password`（Payload 內建）
 *   body: { token, password }
 *   成功 → Payload 會一併 login + 下 cookie → redirect /account
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const search = useSearchParams()
  const token = search.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokenMissing = !token

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (tokenMissing) {
      setError('重設連結無效或已過期，請重新申請')
      return
    }
    if (password.length < 8) {
      setError('密碼至少 8 個字元')
      return
    }
    if (password !== confirm) {
      setError('兩次輸入的密碼不一致')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { errors?: Array<{ message?: string }>; message?: string }
      if (!res.ok) {
        const raw = data.errors?.[0]?.message || data.message || ''
        setError(raw.includes('token') || raw.includes('expired') ? '重設連結已過期，請重新申請' : raw || '重設失敗，請稍後再試')
        return
      }
      // Payload reset-password 成功會 auto-login 下 cookie
      router.replace('/account')
      router.refresh()
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
          <h1 className="text-2xl font-serif mb-2">重設密碼</h1>
          <p className="text-sm text-muted-foreground">
            設定新的密碼以繼續使用你的帳號
          </p>
        </div>

        {tokenMissing ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
              找不到重設 token，此連結可能已過期或無效。
            </div>
            <Link href="/forgot-password" className="inline-block text-sm text-gold-600 hover:underline">
              重新申請重設連結
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <input
              type="password"
              placeholder="新密碼（至少 8 個字元）"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
            <input
              type="password"
              placeholder="再次輸入新密碼"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
              {submitting ? '重設中…' : '確認重設'}
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
