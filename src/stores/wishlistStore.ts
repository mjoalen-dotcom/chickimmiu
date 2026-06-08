'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safe-storage'
import { trackBehaviorWishlist } from '@/lib/behaviorTracking'
import { pushWishlistAdd, pushWishlistRemove } from '@/lib/wishlist/sync'

export interface WishlistItem {
  productId: string
  slug: string
  name: string
  image?: string
  price: number
  salePrice?: number
}

/**
 * 是否把變更同步到 DB（會員登入後由 WishlistSync 開啟）。
 * 未登入時為 false → 純走 localStorage（原行為）。
 */
let serverSyncEnabled = false
export function setWishlistServerSync(enabled: boolean) {
  serverSyncEnabled = enabled
}

interface WishlistState {
  items: WishlistItem[]
  addItem: (item: WishlistItem) => void
  removeItem: (productId: string) => void
  toggleItem: (item: WishlistItem) => void
  isInWishlist: (productId: string) => boolean
  count: () => number
  /** 整批覆蓋（伺服端回填用，不觸發追蹤 / DB 同步）。 */
  setItems: (items: WishlistItem[]) => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          if (state.items.some((i) => i.productId === item.productId)) return state
          trackBehaviorWishlist({ productId: item.productId, action: 'add' })
          if (serverSyncEnabled) void pushWishlistAdd(item.productId)
          return { items: [...state.items, item] }
        })
      },

      removeItem: (productId) => {
        set((state) => {
          if (!state.items.some((i) => i.productId === productId)) return state
          trackBehaviorWishlist({ productId, action: 'remove' })
          if (serverSyncEnabled) void pushWishlistRemove(productId)
          return {
            items: state.items.filter((i) => i.productId !== productId),
          }
        })
      },

      setItems: (items) => set({ items }),

      toggleItem: (item) => {
        const exists = get().items.some((i) => i.productId === item.productId)
        if (exists) {
          get().removeItem(item.productId)
        } else {
          get().addItem(item)
        }
      },

      isInWishlist: (productId) =>
        get().items.some((i) => i.productId === productId),

      count: () => get().items.length,
    }),
    {
      name: 'ckm-wishlist',
      storage: safeLocalStorage,
      // Defer rehydration until after mount to avoid SSR hydration mismatch.
      // Manual rehydrate() is called from Providers.
      skipHydration: true,
    },
  ),
)
