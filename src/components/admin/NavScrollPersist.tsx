'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * NavScrollPersist — 後台左側 nav 在切 collection 時保留滾動位置。
 *
 * 背景：N2 fix 把 aside.nav 設成 position:fixed，但點 nav 切頁時，
 * 使用者捲到下半部點某個 collection 後，nav 會跳回最上方。N2.2 嘗試用
 * sessionStorage 持久化 scrollTop，但選錯 element：Payload v3 真正的
 * scroller 是 aside.nav 內的 .nav__scroll（aside 本身不會 scroll，
 * scrollHeight 永遠等於 offsetHeight），所以原本的 listener 從未觸發、
 * sessionStorage 永遠寫不進去。
 *
 * 此外實測點 nav 後 .nav__scroll DOM 節點會被替換成新節點（同 selector
 * 但不同 instance），所以 listener 必須在 *每次 pathname 變動* 時重新
 * attach 到新節點，否則第一次切頁後就再也不會 save。
 *
 * 作法：
 *   - 把 attach + restore 全部塞進 pathname effect
 *   - cleanup 時搶在 listener 拿掉前同步寫入一次（catch 使用者捲完
 *     <50ms 就點 nav 的 case）
 *   - 抓不到節點就靠雙 rAF retry 等 Payload 把新 nav render 進 DOM
 *
 * 沒有 UI，return null。掛在 admin.components.beforeNavLinks 隨 admin shell 生命週期。
 */
const KEY = 'ckmu_admin_nav_scrolltop'

function findScroller(): HTMLElement | null {
  return (
    (document.querySelector('aside.nav .nav__scroll') as HTMLElement | null) ??
    (document.querySelector('aside.nav') as HTMLElement | null)
  )
}

const NavScrollPersist: React.FC = () => {
  const pathname = usePathname()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    let detach: (() => void) | undefined

    const attach = (): boolean => {
      if (cancelled) return true
      const nav = findScroller()
      if (!nav) return false

      try {
        const saved = sessionStorage.getItem(KEY)
        if (saved !== null) {
          const top = parseInt(saved, 10)
          if (!Number.isNaN(top) && top > 0) nav.scrollTop = top
        }
      } catch {}

      const save = () => {
        try {
          sessionStorage.setItem(KEY, String(nav.scrollTop))
        } catch {}
      }
      const onScroll = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(save, 50)
      }
      nav.addEventListener('scroll', onScroll, { passive: true })

      detach = () => {
        save()
        nav.removeEventListener('scroll', onScroll)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      }
      return true
    }

    if (!attach()) {
      requestAnimationFrame(() => {
        if (!attach()) requestAnimationFrame(() => attach())
      })
    }

    return () => {
      cancelled = true
      detach?.()
    }
  }, [pathname])

  return null
}

export default NavScrollPersist
