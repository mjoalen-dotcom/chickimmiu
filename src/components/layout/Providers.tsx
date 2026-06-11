'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect, type ReactNode } from 'react'
import { useCartStore } from '@/stores/cartStore'
import { useWishlistStore } from '@/stores/wishlistStore'
import { useLocaleStore } from '@/stores/localeStore'
import { WishlistSync } from '@/components/wishlist/WishlistSync'
import { useBGMStore } from '@/stores/bgmStore'

/**
 * 全域 Providers
 * - SessionProvider：提供空 session 初始值，防止無 OAuth 時報錯
 * - useEffect：
 *   1. 手動 rehydrate zustand persist store（配合 skipHydration: true
 *      避免購物車/收藏徽章造成 SSR → client hydration mismatch）
 *   2. 從 /api/currencies 拉一次活躍幣別清單 + 匯率，cache 進 localeStore
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    useCartStore.persist.rehydrate()
    useWishlistStore.persist.rehydrate()
    useLocaleStore.persist.rehydrate()
    useBGMStore.persist.rehydrate()
    // 拉幣別匯率（idempotent；store 內判 currenciesLoaded）
    useLocaleStore.getState().fetchCurrencies()
  }, [])

  return (
    <SessionProvider
      session={null as unknown as undefined}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <WishlistSync />
      {children}
    </SessionProvider>
  )
}
