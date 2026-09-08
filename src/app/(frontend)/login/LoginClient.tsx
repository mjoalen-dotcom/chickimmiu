'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import SocialLoginButtons from '@/components/auth/SocialLoginButtons'
import type { SocialProviderFlags } from '@/lib/auth/socialProviders'
import { safeInternalRedirect } from '@/lib/auth/safeRedirect'

/**
 * 客戶登入頁（client 端）
 * ---------
 * Email/Password：POST `/api/member/login`（自訂端點包 payload.login，寫入專屬
 * ckmu-member-token cookie — 與後台 payload-token 分家，互不相踢；2026-09-08）
 *   成功 → redirect 到 ?redirect 參數或 /account
 * OAuth：next-auth v5 signIn('google'|...)，按鈕顯示由 server wrapper
 *   （page.tsx → getEnabledSocialProviders）決定：後台開關 AND env 憑證齊全。
 * 忘記密碼：連 `/forgot-password`
 */
export default function LoginClient({ socialProviders }: { socialProviders: SocialProviderFlags }) {
  const search = useSearchParams()
  const redirectTo = safeInternalRedirect(search.get('redirect'))
  const registeredFlag = search.get('registered') === '1'
  const needVerifyFlag = search.get('verify') === '1'
  const verifiedFlag = search.get('verified') === '1'
  // `?error=` 來源：(a) NextAuth `pages.error: '/login'` — OAuth 失敗時自動帶；
  // (b) /api/auth/bridge — JWE 解不開或迴圈停損時主動帶。把代碼翻成中文讓使用者
  // 知道為何剛剛被踢回來，否則只看到「跳回 /login」會以為網站壞了。
  const urlError = search.get('error')
  const errorMessage = ((): string | null => {
    if (!urlError) return null
    if (urlError === 'session_invalid')
      return '社群登入連線過期，已清除舊登入資料；請重新點選下方社群按鈕登入。'
    if (urlError === 'session_bridge_failed')
      return '建立會員登入狀態失敗；請確認允許本網站的 Cookie 後重試，若持續失敗請聯繫客服。'
    if (urlError === 'AccessDenied')
      return '無法安全確認會員身分；請重試或使用原登入方式，若持續失敗請聯繫客服。'
    if (urlError === 'user_not_found')
      return '社群帳號未對應到任何會員；請改用 email/密碼登入或重新註冊。'
    if (urlError === 'auth_config_missing')
      return '伺服器登入設定缺漏，請聯繫客服。'
    if (urlError === 'OAuthAccountNotLinked')
      return '此 email 已用其他登入方式註冊；請改用原本的方式登入。'
    if (/^OAuth/.test(urlError))
      return `社群登入失敗（${urlError}），請稍後再試或改用 email 登入。`
    return `登入失敗：${urlError}`
  })()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasSocial =
    socialProviders.google || socialProviders.facebook || socialProviders.line || socialProviders.apple

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = (await res.json().catch(() => ({}))) as { errors?: Array<{ message?: string }>; message?: string }
      if (!res.ok) {
        const msg = data.errors?.[0]?.message || data.message || '登入失敗，請確認 email 與密碼'
        if (/not.*verified|verify/i.test(msg)) {
          setError('此帳號尚未完成 email 驗證，請到信箱點選驗證連結後再登入。')
          return
        }
        setError(msg === 'The email or password provided is incorrect.' ? 'Email 或密碼錯誤' : msg)
        return
      }
      // Use a full navigation so the freshly-issued Payload cookie is present
      // when the SSO authorize endpoint resumes the original blog request.
      window.location.assign(redirectTo)
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

        {registeredFlag && needVerifyFlag && (
          <div className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-foreground/80">
            註冊成功！我們已將驗證信寄至您的 email，請點信中連結完成驗證後再回來登入。
          </div>
        )}
        {registeredFlag && !needVerifyFlag && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            註冊成功，請以剛設定的 email 與密碼登入。
          </div>
        )}
        {verifiedFlag && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Email 驗證完成，請登入您的帳號。
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </div>
        )}

        <SocialLoginButtons providers={socialProviders} mode="login" redirectTo={redirectTo} />

        {hasSocial && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-cream-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-muted-foreground">或</span>
            </div>
          </div>
        )}

        {/* Email / Password */}
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <input
            id="login-password"
            name="password"
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
            <Link
              href={`/forgot-password${redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="text-muted-foreground hover:text-gold-600 hover:underline"
            >
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
