'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

/**
 * Email 驗證頁
 * -----------
 * 從驗證信連結點進來，URL 帶 `?token=...`
 * POST `/api/users/verify/<token>`（Payload 內建 verifyEmail endpoint）
 *   成功 → 顯示驗證完成訊息 + 導去 /login?verified=1 按鈕
 *   失敗 → token 過期 / 無效提示（不提供自動重寄，避免 enumeration；可重新註冊或聯絡客服）
 *
 * 自動於掛載時發送 POST（effect 僅跑一次）。
 *
 * Next 15 注意：useSearchParams 的子樹必須包在 <Suspense> 裡，否則 prod build
 * 會把整頁 bailout 成 dynamic；把 client logic 拆成內層 component + Suspense
 * fallback 保留 SSR 可渲染的 loading skeleton。
 */

type Status = 'loading' | 'success' | 'invalid_token' | 'already_verified' | 'error'

function VerifyEmailInner() {
  const search = useSearchParams()
  const token = (search.get('token') || '').trim()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState<string>('')
  const firedRef = useRef(false)

  useEffect(() => {
    // StrictMode 下 effect 會跑兩次；只發一次 POST
    if (firedRef.current) return
    firedRef.current = true

    if (!token) {
      setStatus('invalid_token')
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`/api/users/verify/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const data = (await res.json().catch(() => ({}))) as {
          message?: string
          errors?: Array<{ message?: string }>
        }
        if (res.ok) {
          setStatus('success')
          return
        }
        const raw = (data.errors?.[0]?.message || data.message || '').toLowerCase()
        if (raw.includes('already verified')) {
          setStatus('already_verified')
          return
        }
        if (raw.includes('token') || raw.includes('expired') || res.status === 404) {
          setStatus('invalid_token')
          return
        }
        setStatus('error')
        setMessage(data.errors?.[0]?.message || data.message || '')
      } catch {
        setStatus('error')
        setMessage('網路錯誤，請稍後再試')
      }
    })()
  }, [token])

  if (status === 'loading') {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">驗證中，請稍候…</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-700 text-center">
          驗證成功！您的 email 已完成確認，現在可以登入帳號。
        </div>
        <Link
          href="/login?verified=1"
          className="block w-full text-center py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
        >
          前往登入
        </Link>
      </div>
    )
  }

  if (status === 'already_verified') {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-5 text-sm text-foreground/80 text-center">
          此帳號先前已驗證過，請直接登入即可。
        </div>
        <Link
          href="/login"
          className="block w-full text-center py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
        >
          前往登入
        </Link>
      </div>
    )
  }

  if (status === 'invalid_token') {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700 text-center">
          驗證連結無效或已過期。請重新註冊，或聯絡客服協助處理。
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/register"
            className="text-center py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
          >
            重新註冊
          </Link>
          <Link
            href="/login"
            className="text-center py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            前往登入
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700 text-center">
        驗證失敗：{message || '未知錯誤'}，請稍後再試或聯絡客服。
      </div>
      <Link
        href="/login"
        className="block w-full text-center py-3 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
      >
        返回登入頁
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-cream-50">
      <div className="w-full max-w-md space-y-6 bg-white rounded-2xl p-8 border border-cream-200 shadow-sm animate-fade-in">
        <div className="text-center">
          <h1 className="text-2xl font-serif mb-2">Email 驗證</h1>
        </div>
        <Suspense
          fallback={
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">載入中…</p>
            </div>
          }
        >
          <VerifyEmailInner />
        </Suspense>
      </div>
    </main>
  )
}
