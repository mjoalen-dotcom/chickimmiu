'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { signOut as nextAuthSignOut } from 'next-auth/react'

/**
 * 登出按鈕（client island）
 * ----------------------
 * 兩套 session 都得清：
 *   1. Payload cookie `payload-token`（/api/users/logout 端點）
 *   2. NextAuth session cookie（signOut，若使用者是 OAuth 登入）
 * 最後 router.push('/login') 再 refresh，讓 layout 的 SSR auth gate 重跑。
 */
export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onLogout() {
    if (pending) return
    setPending(true)
    try {
      // 先清 Payload cookie（API fetch 必 include credentials）
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // 離線/伺服器錯不擋登出體感
    }
    try {
      // 再清 NextAuth session（OAuth 使用者若沒做這步 session 會活到過期）
      await nextAuthSignOut({ redirect: false })
    } catch {
      // ignore
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors w-full disabled:opacity-60"
    >
      <LogOut size={18} />
      {pending ? '登出中…' : '登出'}
    </button>
  )
}
