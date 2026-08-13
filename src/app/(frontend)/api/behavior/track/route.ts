import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * /api/behavior/track
 * ────────────────────
 * Client → Server 通用消費者行為事件捕獲。從 BehaviorTracker 客端 batch flush 進來。
 *
 * 寫入：collection `behavior-events`（overrideAccess:true）
 *
 * 接受 batch payload（為了 sendBeacon 一次刷一批降低 request 量）：
 *   POST {
 *     events: Array<{
 *       eventType: 'pageview'|'click'|'add_to_cart'|...
 *       sessionId: string                 // 必填
 *       pagePath: string                  // 必填
 *       productId?: number | string
 *       elementKey?: string               // [data-track="..."] 的 key
 *       value?: number
 *       quantity?: number
 *       durationMs?: number
 *       scrollPctMax?: number
 *       searchQuery?: string
 *       utmSource? / utmMedium? / utmCampaign?
 *       referrer? / landingPath?
 *       deviceType?: 'mobile'|'tablet'|'desktop'|'other'
 *       meta?: Record<string, unknown>    // 留 escape hatch
 *     }>
 *   }
 *
 * 限制：
 *   - max 30 事件 / req（防 memory bomb）
 *   - per-IP rate limit：60 req / 1 min（in-memory bucket，多 worker 改 Redis）
 *   - eventType 未在白名單 → drop 該筆，整批仍寫入剩下的
 *   - productId 不存在 → 該筆的 product 留空，整筆仍寫入（避免 PDP race condition 整筆掉）
 *
 * 安全：客端可任意送資料 → 我們不信任 productId 之外的欄位。
 *   攻擊面有限：灌假 click 只汙染儀表板（不影響營收）；rate limit + clip 防 DOS。
 */

interface TrackEventInput {
  eventType?: string
  sessionId?: string
  pagePath?: string
  productId?: number | string
  elementKey?: string
  value?: number
  quantity?: number
  durationMs?: number
  scrollPctMax?: number
  searchQuery?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referrer?: string
  landingPath?: string
  deviceType?: string
  campaignId?: number | string
  ruleKey?: string
  variantId?: string
  surface?: string
  meta?: Record<string, unknown>
}

interface TrackBatchPayload {
  events?: TrackEventInput[]
}

const MAX_EVENTS_PER_REQUEST = 30
const ALLOWED_EVENT_TYPES = new Set([
  'pageview',
  'product_view',
  'click',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'wishlist_add',
  'wishlist_remove',
  'checkout_start',
  'purchase',
  'scroll',
  'dwell',
  // Campaign Engine（P0-D）；promotion_applied/rejected 只由 server 直寫，不開放客端
  'campaign_exposed',
  'campaign_clicked',
  'campaign_eligible',
  'campaign_ineligible',
  'progress_viewed',
  'reward_unlocked',
])
const ALLOWED_DEVICE_TYPES = new Set(['mobile', 'tablet', 'desktop', 'other'])
const ALLOWED_SURFACES = new Set(['home', 'plp', 'pdp', 'cart', 'checkout', 'member', 'complete', 'other'])

// In-memory rate limit: ip → array of timestamps in last 60s
const rateBucket = new Map<string, number[]>()
const RATE_WINDOW_MS = 60 * 1000
const RATE_LIMIT = 60 // requests per IP per window

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = rateBucket.get(ip) || []
  const fresh = arr.filter((t) => now - t < RATE_WINDOW_MS)
  if (fresh.length >= RATE_LIMIT) {
    rateBucket.set(ip, fresh)
    return true
  }
  fresh.push(now)
  rateBucket.set(ip, fresh)
  // 清理：超過 5000 個 IP 就清最舊的 1000
  if (rateBucket.size > 5000) {
    const sorted = Array.from(rateBucket.entries()).sort(
      (a, b) => (a[1][a[1].length - 1] || 0) - (b[1][b[1].length - 1] || 0),
    )
    for (let i = 0; i < 1000; i += 1) rateBucket.delete(sorted[i][0])
  }
  return false
}

function clipString(v: unknown, max = 500): string | undefined {
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

function clipNumber(v: unknown, min = -1_000_000_000, max = 1_000_000_000): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  if (v < min) return min
  if (v > max) return max
  return v
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'

  if (isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  let body: TrackBatchPayload
  try {
    body = (await request.json()) as TrackBatchPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_REQUEST) : []
  if (events.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_events' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // 解析目前使用者一次（同一 batch 共用）
  let userId: number | undefined
  try {
    const authResult = await payload.auth({ headers: request.headers })
    if (authResult?.user?.id) userId = authResult.user.id as number
  } catch {
    // ignore — guest is fine
  }

  const countryCode =
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    undefined
  const countryClipped = countryCode ? countryCode.slice(0, 2).toUpperCase() : undefined

  let written = 0
  let dropped = 0

  for (const ev of events) {
    const eventType = ev.eventType
    const sessionId = clipString(ev.sessionId, 100)
    const pagePath = clipString(ev.pagePath, 500)

    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType) || !sessionId || !pagePath) {
      dropped += 1
      continue
    }

    // 商品事件可能帶 productId — 不阻擋整筆，但無效就清掉
    let productRel: number | undefined
    if (ev.productId != null) {
      try {
        const found = await payload.findByID({
          collection: 'products',
          id: ev.productId as number,
          depth: 0,
        })
        if (found?.id != null) productRel = found.id as number
      } catch {
        productRel = undefined
      }
    }

    const deviceType =
      typeof ev.deviceType === 'string' && ALLOWED_DEVICE_TYPES.has(ev.deviceType)
        ? (ev.deviceType as 'mobile' | 'tablet' | 'desktop' | 'other')
        : undefined

    // Campaign 歸因：campaignId 無效就清掉（與 productId 同策略，不擋整筆）
    let campaignRel: number | undefined
    if (ev.campaignId != null) {
      try {
        const found = await payload.findByID({
          collection: 'marketing-campaigns',
          id: ev.campaignId as number,
          depth: 0,
        })
        if (found?.id != null) campaignRel = found.id as number
      } catch {
        campaignRel = undefined
      }
    }
    const surface =
      typeof ev.surface === 'string' && ALLOWED_SURFACES.has(ev.surface)
        ? (ev.surface as 'home' | 'plp' | 'pdp' | 'cart' | 'checkout' | 'member' | 'complete' | 'other')
        : undefined

    try {
      await payload.create({
        collection: 'behavior-events',
        data: {
          eventType: eventType as
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
            | 'campaign_exposed'
            | 'campaign_clicked'
            | 'campaign_eligible'
            | 'campaign_ineligible'
            | 'progress_viewed'
            | 'reward_unlocked',
          sessionId,
          user: userId,
          pagePath,
          product: productRel,
          elementKey: clipString(ev.elementKey, 100),
          value: clipNumber(ev.value),
          quantity: clipNumber(ev.quantity, 0, 9999),
          durationMs: clipNumber(ev.durationMs, 0, 24 * 60 * 60 * 1000),
          scrollPctMax: clipNumber(ev.scrollPctMax, 0, 100),
          searchQuery: clipString(ev.searchQuery, 200),
          utmSource: clipString(ev.utmSource, 100),
          utmMedium: clipString(ev.utmMedium, 100),
          utmCampaign: clipString(ev.utmCampaign, 200),
          referrer: clipString(ev.referrer, 500),
          landingPath: clipString(ev.landingPath, 500),
          deviceType,
          countryCode: countryClipped,
          campaign: campaignRel,
          ruleKey: clipString(ev.ruleKey, 200),
          variantId: clipString(ev.variantId, 50),
          surface,
          meta: ev.meta && typeof ev.meta === 'object' ? ev.meta : undefined,
        },
        overrideAccess: true,
      })
      written += 1
    } catch (err) {
      payload.logger?.error?.({
        err,
        msg: '[behavior/track] create event failed',
        eventType,
      })
      dropped += 1
    }
  }

  return NextResponse.json({ ok: true, written, dropped }, { status: 201 })
}
