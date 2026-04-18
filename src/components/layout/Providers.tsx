'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect, type ReactNode } from 'react'
import { useCartStore } from '@/stores/cartStore'
import { useWishlistStore } from '@/stores/wishlistStore'

/**
 * 全域 Providers
 * - SessionProvider：提供空 session 初始值，防止無 OAuth 時報錯
 * - useEffect：手動 rehydrate zustand persist store（配合 skipHydration: true
 *   避免購物車/收藏徽章造成 SSR → client hydration mismatch）
 * - 購物車 server sync：rehydrate 後 merge server cart（登入會員才會拿到東西），
 *   之後每次 items 改動 debounced POST 回 server。guests 會 silent 401，無害。
 */
export function Providers({ children }: { children: ReactNode }) {
  const items = useCartStore((s) => s.items)
  const hasMergedServer = useCartStore((s) => s._hasMergedServer)

  useEffect(() => {
    useCartStore.persist.rehydrate()
    useWishlistStore.persist.rehydrate()
    useCartStore.getState().mergeFromServer()
  }, [])

  useEffect(() => {
    if (!hasMergedServer) return
    const timer = setTimeout(() => {
      useCartStore.getState().syncToServer()
    }, 1000)
    return () => clearTimeout(timer)
  }, [items, hasMergedServer])

  return (
    <SessionProvider
      session={null as unknown as undefined}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  )
}
