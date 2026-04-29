/**
 * 集中管理所有追蹤函式
 * ──────────────────────
 * GTM dataLayer push + Meta Pixel fbq + GA4 gtag
 * 開發模式下所有事件都會 console.log 以便偵錯
 */

/* ─── 型別定義 ─── */

export interface TrackingItem {
  item_id: string
  item_name: string
  price: number
  quantity: number
  item_category?: string
  item_variant?: string
  discount?: number
}

export interface PurchaseData {
  transaction_id: string
  value: number
  currency: string
  shipping?: number
  items: TrackingItem[]
  membership_tier?: string
}

export interface ViewContentData {
  content_id: string
  content_name: string
  content_type: string
  value: number
  currency: string
}

export interface AddToCartData {
  item_id: string
  item_name: string
  price: number
  quantity: number
  currency: string
  item_variant?: string
}

/* ─── 工具函式 ─── */

const isDev = process.env.NODE_ENV === 'development'

function debugLog(eventName: string, data: Record<string, unknown>) {
  if (isDev) {
    console.log(
      `%c[Tracking] ${eventName}`,
      'color: #C19A5B; font-weight: bold;',
      data,
    )
  }
}

/**
 * 推送事件至 GTM dataLayer
 */
function pushDataLayer(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...data })
  debugLog(event, data)
}

/**
 * Meta Pixel (fbq) 推送
 */
function fbqTrack(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  if (typeof window.fbq === 'function') {
    window.fbq('track', event, data)
  }
  debugLog(`fbq:${event}`, data)
}

/* ─── UTM 參數解析 ─── */

export interface UTMParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  ref?: string
}

export interface AttributionTouch {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  referrer?: string
  landingPath?: string
  capturedAt: string // ISO 8601
}

export interface CurrentAttribution {
  firstTouch: AttributionTouch | null
  lastTouch: AttributionTouch | null
  sessionId: string
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'other'
}

/* ─── Cookie helpers (no external dep) ─── */
function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 86400000).toUTCString()
  // Lax = sent on top-level navigation (so external clicks bring UTM in)
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  try {
    return decodeURIComponent(match.split('=').slice(1).join('='))
  } catch {
    return null
  }
}

/* ─── Session ID（30 min sessionStorage TTL）─── */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    const KEY = 'ckm-session-id'
    const TS_KEY = 'ckm-session-ts'
    const TTL = 30 * 60 * 1000 // 30 minutes
    const now = Date.now()
    const lastTs = parseInt(sessionStorage.getItem(TS_KEY) || '0', 10)
    let sid = sessionStorage.getItem(KEY)
    if (!sid || now - lastTs > TTL) {
      sid =
        'sess-' +
        now.toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem(KEY, sid)
    }
    sessionStorage.setItem(TS_KEY, String(now))
    return sid
  } catch {
    return 'sess-fallback'
  }
}

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobi))/.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android.*mobi|blackberry|iemobile|opera mini/.test(ua))
    return 'mobile'
  if (typeof window !== 'undefined' && window.innerWidth >= 768) return 'desktop'
  return 'other'
}

/**
 * 從目前 URL 解析 UTM 參數並儲存：
 *   - lastTouch → sessionStorage (per-session)
 *   - firstTouch → cookie 90 天（只首次設定，後續不覆寫）
 *
 * 設計重點：
 *   - 首次接觸：第一次帶 UTM 進站時鎖定，永久不變（除非 90 天後 cookie 過期）
 *   - 最後接觸：每次帶新 UTM 進站都更新（attribution 報表的 last-touch 模型）
 *   - 訪客直接打 / 沒帶 UTM 進站時不寫，保留前一次值
 *
 * Cookie consent：本函式不檢查 consent。若 cookie banner 還沒同意，
 * caller (layout.tsx) 應在 grantTrackingConsent() 之後才呼叫此函式。
 */
export function parseAndStoreUTM(): UTMParams {
  if (typeof window === 'undefined') return {}

  const url = new URL(window.location.href)
  const params: UTMParams = {}
  const keys: (keyof UTMParams)[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'ref',
  ]
  keys.forEach((key) => {
    const value = url.searchParams.get(key)
    if (value) params[key] = value
  })

  // 即使 URL 沒帶 UTM，仍要記 referrer（外站連入）
  const referrer = typeof document !== 'undefined' ? document.referrer || '' : ''
  const landingPath = url.pathname + url.search

  // 只在 URL 有 UTM 或有外部 referrer 時才寫入 — 避免內部跳轉覆蓋 last-touch
  const hasSignal =
    Object.keys(params).length > 0 ||
    (referrer && !referrer.startsWith(window.location.origin))

  if (hasSignal) {
    const touch: AttributionTouch = {
      utmSource: params.utm_source,
      utmMedium: params.utm_medium,
      utmCampaign: params.utm_campaign,
      utmTerm: params.utm_term,
      utmContent: params.utm_content,
      referrer: referrer || undefined,
      landingPath,
      capturedAt: new Date().toISOString(),
    }

    // sessionStorage = last-touch（每次有 signal 都覆寫）
    try {
      sessionStorage.setItem('ckm-utm', JSON.stringify(params))
      sessionStorage.setItem('ckm-last-touch', JSON.stringify(touch))
    } catch {
      // blocked
    }

    // cookie = first-touch（只首次設定）
    if (!getCookie('ckm-first-touch')) {
      try {
        setCookie('ckm-first-touch', JSON.stringify(touch), 90)
      } catch {
        // blocked
      }
    }
  }

  // 永遠 ensure session ID 存在
  getOrCreateSessionId()

  return params
}

/**
 * 從 sessionStorage 取得 last-touch 的 UTM 參數（向後相容版）
 */
export function getStoredUTM(): UTMParams {
  if (typeof window === 'undefined') return {}
  try {
    const stored = sessionStorage.getItem('ckm-utm')
    return stored ? (JSON.parse(stored) as UTMParams) : {}
  } catch {
    return {}
  }
}

/**
 * 取得當下的完整歸因資料（first + last + session + device）
 * 用於 checkout / register 時隨表單送 server 落庫。
 */
export function getCurrentAttribution(): CurrentAttribution {
  if (typeof window === 'undefined') {
    return { firstTouch: null, lastTouch: null, sessionId: 'ssr', deviceType: 'other' }
  }

  let firstTouch: AttributionTouch | null = null
  let lastTouch: AttributionTouch | null = null

  const ftCookie = getCookie('ckm-first-touch')
  if (ftCookie) {
    try {
      firstTouch = JSON.parse(ftCookie) as AttributionTouch
    } catch {
      firstTouch = null
    }
  }

  try {
    const lt = sessionStorage.getItem('ckm-last-touch')
    if (lt) lastTouch = JSON.parse(lt) as AttributionTouch
  } catch {
    lastTouch = null
  }

  return {
    firstTouch,
    lastTouch,
    sessionId: getOrCreateSessionId(),
    deviceType: detectDeviceType(),
  }
}

/**
 * 觸發 ProductView 事件 → fire-and-forget POST 到 /api/utm/track
 * 在 PDP useEffect mount 時呼叫一次。失敗不擋使用者。
 */
export function trackProductView(productId: string | number, productName?: string) {
  if (typeof window === 'undefined') return
  const attribution = getCurrentAttribution()

  pushDataLayer('view_item', {
    currency: 'TWD',
    items: [{ item_id: String(productId), item_name: productName }],
  })

  // sendBeacon 在 unload 時更可靠；fetch fallback
  const body = JSON.stringify({
    productId,
    sessionId: attribution.sessionId,
    deviceType: attribution.deviceType,
    utmSource: attribution.lastTouch?.utmSource,
    utmMedium: attribution.lastTouch?.utmMedium,
    utmCampaign: attribution.lastTouch?.utmCampaign,
    utmTerm: attribution.lastTouch?.utmTerm,
    utmContent: attribution.lastTouch?.utmContent,
    referrer: attribution.lastTouch?.referrer,
    landingPath: attribution.lastTouch?.landingPath,
  })

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/utm/track', blob)
      return
    }
  } catch {
    // fall through to fetch
  }

  fetch('/api/utm/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'include',
  }).catch(() => {
    // silent fail — 追蹤事件失敗不影響 UX
  })
}

/* ─── 標準電商事件 ─── */

/**
 * PageView — 每頁載入時自動觸發
 */
export function trackPageView(url?: string) {
  const path = url || (typeof window !== 'undefined' ? window.location.pathname : '/')
  pushDataLayer('page_view', { page_path: path })
  fbqTrack('PageView')
}

/**
 * ViewContent — 商品頁
 */
export function trackViewContent(data: ViewContentData) {
  pushDataLayer('view_item', {
    currency: data.currency,
    value: data.value,
    items: [
      {
        item_id: data.content_id,
        item_name: data.content_name,
        item_category: data.content_type,
        price: data.value,
      },
    ],
  })

  fbqTrack('ViewContent', {
    content_ids: [data.content_id],
    content_name: data.content_name,
    content_type: data.content_type,
    value: data.value,
    currency: data.currency,
  })
}

/**
 * AddToCart — 加入購物車
 */
export function trackAddToCart(data: AddToCartData) {
  pushDataLayer('add_to_cart', {
    currency: data.currency,
    value: data.price * data.quantity,
    items: [
      {
        item_id: data.item_id,
        item_name: data.item_name,
        price: data.price,
        quantity: data.quantity,
        item_variant: data.item_variant,
      },
    ],
  })

  fbqTrack('AddToCart', {
    content_ids: [data.item_id],
    content_name: data.item_name,
    content_type: 'product',
    value: data.price * data.quantity,
    currency: data.currency,
  })
}

/**
 * BeginCheckout — 開始結帳
 */
export function trackBeginCheckout(
  items: TrackingItem[],
  value: number,
  currency = 'TWD',
) {
  pushDataLayer('begin_checkout', {
    currency,
    value,
    items,
  })

  fbqTrack('InitiateCheckout', {
    content_ids: items.map((i) => i.item_id),
    num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    value,
    currency,
  })
}

/**
 * Purchase — 結帳成功
 */
export function trackPurchase(data: PurchaseData) {
  pushDataLayer('purchase', {
    transaction_id: data.transaction_id,
    value: data.value,
    currency: data.currency,
    shipping: data.shipping,
    items: data.items,
    membership_tier: data.membership_tier,
  })

  fbqTrack('Purchase', {
    content_ids: data.items.map((i) => i.item_id),
    content_type: 'product',
    num_items: data.items.reduce((sum, i) => sum + i.quantity, 0),
    value: data.value,
    currency: data.currency,
  })

  // Google Ads conversion (透過 GTM 觸發)
  pushDataLayer('conversion', {
    send_to: 'google_ads_conversion',
    value: data.value,
    currency: data.currency,
    transaction_id: data.transaction_id,
  })
}

/* ─── 退款追蹤 ─── */

export function trackRefund(data: {
  transaction_id: string
  value: number
  currency?: string
  items?: TrackingItem[]
}) {
  pushDataLayer('refund', {
    currency: data.currency || 'TWD',
    value: data.value,
    transaction_id: data.transaction_id,
    items: data.items || [],
  })

  // GA4 refund event
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'refund', {
      currency: data.currency || 'TWD',
      value: data.value,
      transaction_id: data.transaction_id,
    })
  }
}

/* ─── Cookie Consent 連動 ─── */

/**
 * 使用者同意 Cookie 後，通知 GTM 更新 consent state
 */
export function grantTrackingConsent() {
  pushDataLayer('consent_update', {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  })

  // 初始化 Google Consent Mode v2
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    })
  }
}

/**
 * 預設拒絕（頁面載入時呼叫，在使用者同意前先設為 denied）
 */
export function setDefaultConsent() {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []

  // Google Consent Mode v2 default
  window.dataLayer.push([
    'consent',
    'default',
    {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    },
  ])
}

/* ─── Server-side CAPI (Meta Conversions API) ─── */

export interface CAPIEventData {
  event_name: string
  event_time: number
  user_data: {
    client_ip_address?: string
    client_user_agent?: string
    em?: string[] // hashed emails
    ph?: string[] // hashed phones
  }
  custom_data?: Record<string, unknown>
  event_source_url?: string
  action_source: 'website'
}

/**
 * 發送 Meta CAPI 事件（Server-side，從 Server Action 或 API Route 呼叫）
 */
export async function sendMetaCAPI(
  pixelId: string,
  accessToken: string,
  events: CAPIEventData[],
) {
  if (!pixelId || !accessToken) return

  const url = `https://graph.facebook.com/v19.0/${pixelId}/events`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: events,
        access_token: accessToken,
      }),
    })

    if (!response.ok) {
      console.error('[CAPI] Error:', await response.text())
    }
  } catch (error) {
    console.error('[CAPI] Fetch error:', error)
  }
}

/* ─── TypeScript 全域型別擴展 ─── */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer: any[]
    fbq: (...args: unknown[]) => void
    gtag: (...args: unknown[]) => void
  }
}
