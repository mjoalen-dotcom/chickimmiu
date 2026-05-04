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
 *
 * eventID — 給 server-side CAPI 對齊用，Meta 會用 (event_name, event_id) 雙鍵去重。
 * 客戶端 Pixel + 伺服器 CAPI 帶同一個 eventID 才不會被算兩次 conversion。
 */
function fbqTrack(
  event: string,
  data: Record<string, unknown> = {},
  eventID?: string,
) {
  if (typeof window === 'undefined') return
  if (typeof window.fbq === 'function') {
    if (eventID) {
      window.fbq('track', event, data, { eventID })
    } else {
      window.fbq('track', event, data)
    }
  }
  debugLog(`fbq:${event}${eventID ? `(eid=${eventID})` : ''}`, data)
}

/* ─── eventID + Meta cookies (CAPI 雙線去重) ─── */

/**
 * 用訂單編號組去重 ID — 跟 server CAPI 對齊。
 * 同一張訂單若客戶端不慎重複觸發 fbq Purchase（雙擊「完成下單」、SPA 路由 race），
 * Meta 會以 (Purchase, purchase_<orderNumber>) 識別為同一事件。
 */
export function purchaseEventId(orderNumber: string): string {
  return `purchase_${orderNumber}`
}

/**
 * 讀 Meta `_fbp` cookie（Pixel 寫入，per-browser unique）。
 */
export function getFbp(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

/**
 * 讀 Meta `_fbc` cookie。若 cookie 不存在但 URL 有 `fbclid`，依 Meta 規則合成。
 * 格式：fb.<subdomain_index>.<creation_time_ms>.<fbclid>
 *   subdomain_index 對 chickimmiu.com 取 1
 */
export function getFbc(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const cookieMatch = document.cookie.match(/(?:^|;\s*)_fbc=([^;]+)/)
  if (cookieMatch) return decodeURIComponent(cookieMatch[1])

  if (typeof window !== 'undefined') {
    const fbclid = new URL(window.location.href).searchParams.get('fbclid')
    if (fbclid) return `fb.1.${Date.now()}.${fbclid}`
  }
  return undefined
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
 *
 * eventID — 客戶端 fbq + 伺服器 CAPI 對齊去重用，建議用 purchaseEventId(orderNumber)。
 * 不傳會降級成單線（只有客戶端 Pixel，無 CAPI dedup）。
 */
export function trackPurchase(data: PurchaseData, eventID?: string) {
  pushDataLayer('purchase', {
    transaction_id: data.transaction_id,
    value: data.value,
    currency: data.currency,
    shipping: data.shipping,
    items: data.items,
    membership_tier: data.membership_tier,
  })

  fbqTrack(
    'Purchase',
    {
      content_ids: data.items.map((i) => i.item_id),
      content_type: 'product',
      num_items: data.items.reduce((sum, i) => sum + i.quantity, 0),
      value: data.value,
      currency: data.currency,
    },
    eventID,
  )

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
  /**
   * 跟客戶端 fbq 的 `eventID` 對齊（同名雙線去重的關鍵）。
   * Meta 用 (event_name, event_id) 去重，不傳 = 雙倍計算。
   */
  event_id?: string
  user_data: {
    client_ip_address?: string
    client_user_agent?: string
    em?: string[] // SHA-256 hashed emails (lowercased trimmed)
    ph?: string[] // SHA-256 hashed phones (digits only, +國碼)
    fbp?: string // _fbp cookie
    fbc?: string // _fbc cookie 或 fb.<sub>.<ts>.<fbclid>
  }
  custom_data?: Record<string, unknown>
  event_source_url?: string
  action_source: 'website'
}

/**
 * 發送 Meta CAPI 事件（Server-side，從 Server Action 或 API Route 呼叫）
 *
 * @param testEventCode  Meta 後台 Events Manager → 測試事件 工具的 code，
 *                       設了會把事件 routed 到測試介面而不影響正式 conversion。
 *                       prod 啟用前用這個驗 payload 結構正確 + dedup 真有對到。
 */
export async function sendMetaCAPI(
  pixelId: string,
  accessToken: string,
  events: CAPIEventData[],
  testEventCode?: string,
) {
  if (!pixelId || !accessToken) return

  const url = `https://graph.facebook.com/v19.0/${pixelId}/events`

  const body: Record<string, unknown> = {
    data: events,
    access_token: accessToken,
  }
  if (testEventCode) body.test_event_code = testEventCode

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error('[CAPI] Error:', await response.text())
    } else if (process.env.NODE_ENV === 'development') {
      console.log(
        '[CAPI] sent',
        events.length,
        'events',
        testEventCode ? `(test_event_code=${testEventCode})` : '',
      )
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
