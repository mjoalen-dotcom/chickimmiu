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
  // ── 19D 促銷三件套標記（client-side，結帳時 POST 到 Orders.items） ──
  bundleRef?: string | number
  bundleLabel?: string // 例：「春日禮盒」
  isGift?: boolean
  giftRuleRef?: string | number
  isAddOn?: boolean
  addOnRuleRef?: string | number
}

export interface BundleLike {
  id: string | number
  name: string
  slug: string
  bundlePrice: number
  image?: string
  items: Array<{
    product: {
      id: string | number
      slug: string
      name: string
      price: number
      salePrice?: number
      image?: string
    }
    quantity: number
  }>
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

  // ── 19D 促銷三件套 ──
  addBundle: (bundle: BundleLike, qty?: number) => void
  removeBundle: (bundleId: string | number) => void
  replaceGifts: (gifts: Omit<CartItem, 'quantity'>[]) => void

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
            (i) => (i.variant?.sku || i.productId) === key && !i.bundleRef && !i.isGift,
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                (i.variant?.sku || i.productId) === key && !i.bundleRef && !i.isGift
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

      // ── 19D 加入組合商品 ──
      // 展開為多個 lineItem：第 1 行 price=bundlePrice，其他行 price=0。
      // 所有行都帶 bundleRef + bundleLabel，以便 cart UI 能折疊顯示為一組。
      addBundle: (bundle, qty = 1) => {
        const expandedItems: CartItem[] = []
        bundle.items.forEach((row, index) => {
          const product = row.product
          expandedItems.push({
            productId: String(product.id),
            slug: product.slug,
            name: product.name,
            image: product.image,
            price: index === 0 ? bundle.bundlePrice / qty : 0,
            quantity: row.quantity * qty,
            bundleRef: bundle.id,
            bundleLabel: bundle.name,
          })
        })
        set((state) => ({
          items: [...state.items, ...expandedItems],
          isDrawerOpen: true,
        }))
      },

      // ── 19D 移除整組 bundle ──
      removeBundle: (bundleId) => {
        set((state) => ({
          items: state.items.filter((i) => i.bundleRef !== bundleId),
        }))
      },

      // ── 19D 贈品 replacer（整批替換，由 checkout 拉 /api/cart/gifts 後呼叫） ──
      replaceGifts: (gifts) => {
        set((state) => ({
          items: [
            ...state.items.filter((i) => !i.isGift),
            ...gifts.map((g) => ({ ...g, quantity: 1 })),
          ],
        }))
      },

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () =>
        get()
          .items
          // 贈品不計入 subtotal；bundle 行 price=0 本就不貢獻
          .filter((i) => !i.isGift)
          .reduce((sum, i) => sum + (i.salePrice ?? i.price) * i.quantity, 0),
    }),
    {
      name: 'ckm-cart',
      storage: safeLocalStorage,
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
    },
  ),
)
