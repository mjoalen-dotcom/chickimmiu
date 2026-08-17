'use client'

import { useEffect, useRef } from 'react'

/**
 * 文章閱讀計數 beacon。
 *
 * 為什麼不在 server component 裡直接遞增：
 *  1. RSC 的 render 會被 Next 快取／重用，副作用會漏計或重複計，數字不可信。
 *  2. 一開頁就 +1 計到的是曝光不是閱讀，爬蟲跟秒退都會灌進去。
 *
 * 所以改成：分頁「可見」累積滿門檻秒數才送一次，每次掛載最多送一次。
 *
 * 🔥 用時間戳累計，不要用「數 setInterval 跳了幾次」：
 * 瀏覽器對背景分頁的計時器有節流（1 秒的 interval 會被降到約每分鐘一次），
 * 數 tick 次數的話門檻會被放大幾十倍——實測在背景分頁要 5 分鐘才送得出去。
 * 改成記錄可見的起訖時間、由單一 setTimeout 喚醒時計算真正累積了多久，
 * 就算 timeout 被延後觸發也只是晚一點送，不會把門檻乘上節流倍率。
 */
const DWELL_THRESHOLD_MS = 5_000

export function BlogViewBeacon({ slug }: { slug: string }) {
  const sentRef = useRef(false)

  useEffect(() => {
    if (!slug) return
    if (typeof document === 'undefined') return

    let accumulatedMs = 0
    let visibleSince: number | null = document.visibilityState === 'visible' ? Date.now() : null
    let timer: ReturnType<typeof setTimeout> | null = null

    const elapsed = () =>
      accumulatedMs + (visibleSince == null ? 0 : Date.now() - visibleSince)

    const send = () => {
      if (sentRef.current) return
      sentRef.current = true
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

    const check = () => {
      timer = null
      if (sentRef.current) return
      const done = elapsed()
      if (done >= DWELL_THRESHOLD_MS) {
        send()
        return
      }
      // 還沒滿：只有在「目前可見」時才值得再排一次，隱藏時交給
      // visibilitychange 重新啟動，避免在背景空轉。
      if (visibleSince != null) {
        timer = setTimeout(check, DWELL_THRESHOLD_MS - done)
      }
    }

    const onVisibility = () => {
      if (sentRef.current) return
      if (document.visibilityState === 'visible') {
        if (visibleSince == null) visibleSince = Date.now()
        if (timer == null) timer = setTimeout(check, DWELL_THRESHOLD_MS - elapsed())
      } else {
        if (visibleSince != null) {
          accumulatedMs += Date.now() - visibleSince
          visibleSince = null
        }
        if (timer != null) {
          clearTimeout(timer)
          timer = null
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    if (visibleSince != null) timer = setTimeout(check, DWELL_THRESHOLD_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer != null) clearTimeout(timer)
    }
  }, [slug])

  return null
}

export default BlogViewBeacon
