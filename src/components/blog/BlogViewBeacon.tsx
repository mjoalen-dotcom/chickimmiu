'use client'

import { useEffect, useRef } from 'react'

/**
 * 文章閱讀計數 beacon。
 *
 * 為什麼不在 server component 裡直接遞增：
 *  1. RSC 的 render 會被 Next 快取／重用，副作用會漏計或重複計，數字不可信。
 *  2. 一開頁就 +1 計到的是曝光不是閱讀，爬蟲跟秒退都會灌進去。
 *
 * 所以改成：頁面「可見」累積滿門檻秒數才送一次，每次掛載最多送一次。
 * 換頁／關分頁時若還沒到門檻就不送。
 */
const DWELL_THRESHOLD_MS = 5_000
const TICK_MS = 1_000

export function BlogViewBeacon({ slug }: { slug: string }) {
  const sentRef = useRef(false)

  useEffect(() => {
    if (!slug) return
    let visibleMs = 0
    let timer: ReturnType<typeof setInterval> | null = null

    const send = () => {
      if (sentRef.current) return
      sentRef.current = true
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      const body = JSON.stringify({ slug })
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          const ok = navigator.sendBeacon(
            '/api/blog/view',
            new Blob([body], { type: 'application/json' }),
          )
          if (ok) return
        }
      } catch {
        // 落到 fetch
      }
      void fetch('/api/blog/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // 計數失敗不影響閱讀
      })
    }

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      visibleMs += TICK_MS
      if (visibleMs >= DWELL_THRESHOLD_MS) send()
    }

    timer = setInterval(tick, TICK_MS)
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [slug])

  return null
}

export default BlogViewBeacon
