'use client'

import type { WishlistItem } from '@/stores/wishlistStore'

/**
 * 收藏清單 client 端同步 helper
 * ─────────────────────────────
 * 全部 best-effort：失敗不丟錯、不影響 UX（UI 以 zustand store 為即時真相，
 * DB 是背景持久化）。登入狀態由 WishlistSync 控制何時啟用。
 */

export async function fetchServerWishlist(): Promise<WishlistItem[] | null> {
  try {
    const res = await fetch('/api/account/wishlist', { credentials: 'include' })
    if (!res.ok) return null
    const body = (await res.json()) as { items?: WishlistItem[] }
    return Array.isArray(body?.items) ? body.items : []
  } catch {
    return null
  }
}

export async function pushWishlistAdd(productId: string): Promise<void> {
  try {
    await fetch('/api/account/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId }),
      keepalive: true,
    })
  } catch {
    /* best-effort */
  }
}

export async function pushWishlistRemove(productId: string): Promise<void> {
  try {
    await fetch(`/api/account/wishlist?productId=${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      credentials: 'include',
      keepalive: true,
    })
  } catch {
    /* best-effort */
  }
}

/** 登入時把 localStorage 收藏合併進 DB，回傳合併後完整清單（含商品資料）。 */
export async function mergeWishlist(productIds: string[]): Promise<WishlistItem[] | null> {
  try {
    const res = await fetch('/api/account/wishlist/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productIds }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { items?: WishlistItem[] }
    return Array.isArray(body?.items) ? body.items : []
  } catch {
    return null
  }
}
