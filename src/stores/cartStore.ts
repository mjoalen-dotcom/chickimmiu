'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { trackAddToCart } from '@/lib/tracking'
import { safeLocalStorage } from '@/lib/safe-storage'

export interface CartVariant {
  colorName: string
  colorCode?: string
  size: string
  sku: string
}

export interface CartItem {
  productId: string
  slug: string
  name: string
  image?: string
  price: number
  salePrice?: number
  variant?: CartVariant
  quantity: number
}

interface CartState {
  items: CartItem[]
  isDrawerOpen: boolean

  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeItem: (productId: string, sku?: string) => void
  updateQuantity: (productId: string, quantity: number, sku?: string) => void
  clearCart: () => void
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void

  // computed helpers
  totalItems: () => number
  subtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,

      addItem: (item, qty = 1) => {
        // 追蹤 AddToCart 事件
        trackAddToCart({
          item_id: item.productId,
          item_name: item.name,
          price: item.salePrice ?? item.price,
          quantity: qty,
          currency: 'TWD',
          item_variant: item.variant
            ? `${item.variant.colorName} / ${item.variant.size}`
            : undefined,
        })

        set((state) => {
          const key = item.variant?.sku || item.productId
          const existing = state.items.find(
            (i) => (i.variant?.sku || i.productId) === key,
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                (i.variant?.sku || i.productId) === key
                  ? { ...i, quantity: i.quantity + qty }
                  : i,
              ),
              isDrawerOpen: true,
            }
          }
          return {
            items: [...state.items, { ...item, quantity: qty }],
            isDrawerOpen: true,
          }
        })
      },

      removeItem: (productId, sku) => {
        set((state) => ({
          items: state.items.filter(
            (i) => (sku ? i.variant?.sku : i.productId) !== (sku || productId),
          ),
        }))
      },

      updateQuantity: (productId, quantity, sku) => {
        if (quantity <= 0) {
          get().removeItem(productId, sku)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            (sku ? i.variant?.sku : i.productId) === (sku || productId)
              ? { ...i, quantity }
              : i,
          ),
        }))
      },

      clearCart: () => set({ items: [] }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () =>
        get().items.reduce(
          (sum, i) => sum + (i.salePrice ?? i.price) * i.quantity,
          0,
        ),
    }),
    {
      name: 'ckm-cart',
      storage: safeLocalStorage,
      // Only persist items, not drawer state
      partialize: (state) => ({ items: state.items }),
      // Defer rehydration until after mount to avoid SSR hydration mismatch.
      // Manual rehydrate() is called from Providers.
      skipHydration: true,
    },
  ),
)
