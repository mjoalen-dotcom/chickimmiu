'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { enqueueBehaviorEvent, flush } from '@/lib/behaviorTracking'

/**
 * BehaviorTracker — 客端消費者行為事件捕獲
 * ─────────────────────────────────────────
 * 掛在 layout.tsx 的 TrackingProvider 內，無 UI 輸出。
 *
 * 抓 4 種訊號：
 *   1. pageview         — pathname 變化
 *   2. click            — 委派監聽 [data-track] 元素的 click
 *   3. scroll           — 追蹤每頁最大 scroll %
 *   4. dwell            — 頁面切換 / 隱藏 / 卸載時送出停留時間 + scroll 深度
 *
 * 不在這裡發 add_to_cart：那條走 cartStore.addItem → trackBehaviorAddToCart
 * 直接 enqueue（這樣加購無論點哪個按鈕都會記到，比 DOM 監聽穩）。
 */
export function BehaviorTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sp = searchParams.toString()
  const fullPath = pathname + (sp ? `?${sp}` : '')

  // 上一頁狀態：切頁時送出 dwell 用
  const enterTsRef = useRef<number>(0)
  const lastPathRef = useRef<string>('')
  const scrollMaxRef = useRef<number>(0)

  function fireDwellForLastPage() {
    if (!lastPathRef.current || !enterTsRef.current) return
    const duration = Date.now() - enterTsRef.current
    if (duration < 500) return // < 500ms 不算
    enqueueBehaviorEvent({
      eventType: 'dwell',
      pagePath: lastPathRef.current,
      durationMs: duration,
      scrollPctMax: Math.round(scrollMaxRef.current),
    })
  }

  /* ── pageview + dwell on path change ───────────────────────────────── */
  useEffect(() => {
    if (!fullPath) return

    // 切頁前先送 dwell
    fireDwellForLastPage()

    // 重置 scroll max 並記新頁進入時間
    scrollMaxRef.current = 0
    enterTsRef.current = Date.now()
    lastPathRef.current = fullPath

    enqueueBehaviorEvent({ eventType: 'pageview', pagePath: fullPath })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullPath])

  /* ── click delegation: 攔 [data-track] ──────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onClick(e: Event) {
      const target = e.target as Element | null
      if (!target || typeof target.closest !== 'function') return
      const el = target.closest<HTMLElement>('[data-track]')
      if (!el) return
      const key = el.getAttribute('data-track')
      if (!key) return
      const productId =
        el.getAttribute('data-track-product') ||
        el.closest<HTMLElement>('[data-track-product]')?.getAttribute('data-track-product') ||
        undefined
      enqueueBehaviorEvent({
        eventType: 'click',
        elementKey: key.slice(0, 100),
        productId: productId || undefined,
      })
    }
    document.addEventListener('click', onClick, { capture: true, passive: true })
    return () => {
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions)
    }
  }, [])

  /* ── scroll depth tracking ──────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    let rafPending = false
    function onScroll() {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        const doc = document.documentElement
        const scrollTop = window.scrollY || doc.scrollTop || 0
        const viewport = window.innerHeight || doc.clientHeight || 1
        const full = doc.scrollHeight || 1
        const denom = Math.max(1, full - viewport)
        const pct = Math.min(100, Math.max(0, ((scrollTop + viewport) / full) * 100))
        // 用「scrollTop+viewport」而不是「scrollTop」是為了 short page 也能達 100%
        if (pct > scrollMaxRef.current) {
          scrollMaxRef.current = pct
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        denom // 防 lint 抱怨
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  /* ── flush 出口：visibilitychange / pagehide / beforeunload ───────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    function flushAll() {
      fireDwellForLastPage()
      // 重設 enterTs，避免下一輪重複算同一段
      enterTsRef.current = Date.now()
      scrollMaxRef.current = 0
      flush()
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flushAll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushAll)
    window.addEventListener('beforeunload', flushAll)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushAll)
      window.removeEventListener('beforeunload', flushAll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
