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
  /**
   * Set to true once mergeFromServer() has run after mount. Gate for server
   * sync: we never POST the empty localStorage cart back before we've checked
   * the server, otherwise a logged-in user on a fresh device would blow away
   * their server cart on page load.
   */
  _hasMergedServer: boolean

  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeItem: (productId: string, sku?: string) => void
  updateQuantity: (productId: string, quantity: number, sku?: string) => void
  clearCart: () => void
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void

  // server sync (no-op for guests; silent failure)
  mergeFromServer: () => Promise<void>
  syncToServer: () => Promise<void>

  // computed helpers
  totalItems: () => number
  subtotal: () => number
}

function itemKey(i: { productId: string; variant?: { sku?: string } }): string {
  return i.variant?.sku || i.productId
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      _hasMergedServer: false,

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

      mergeFromServer: async () => {
        if (get()._hasMergedServer) return
        try {
          const res = await fetch('/api/cart', {
            method: 'GET',
            credentials: 'same-origin',
          })
          if (!res.ok) {
            set({ _hasMergedServer: true })
            return
          }
          const data = (await res.json()) as { items?: CartItem[] }
          const serverItems = Array.isArray(data.items) ? data.items : []
          if (serverItems.length === 0) {
            set({ _hasMergedServer: true })
            return
          }
          const local = get().items
          const map = new Map<string, CartItem>()
          for (const i of local) map.set(itemKey(i), i)
          for (const s of serverItems) {
            const k = itemKey(s)
            const existing = map.get(k)
            if (!existing) {
              map.set(k, s)
            } else {
              // Take max qty; keep local's image/price snapshot (may be fresher)
              map.set(k, {
                ...s,
                ...existing,
                quantity: Math.max(existing.quantity, s.quantity),
              })
            }
          }
          set({ items: Array.from(map.values()), _hasMergedServer: true })
        } catch {
          set({ _hasMergedServer: true })
        }
      },

      syncToServer: async () => {
        try {
          await fetch('/api/cart', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: get().items }),
          })
        } catch {
          // Guest users get 401; network issues are transient — ignore.
        }
      },

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
