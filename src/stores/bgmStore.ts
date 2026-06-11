'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safe-storage'

/**
 * Brand Anthem (Background Music) Store
 * ──────────────────────────────────────
 * 全網站「品牌主題曲」播放器狀態管理。
 *
 * 設計原則（資深電商 UX）：
 *   - 預設關閉（Chrome 88+ / Safari 11+ / Firefox 66+ 全擋 autoplay with sound，
 *     即使預設開也不會自動播 → 不如直接預設關 + 視覺暗示讓用戶主動點）
 *   - 用戶按下後 localStorage 記住偏好，跨頁/跨 session 維持
 *   - 結帳頁強制暫停（不打擾下單情緒）
 *   - 偵測到頁面有 <video> 在播 → 自動暫停 BGM（避免聲音打架）
 *   - 暫停狀態 = 暫停，不是 stop reset position（user 可以接著聽）
 *
 * 持久化：zustand persist → safeLocalStorage（key: ckm-bgm）
 *   skipHydration: true，由 Providers.tsx rehydrate（避免 SSR hydration mismatch）
 */

interface BGMState {
  /** 用戶是否點過播放按鈕（用來決定第一次 tooltip 是否顯示） */
  hasInteracted: boolean
  /** 用戶想要播放（store-level intent，實際 audio element 由 component 控制） */
  isPlaying: boolean
  /** 音量 0-1 */
  volume: number

  setHasInteracted: () => void
  togglePlaying: () => void
  pause: () => void
  setVolume: (v: number) => void
}

export const useBGMStore = create<BGMState>()(
  persist(
    (set) => ({
      hasInteracted: false,
      isPlaying: false,
      volume: 0.35, // 預設音量輕一點，BGM 不該蓋過 UI 操作

      setHasInteracted: () => set({ hasInteracted: true }),
      togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
      pause: () => set({ isPlaying: false }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
    }),
    {
      name: 'ckm-bgm',
      storage: safeLocalStorage,
      skipHydration: true,
      // 不持久化 isPlaying — 每次 mount 從關閉開始，避免 reload 後突然出聲
      // 但記住 hasInteracted（互動過就不再顯示 tutorial tooltip）和 volume 偏好
      partialize: (state) => ({
        hasInteracted: state.hasInteracted,
        volume: state.volume,
      }),
    },
  ),
)
