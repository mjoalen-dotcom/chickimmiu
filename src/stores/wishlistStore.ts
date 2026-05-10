'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safe-storage'
import { trackBehaviorWishlist } from '@/lib/behaviorTracking'

export interface WishlistItem {
  productId: string
  slug: string
  name: string
  image?: string
  price: number
  salePrice?: number
}

interface WishlistState {
  items: WishlistItem[]
  addItem: (item: WishlistItem) => void
  removeItem: (productId: string) => void
  toggleItem: (item: WishlistItem) => void
  isInWishlist: (productId: string) => boolean
  count: () => number
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          if (state.items.some((i) => i.productId === item.productId)) return state
          trackBehaviorWishlist({ productId: item.productId, action: 'add' })
          return { items: [...state.items, item] }
        })
      },

      removeItem: (productId) => {
        set((state) => {
          if (!state.items.some((i) => i.productId === productId)) return state
          trackBehaviorWishlist({ productId, action: 'remove' })
          return {
            items: state.items.filter((i) => i.productId !== productId),
          }
        })
      },

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
