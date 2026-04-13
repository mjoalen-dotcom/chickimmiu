'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * 管理員登入頁面
 * ──────────────
 * 與消費者 /login 分流，此頁僅供管理員 / 合作夥伴登入
 * 登入成功後導向 /admin（Payload CMS 後台管理介面）
 */
export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.errors?.[0]?.message || '帳號或密碼錯誤')
        setLoading(false)
        return
      }

      // 確認是管理員或合作夥伴
      const role = data.user?.role
      if (role !== 'admin' && role !== 'partner') {
        setError('此登入頁僅供管理人員使用，消費者請至一般登入頁面')
        setLoading(false)
        return
      }

      // 導向後台
      router.push('/admin')
    } catch {
      setError('登入過程發生錯誤，請稍後再試')
      setLoading(false)
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{
        background: 'linear-gradient(135deg, #1a1f36 0%, #242a45 50%, #2e3558 100%)',
      }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div
            className="inline-block px-6 py-2 rounded-full text-xs tracking-[0.3em] uppercase mb-4"
            style={{
              color: '#C19A5B',
              border: '1px solid rgba(193, 154, 91, 0.3)',
              background: 'rgba(193, 154, 91, 0.08)',
            }}
          >
            Management Portal
          </div>
          <h1
            className="text-3xl font-serif tracking-wide"
            style={{ color: '#F8F1E9' }}
          >
            CHIC KIM &amp; MIU
          </h1>
          <p
            className="text-sm mt-2 tracking-wide"
            style={{ color: 'rgba(248, 241, 233, 0.6)' }}
          >
            後台管理系統
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl p-8 space-y-5"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(193, 154, 91, 0.2)',
          }}
        >
          {error && (
            <div
              className="text-sm px-4 py-3 rounded-lg"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5',
              }}
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              className="text-xs tracking-wider uppercase"
              style={{ color: 'rgba(248, 241, 233, 0.5)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@chickimmiu.com"
              required
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(193, 154, 91, 0.2)',
                color: '#F8F1E9',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs tracking-wider uppercase"
              style={{ color: 'rgba(248, 241, 233, 0.5)' }}
            >
              密碼
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(193, 154, 91, 0.2)',
                color: '#F8F1E9',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm tracking-wide transition-all disabled:opacity-50"
            style={{
              background: loading
                ? 'rgba(193, 154, 91, 0.5)'
                : 'linear-gradient(135deg, #C19A5B, #D4B47A)',
              color: '#1a1f36',
              fontWeight: 600,
            }}
          >
            {loading ? '登入中...' : '登入管理後台'}
          </button>
        </form>

        {/* Footer Links */}
        <div className="text-center space-y-3">
          <p
            className="text-xs"
            style={{ color: 'rgba(248, 241, 233, 0.4)' }}
          >
            此頁面僅供管理人員使用
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="text-xs transition-colors hover:underline"
              style={{ color: 'rgba(193, 154, 91, 0.7)' }}
            >
              消費者登入 →
            </Link>
            <span style={{ color: 'rgba(248, 241, 233, 0.2)' }}>|</span>
            <Link
              href="/"
              className="text-xs transition-colors hover:underline"
              style={{ color: 'rgba(193, 154, 91, 0.7)' }}
            >
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
