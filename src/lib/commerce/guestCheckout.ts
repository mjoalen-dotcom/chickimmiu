/**
 * 訪客結帳共用邏輯（純函式，無 payload 依賴 — 可單元測試）
 * ────────────────────────────────────────────────────
 * 設計取捨見 migrations/20260814_120000_add_guest_checkout.ts：
 * 每筆訪客訂單建立一個 `isGuest` 臨時會員（合成信箱），真實聯絡信箱存在
 * orders.guestEmail。好處是「訂單一定有 customer」這個全站假設不必動，
 * 壞處是會多出臨時帳號 —— 用 isGuest 標記把它們排除在會員名單之外。
 *
 * ⚠️ 刻意不查「這個 email 是不是既有會員」：查了就等於提供帳號列舉
 * （enumeration）介面，而且合成信箱本來就不會跟會員信箱衝突。忘記登入的
 * 會員會拿到一筆不在會員中心的訂單 —— 前台用「登入後可累積點數」提示處理。
 */

/** 訪客臨時帳號的信箱網域（RFC 2606 保留，永不可投遞） */
export const GUEST_EMAIL_DOMAIN = 'guest.invalid'

/** 產生訪客臨時帳號用的合成信箱（唯一，不可投遞） */
export function syntheticGuestEmail(uniqueRef: string): string {
  return `guest_${uniqueRef}`.toLowerCase().replace(/[^a-z0-9_-]/g, '') + `@${GUEST_EMAIL_DOMAIN}`
}

export function isSyntheticGuestEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`))
}

export interface GuestCheckoutItem {
  productId: number | string
  sku?: string | null
  variantText?: string | null
  quantity: number
  isGift?: boolean
  giftRuleRef?: number | string | null
  isAddOn?: boolean
  addOnRuleRef?: number | string | null
  bundleRef?: number | string | null
}

export interface GuestCheckoutAddress {
  recipientName: string
  phone: string
  address: string
  city: string
  district?: string
  zipCode?: string
}

/** UTM 歸因（欄位白名單，避免 client 亂塞欄位進 Orders.attribution） */
export interface GuestCheckoutTouch {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  referrer?: string
}

export interface GuestCheckoutInput {
  email: string
  items: GuestCheckoutItem[]
  couponCodes: string[]
  shippingMethodId: number | string | null
  paymentMethod: string
  shippingAddress: GuestCheckoutAddress
  customerNote?: string
  attribution?: { firstTouch?: GuestCheckoutTouch; lastTouch?: GuestCheckoutTouch }
}

const TOUCH_KEYS = [
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmTerm',
  'utmContent',
  'referrer',
] as const

export type GuestCheckoutValidation =
  | { ok: true; value: GuestCheckoutInput }
  | { ok: false; errors: string[] }

// 刻意保守：擋掉明顯打錯的（沒有 @、沒有網域點、含空白），不追求 RFC 完整性
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** 訪客結帳送單的輸入驗證（金額一律不看 —— 價格由 server 重算） */
export function validateGuestCheckoutInput(body: unknown): GuestCheckoutValidation {
  const errors: string[] = []
  const b = (body ?? {}) as Record<string, unknown>

  const email = asText(b.email).toLowerCase()
  if (!email) errors.push('email_required')
  else if (!EMAIL_RE.test(email)) errors.push('email_invalid')
  else if (isSyntheticGuestEmail(email)) errors.push('email_invalid')

  const rawItems = Array.isArray(b.items) ? (b.items as Array<Record<string, unknown>>) : []
  const items: GuestCheckoutItem[] = []
  for (const raw of rawItems) {
    const productId = (raw?.productId ?? null) as number | string | null
    const quantity = Math.floor(Number(raw?.quantity))
    if (productId == null || productId === '' || !Number.isFinite(quantity) || quantity <= 0) continue
    items.push({
      productId,
      sku: typeof raw.sku === 'string' ? raw.sku : null,
      variantText: typeof raw.variantText === 'string' ? raw.variantText : null,
      quantity,
      isGift: Boolean(raw.isGift),
      giftRuleRef: (raw.giftRuleRef ?? null) as number | string | null,
      isAddOn: Boolean(raw.isAddOn),
      addOnRuleRef: (raw.addOnRuleRef ?? null) as number | string | null,
      bundleRef: (raw.bundleRef ?? null) as number | string | null,
    })
  }
  if (items.length === 0) errors.push('items_required')

  const addr = (b.shippingAddress ?? {}) as Record<string, unknown>
  const shippingAddress: GuestCheckoutAddress = {
    recipientName: asText(addr.recipientName),
    phone: asText(addr.phone),
    address: asText(addr.address),
    city: asText(addr.city),
    district: asText(addr.district) || undefined,
    zipCode: asText(addr.zipCode) || undefined,
  }
  if (!shippingAddress.recipientName) errors.push('recipient_name_required')
  if (!shippingAddress.phone) errors.push('phone_required')
  // 超商取貨 / 面交由前台把門市或取貨地點塞進 address + city，這裡只要求非空
  if (!shippingAddress.address) errors.push('address_required')
  if (!shippingAddress.city) errors.push('city_required')

  const paymentMethod = asText(b.paymentMethod)
  if (!paymentMethod) errors.push('payment_method_required')

  const couponCodes = Array.isArray(b.couponCodes)
    ? (b.couponCodes as unknown[]).map((c) => asText(c)).filter(Boolean)
    : []

  const rawShippingId = b.shippingMethodId
  const shippingMethodId =
    rawShippingId === '' || rawShippingId == null ? null : (rawShippingId as number | string)

  // UTM：只搬白名單內的字串欄位（其餘一律丟棄）
  const pick = <K extends readonly string[]>(src: unknown, keys: K): Record<string, string> | undefined => {
    if (!src || typeof src !== 'object') return undefined
    const s = src as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const k of keys) {
      const v = asText(s[k])
      if (v) out[k] = v
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  const firstTouch = pick((b.attribution as Record<string, unknown> | undefined)?.firstTouch, TOUCH_KEYS)
  const lastTouch = pick((b.attribution as Record<string, unknown> | undefined)?.lastTouch, TOUCH_KEYS)

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      email,
      items,
      couponCodes,
      shippingMethodId,
      paymentMethod,
      shippingAddress,
      customerNote: asText(b.customerNote) || undefined,
      attribution: firstTouch || lastTouch ? { firstTouch, lastTouch } : undefined,
    },
  }
}
