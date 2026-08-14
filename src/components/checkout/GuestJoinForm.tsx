'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { UserPlus, Check } from 'lucide-react'

/**
 * 訪客一鍵加入會員表單（成功頁卡片 + 信件邀請頁共用）
 * ------------------------------------------------
 * 只要設定一組密碼，結帳時建立的臨時帳號就地升級成會員，
 * 剛下的那筆訂單也自動出現在會員中心（customer 關聯沒變）。
 *
 * - 成功頁：不帶 token，靠剛結完帳的訪客 session（2 小時內）
 * - 信件邀請頁：帶 token（14 天有效）
 */
export default function GuestJoinForm({
  token,
  email,
  compact = false,
}: {
  token?: string
  email?: string
  compact?: boolean
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('密碼至少 8 個字元')
      return
    }
    if (password !== confirm) {
      setError('兩次輸入的密碼不一致')
      return
    }
    if (!acceptTerms) {
      setError('請勾選同意服務條款')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/guest-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, acceptTerms, ...(token ? { token } : {}) }),
      })
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null
      if (!res.ok || !body?.success) {
        setError(body?.error || '加入會員失敗，請稍後再試')
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError('加入會員失敗，請檢查網路連線後再試')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-gold-500/30 rounded-2xl p-6 text-left">
        <div className="flex items-center gap-2 mb-2">
          <Check size={18} className="text-gold-600" />
          <span className="font-medium">已成為會員</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          這筆訂單已經在您的會員中心，之後回購可直接帶入收件資訊，購物也開始累積點數。
        </p>
        <a
          href="/account/orders"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-foreground text-cream-50 rounded-full text-sm"
        >
          前往會員中心
        </a>
      </div>
    )
  }

  const inputClass =
    'w-full px-4 py-3 border border-cream-200 rounded-lg text-base focus:outline-none focus:border-gold-500'

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gold-500/30 rounded-2xl p-6 text-left space-y-4"
    >
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-gold-600" />
        <span className="font-medium">{compact ? '設定密碼，成為會員' : '加入會員'}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        只要設定一組密碼就完成註冊{email ? `（帳號：${email}）` : ''}。這筆訂單會直接進到您的
        會員中心，收件資訊自動存進地址簿，之後購物開始累積點數。
      </p>
      <div>
        <label htmlFor="join-password" className="block text-sm font-medium mb-1">
          設定密碼 <span className="text-red-500">*</span>
        </label>
        <input
          id="join-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 8 個字元"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="join-confirm" className="block text-sm font-medium mb-1">
          確認密碼 <span className="text-red-500">*</span>
        </label>
        <input
          id="join-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-1"
        />
        <span>
          我同意
          <a href="/terms" className="text-gold-600 underline underline-offset-2 mx-1" target="_blank">
            服務條款
          </a>
          與
          <a href="/privacy-policy" className="text-gold-600 underline underline-offset-2 mx-1" target="_blank">
            隱私權政策
          </a>
        </span>
      </label>
      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '處理中…' : '成為會員'}
      </button>
    </form>
  )
}
