'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import SocialLoginButtons from '@/components/auth/SocialLoginButtons'
import type { SocialProviderFlags } from '@/lib/auth/socialProviders'
import { safeInternalRedirect } from '@/lib/auth/safeRedirect'
import { getCurrentAttribution } from '@/lib/tracking'

/**
 * 客戶自助註冊頁（client 端）
 * -------------
 * Email/Password：POST `/api/users/register`（Users.ts 新增的 custom endpoint）
 *   成功 → 後端同時 login 下 cookie → 直接 redirect 到 /account
 * OAuth 註冊：next-auth signIn()，按鈕顯示由 server wrapper
 *   （page.tsx → getEnabledSocialProviders）決定：後台開關 AND env 憑證齊全。
 * 推薦碼（選填）→ 後端查出 referrer 寫入 referredBy
 */
export default function RegisterClient({ socialProviders }: { socialProviders: SocialProviderFlags }) {
  const search = useSearchParams()
  const redirectTo = safeInternalRedirect(search.get('redirect'))

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    birthday: '',
    birthTime: '',
    referralCode: '',
    acceptTerms: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasSocial =
    socialProviders.google || socialProviders.facebook || socialProviders.line || socialProviders.apple

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // PR-B：把 first-touch UTM 帶上，後端 customerRegister 會寫入 firstTouchAttribution
      const attrib = getCurrentAttribution()
      const res = await fetch('/api/users/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          birthday: form.birthday
            ? new Date(form.birthday).toISOString()
            : undefined,
          birthTime: form.birthTime || undefined,
          referralCode: form.referralCode.trim() || undefined,
          acceptTerms: form.acceptTerms,
          firstTouchAttribution: attrib.firstTouch || attrib.lastTouch || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        requiresVerification?: boolean
      }
      if (!res.ok) {
        setError(data.message || '註冊失敗，請稍後再試')
        return
      }
      if (data.requiresVerification) {
        // 後台開啟 email 驗證 → 沒下 cookie，導去登入頁並提示檢查信箱
        const loginParams = new URLSearchParams({
          registered: '1',
          verify: '1',
        })
        if (redirectTo !== '/account') {
          loginParams.set('redirect', redirectTo)
        }
        window.location.assign(`/login?${loginParams.toString()}`)
        return
      }
      // 驗證關閉 → 後端已下 cookie，直接進會員頁
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
          <h1 className="text-2xl font-serif mb-2">加入我們</h1>
          <p className="text-sm text-muted-foreground">
            註冊成為 CHIC KIM &amp; MIU 會員，享受專屬優惠
          </p>
        </div>

        <SocialLoginButtons providers={socialProviders} mode="register" redirectTo={redirectTo} />

        {hasSocial && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-cream-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-muted-foreground">或以 Email 註冊</span>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <input
            id="register-name"
            name="name"
            type="text"
            placeholder="姓名"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <input
            id="register-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <input
            id="register-password"
            name="password"
            type="password"
            placeholder="密碼（至少 8 個字元）"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                生日（選填）
              </label>
              <input
                id="register-birthday"
                name="bday"
                type="date"
                autoComplete="bday"
                value={form.birthday}
                onChange={(e) => update('birthday', e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                出生時間（選填）
              </label>
              <input
                id="register-birth-time"
                name="birthTime"
                type="time"
                value={form.birthTime}
                onChange={(e) => update('birthTime', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground -mt-2">
              用於生日禮、生日月優惠，以及更精準的星座／占星推算（不確定請留白）
            </p>
          </div>
          <input
            id="register-referral-code"
            name="referralCode"
            type="text"
            placeholder="推薦碼（選填）"
            value={form.referralCode}
            onChange={(e) => update('referralCode', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />

          <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed cursor-pointer">
            <input
              id="register-accept-terms"
              name="acceptTerms"
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => update('acceptTerms', e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span>
              我同意{' '}
              <Link href="/terms" className="text-gold-600 hover:underline">服務條款</Link>
              {' '}與{' '}
              <Link href="/privacy-policy" className="text-gold-600 hover:underline">隱私權政策</Link>
            </span>
          </label>

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
            {submitting ? '註冊中…' : '註冊'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-cream-200">
          <p className="text-sm text-muted-foreground pt-4">
            已有帳號？
            <Link
              href={`/login${redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="text-gold-600 ml-1 hover:underline"
            >
              立即登入
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
