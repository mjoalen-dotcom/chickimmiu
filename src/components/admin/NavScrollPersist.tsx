'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * NavScrollPersist — 後台左側 nav 在切 collection 時保留滾動位置。
 *
 * 背景：N2 fix 把 aside.nav 設成 position:fixed，但 Next.js App Router
 * 切 admin route 時 nav 內部 scrollTop 仍會被 reset 到 0，使用者捲到下半部
 * 點某個 collection 後，nav 跳回最上方，剛點的 item 跑出畫面，體驗很糟。
 *
 * 作法：
 *   - mount 時 attach scroll listener，把 scrollTop 寫進 sessionStorage（debounced）
 *   - usePathname 變動 → 雙 requestAnimationFrame 後 restore（等 Payload nav
 *     DOM 重 render 完才寫 scrollTop，否則寫了會被覆蓋）
 *
 * 沒有 UI，return null。掛在 admin.components.beforeNavLinks 隨 admin shell 生命週期。
 */
const KEY = 'ckmu_admin_nav_scrolltop'

const NavScrollPersist: React.FC = () => {
  const pathname = usePathname()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const nav = document.querySelector('aside.nav') as HTMLElement | null
    if (!nav) return

    const onScroll = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem(KEY, String(nav.scrollTop))
        } catch {}
      }, 50)
    }
    nav.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      nav.removeEventListener('scroll', onScroll)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const restore = () => {
      const nav = document.querySelector('aside.nav') as HTMLElement | null
      if (!nav) return
      try {
        const saved = sessionStorage.getItem(KEY)
        if (saved !== null) {
          const top = parseInt(saved, 10)
          if (!Number.isNaN(top) && top > 0) nav.scrollTop = top
        }
      } catch {}
    }
    requestAnimationFrame(() => {
      restore()
      requestAnimationFrame(restore)
    })
  }, [pathname])

  return null
}

export default NavScrollPersist
