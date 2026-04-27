'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * NavScrollPersist — 後台左側 nav 在切 collection 時保留滾動位置。
 *
 * Payload v3 的真正 scroll 容器是 aside.nav 內的 .nav__scroll
 * （aside 本身不會 scroll，scrollHeight 永遠等於 offsetHeight）。
 * 而且**點 nav 後 Payload 會把整個 .nav__scroll 換成新 DOM 節點**，
 * 實測替換時間在 click 後 500–1500ms（async 取資料 + 重 render，
 * scrollHeight 通常也會跟著變，因為不同 collection 的 sub-tree 會展開/收合）。
 *
 * N2.2 / N2.3 都假設新 aside 在 effect tick 結束前就 ready，用 rAF
 * retry 兩次就夠 — 但實際 timing 慢得多，retry 落空後就再也沒人來重新
 * attach 到新節點。pre.chickimmiu.com 實測 N2.3 deploy 後仍然每次 click
 * 把 nav 捲回 0。
 *
 * 此版三條防線：
 *   1. 100ms 輪詢撐 3 秒，配合
 *   2. MutationObserver 觀察 .template-default 子樹，DOM 一動就 tryAttach
 *   3. saveBlockedUntil：attach 後 800ms 內忽略 scroll 事件，避免 Payload
 *      在我們 restore 後又把新 element 的 scrollTop 設回 0、listener 把
 *      0 寫進 sessionStorage 把 saved 值蓋掉
 *
 * tryAttach 是 idempotent — 找到的 element 跟目前 activeEl 同一個就跳過，
 * 多次呼叫沒副作用，所以輪詢 + observer 同時開沒問題。
 *
 * 沒有 UI，return null。掛在 admin.components.beforeNavLinks 隨 admin shell 生命週期。
 */
const KEY = 'ckmu_admin_nav_scrolltop'
const POLL_MS = 100
const POLL_BUDGET_MS = 3000
const SAVE_BLOCK_MS = 800
const SAVE_DEBOUNCE_MS = 50

function findScroller(): HTMLElement | null {
  return (
    (document.querySelector('aside.nav .nav__scroll') as HTMLElement | null) ??
    (document.querySelector('aside.nav') as HTMLElement | null)
  )
}

const NavScrollPersist: React.FC = () => {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    let activeEl: HTMLElement | null = null
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    let detachListener: (() => void) | null = null
    let saveBlockedUntil = 0

    const tryAttach = () => {
      if (cancelled) return
      const nav = findScroller()
      if (!nav || nav === activeEl) return

      if (detachListener) detachListener()
      activeEl = nav

      try {
        const saved = sessionStorage.getItem(KEY)
        if (saved !== null) {
          const top = parseInt(saved, 10)
          if (!Number.isNaN(top) && top > 0) nav.scrollTop = top
        }
      } catch {}

      saveBlockedUntil = Date.now() + SAVE_BLOCK_MS

      const onScroll = () => {
        if (Date.now() < saveBlockedUntil) return
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          try {
            sessionStorage.setItem(KEY, String(nav.scrollTop))
          } catch {}
        }, SAVE_DEBOUNCE_MS)
      }
      nav.addEventListener('scroll', onScroll, { passive: true })
      detachListener = () => nav.removeEventListener('scroll', onScroll)
    }

    tryAttach()

    const pollId = setInterval(tryAttach, POLL_MS)
    const pollStop = setTimeout(() => clearInterval(pollId), POLL_BUDGET_MS)

    const root =
      (document.querySelector('.template-default') as HTMLElement | null) ??
      document.body
    const observer = new MutationObserver(() => tryAttach())
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      cancelled = true
      clearInterval(pollId)
      clearTimeout(pollStop)
      observer.disconnect()
      if (detachListener) detachListener()
      if (saveTimer) clearTimeout(saveTimer)
    }
  }, [pathname])

  return null
}

export default NavScrollPersist
