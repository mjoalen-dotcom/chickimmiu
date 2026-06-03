'use client'

import { useEffect, useRef } from 'react'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
import { useWishlistStore, setWishlistServerSync } from '@/stores/wishlistStore'
import { mergeWishlist } from '@/lib/wishlist/sync'

/**
 * WishlistSync — 收藏清單登入態同步橋接（render null）
 * ───────────────────────────────────────────────────
 * 掛在全域 Providers 內。依登入狀態轉換：
 *   未登入 → 登入：開啟同步 + 把 localStorage 收藏 merge 進 DB，再以 DB 為準回填 store
 *   登入 → 登出：關閉同步 + 清空本機 store（避免共用裝置殘留前一位會員收藏）
 *
 * 之後 store 的 add / remove 在同步開啟時會即時打 DB（見 wishlistStore）。
 *
 * 時序：useCurrentUser 走 async /api/users/me，loading 期間不動作；待 loading 結束
 *   時 Providers 的 rehydrate effect 早已把 localStorage 灌回 store，故 merge 拿得到
 *   本機既有收藏。
 */
export function WishlistSync() {
  const { isAuthenticated, loading } = useCurrentUser()
  // null = 尚未判定；true/false = 上一次已知登入態
  const wasAuthed = useRef<boolean | null>(null)

  useEffect(() => {
    if (loading) return
    const prev = wasAuthed.current

    if (isAuthenticated) {
      if (prev !== true) {
        wasAuthed.current = true
        setWishlistServerSync(true)
        const localIds = useWishlistStore.getState().items.map((i) => i.productId)
        mergeWishlist(localIds).then((merged) => {
          if (merged) useWishlistStore.getState().setItems(merged)
        })
      }
    } else {
      // 從登入變登出 → 清本機；初次即未登入 → 僅記錄狀態（保留 localStorage）
      if (prev === true) {
        setWishlistServerSync(false)
        useWishlistStore.getState().setItems([])
      }
      wasAuthed.current = false
    }
  }, [isAuthenticated, loading])

  return null
}
