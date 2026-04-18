'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'

/**
 * 客戶登入頁
 * ---------
 * Email/Password：POST `/api/users/login`（Payload 內建，cookie-based session）
 *   成功 → redirect 到 ?redirect 參數或 /account
 * OAuth：維持 next-auth v5 已有的 signIn('google'|...)
 *   需 prod 有 AUTH_GOOGLE_ID / AUTH_FACEBOOK_ID / AUTH_LINE_CHANNEL_ID /
 *   AUTH_APPLE_ID 對應的 env 才會真動作。沒憑證時會被 next-auth pages.signIn
 *   導回本頁並在 URL 加 ?error=。
 * 忘記密碼：連 `/forgot-password`
 */
export default function LoginPage() {
  const router = useRouter()
  const search = useSearchParams()
  const redirectTo = search.get('redirect') || '/account'
  const registeredFlag = search.get('registered') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = (await res.json().catch(() => ({}))) as { errors?: Array<{ message?: string }>; message?: string }
      if (!res.ok) {
        const msg = data.errors?.[0]?.message || data.message || '登入失敗，請確認 email 與密碼'
        setError(msg === 'The email or password provided is incorrect.' ? 'Email 或密碼錯誤' : msg)
        return
      }
      // Payload login 成功 → cookie 已設、refresh 當前路由讓 SSR 取新 session
      router.replace(redirectTo)
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
          <h1 className="text-2xl font-serif mb-2">歡迎回來</h1>
          <p className="text-sm text-muted-foreground">
            登入你的 CHIC KIM &amp; MIU 帳號
          </p>
        </div>

        {registeredFlag && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            註冊成功，請以剛設定的 email 與密碼登入。
          </div>
        )}

        <div className="space-y-3">
          {/* Google */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: redirectTo })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            使用 Google 登入
          </button>

          {/* Facebook */}
          <button
            type="button"
            onClick={() => signIn('facebook', { callbackUrl: redirectTo })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            使用 Facebook 登入
          </button>

          {/* LINE */}
          <button
            type="button"
            onClick={() => signIn('line', { callbackUrl: redirectTo })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="#06C755" viewBox="0 0 24 24">
              <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            使用 LINE 登入
          </button>

          {/* Apple */}
          <button
            type="button"
            onClick={() => signIn('apple', { callbackUrl: redirectTo })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="#000000" viewBox="0 0 24 24">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            使用 Apple 登入
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-cream-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-4 text-muted-foreground">或</span>
          </div>
        </div>

        {/* Email / Password */}
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <input
            type="password"
            placeholder="密碼"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? '登入中…' : '登入'}
          </button>

          <div className="flex items-center justify-between text-xs">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-gold-600 hover:underline">
              忘記密碼？
            </Link>
            <Link href={`/register${redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="text-gold-600 hover:underline">
              還沒有帳號？立即註冊
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
