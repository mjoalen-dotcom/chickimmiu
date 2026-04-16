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
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    useCartStore.persist.rehydrate()
    useWishlistStore.persist.rehydrate()
  }, [])

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
