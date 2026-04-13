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

/**
 * 從目前 URL 解析 UTM 參數並儲存到 sessionStorage
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

  if (Object.keys(params).length > 0) {
    try {
      sessionStorage.setItem('ckm-utm', JSON.stringify(params))
    } catch {
      // sessionStorage blocked
    }
  }

  return params
}

/**
 * 從 sessionStorage 取得已儲存的 UTM 參數
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
