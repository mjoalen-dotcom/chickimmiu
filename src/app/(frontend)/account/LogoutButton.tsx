'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onLogout() {
    if (pending) return
    setPending(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // 即使 fetch 失敗（離線等），仍導去 /login，UI 體感一致
    } finally {
      router.push('/login')
      router.refresh()
    }
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
