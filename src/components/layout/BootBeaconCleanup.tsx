'use client'

/**
 * BootBeaconCleanup
 * ─────────────────
 * 在 React 成功 hydration 後，設定 window.__ckmuMounted = 1。
 * layout.tsx 的 inline script 裡有個 4 秒 fallback timer：
 *   - 如果 __ckmuMounted === 1 → 什麼都不做（React 成功掛載）
 *   - 如果 __ckmuMounted === 0 → 用 document.createElement 注入
 *     一個全螢幕 fixed beacon，顯示抓到的錯誤訊息
 *
 * 注意：beacon 是 inline script imperative 建立的，不是 React tree 的一部分，
 * 所以即使 React 19 因為 hydration error 把整個 SSR HTML 砍掉重 client render，
 * beacon 也不會被波及（react reconciliation 只管它自己創的節點）。
 *
 * 如果這個元件因為任何原因沒有 mount（例如 React tree 在某個
 * children 階段就炸了），__ckmuMounted 就保持 0，4 秒後 beacon
 * 自動出現，使用者不會看到一片白。
 */

import { useEffect } from 'react'

declare global {
  interface Window {
    __ckmuMounted?: number
  }
}

export function BootBeaconCleanup() {
  useEffect(() => {
    try {
      window.__ckmuMounted = 1
    } catch {
      // ignore — beacon flag must never throw
    }
  }, [])

  return null
}
