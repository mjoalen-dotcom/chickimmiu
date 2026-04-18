'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Client-side 當前使用者 hook
 * ---------------------------
 * SSR 端用 `getCurrentUser()`（讀 Payload session cookie → fallback NextAuth），
 * 這支 hook 是 client-side 版本：拉 `/api/users/me` 拿 Payload session，fallback
 * 到 `useSession()` 蓋 OAuth 剛登入但 `/api/auth/bridge` 還沒寫 `payload-token`
 * 的短暫視窗。
 *
 * 判斷順序與 Navbar 一致（Payload 優先）以避免 SSR/CSR 呈現不一致。
 */

export interface ClientUser {
  id: string | number
  email: string
  name?: string
  source: 'payload' | 'nextauth'
}

interface PayloadMeResponse {
  user: {
    id: string | number
    email?: string
    name?: string
  } | null
}

export function useCurrentUser() {
  const { data: nextAuthSession, status: nextAuthStatus } = useSession()
  const [payloadUser, setPayloadUser] = useState<PayloadMeResponse['user']>(null)
  const [payloadChecked, setPayloadChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/users/me', { credentials: 'include' })
        if (!res.ok) {
          if (!cancelled) setPayloadUser(null)
          return
        }
        const body = (await res.json()) as PayloadMeResponse
        if (!cancelled) setPayloadUser(body?.user ?? null)
      } catch {
        if (!cancelled) setPayloadUser(null)
      } finally {
        if (!cancelled) setPayloadChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  let user: ClientUser | null = null
  if (payloadUser && payloadUser.email) {
    user = {
      id: payloadUser.id,
      email: payloadUser.email,
      name: payloadUser.name || payloadUser.email.split('@')[0],
      source: 'payload',
    }
  } else if (nextAuthSession?.user?.email) {
    user = {
      id: nextAuthSession.user.id || '',
      email: nextAuthSession.user.email,
      name: nextAuthSession.user.name || nextAuthSession.user.email.split('@')[0],
      source: 'nextauth',
    }
  }

  const loading = !payloadChecked || nextAuthStatus === 'loading'

  return { user, isAuthenticated: user !== null, loading }
}
