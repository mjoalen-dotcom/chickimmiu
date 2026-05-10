/**
 * 客端消費者行為追蹤
 * ─────────────────
 * 跟 src/lib/tracking.ts 並排：那邊負責對外（GTM / fbq / GA4），
 * 這邊負責對內（自家 /api/behavior/track），給 ⓪ 數據儀表 → 消費者分析用。
 *
 * 設計：
 *   - 所有事件先 push 到 in-memory queue
 *   - 5 秒節流 / queue ≥ 10 → flush；visibilitychange:hidden / beforeunload 強制 flush
 *   - flush 走 navigator.sendBeacon（非阻塞、頁面 unload 仍能成功）；
 *     fallback 走 fetch keepalive
 *   - cookie consent 沒同意 → enqueue() 直接 no-op（甚至連 sessionStorage 都不碰）
 *
 * 跟既有的 lib/tracking.ts 重用：getCurrentAttribution() 拿 sessionId / device / UTM
 */

import { getCurrentAttribution } from './tracking'

export type BehaviorEventType =
  | 'pageview'
  | 'product_view'
  | 'click'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'checkout_start'
  | 'purchase'
  | 'scroll'
  | 'dwell'

export interface BehaviorEventInput {
  eventType: BehaviorEventType
  pagePath?: string // 預設取 location.pathname + search
  productId?: number | string
  elementKey?: string
  value?: number
  quantity?: number
  durationMs?: number
  scrollPctMax?: number
  searchQuery?: string
  meta?: Record<string, unknown>
}

interface QueuedEvent extends BehaviorEventInput {
  sessionId: string
  pagePath: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referrer?: string
  landingPath?: string
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'other'
}

const COOKIE_CONSENT_KEY = 'ckm-cookie-consent'
const FLUSH_INTERVAL_MS = 5000
const QUEUE_THRESHOLD = 10
const ENDPOINT = '/api/behavior/track'

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function consentGranted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted'
  } catch {
    // localStorage 被擋（iOS 私密模式）→ 視為未同意，安全側
    return false
  }
}

function getPagePath(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname + (window.location.search || '')
}

function scheduleFlush() {
  if (flushTimer) return
  if (typeof window === 'undefined') return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_INTERVAL_MS)
}

/**
 * 把 queue 的事件一次送出。失敗就丟掉（追蹤資料不關鍵到要重試）。
 */
export function flush() {
  if (typeof window === 'undefined') return
  if (queue.length === 0) return
  const batch = queue
  queue = []

  const body = JSON.stringify({ events: batch })

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon(ENDPOINT, blob)
      if (ok) return
      // sendBeacon 拒絕（payload 太大或瀏覽器卡住）→ 落到 fetch
    }
  } catch {
    // ignore — fall through to fetch
  }

  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {
      // silent fail — 行為事件失敗不影響 UX
    })
  } catch {
    // 兩個 transport 都失敗 → 放棄
  }
}

/**
 * 把事件丟進 queue。consent 未同意 / SSR → no-op。
 */
export function enqueueBehaviorEvent(input: BehaviorEventInput) {
  if (typeof window === 'undefined') return
  if (!consentGranted()) return
  if (!input?.eventType) return

  const attribution = getCurrentAttribution()

  const ev: QueuedEvent = {
    ...input,
    sessionId: attribution.sessionId,
    pagePath: input.pagePath || getPagePath(),
    utmSource: attribution.lastTouch?.utmSource,
    utmMedium: attribution.lastTouch?.utmMedium,
    utmCampaign: attribution.lastTouch?.utmCampaign,
    referrer: attribution.lastTouch?.referrer,
    landingPath: attribution.lastTouch?.landingPath,
    deviceType: attribution.deviceType,
  }

  queue.push(ev)

  if (queue.length >= QUEUE_THRESHOLD) {
    flush()
    return
  }
  scheduleFlush()
}

/* ─── 公開的 helper（給 cartStore / wishlist / checkout 直接呼叫）────── */

export function trackBehaviorAddToCart(args: {
  productId: string | number
  unitPrice?: number
  quantity?: number
  variant?: string
}) {
  enqueueBehaviorEvent({
    eventType: 'add_to_cart',
    productId: args.productId,
    value: args.unitPrice,
    quantity: args.quantity,
    meta: args.variant ? { variant: args.variant } : undefined,
  })
}

export function trackBehaviorRemoveFromCart(args: {
  productId: string | number
  quantity?: number
}) {
  enqueueBehaviorEvent({
    eventType: 'remove_from_cart',
    productId: args.productId,
    quantity: args.quantity,
  })
}

export function trackBehaviorWishlist(args: {
  productId: string | number
  action: 'add' | 'remove'
}) {
  enqueueBehaviorEvent({
    eventType: args.action === 'add' ? 'wishlist_add' : 'wishlist_remove',
    productId: args.productId,
  })
}

export function trackBehaviorCheckoutStart(args?: {
  cartValue?: number
  itemCount?: number
}) {
  enqueueBehaviorEvent({
    eventType: 'checkout_start',
    value: args?.cartValue,
    quantity: args?.itemCount,
  })
}

export function trackBehaviorSearch(query: string) {
  enqueueBehaviorEvent({
    eventType: 'search',
    searchQuery: query,
  })
}
