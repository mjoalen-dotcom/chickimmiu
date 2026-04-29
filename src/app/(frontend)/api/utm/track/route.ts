import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * /api/utm/track
 * ──────────────
 * Client → Server UTM 商品瀏覽事件捕獲。從 PDP `trackProductView()` 呼叫。
 *
 * 寫入：collection `product-view-events` (overrideAccess:true)
 *
 * Payload schema：
 *   POST {
 *     productId: number | string  // 必填
 *     sessionId: string           // 必填
 *     deviceType: string          // 選填
 *     utmSource / utmMedium / utmCampaign / utmTerm / utmContent
 *     referrer / landingPath
 *   }
 *
 * 限流：單一 sessionId × 單一 product 30 秒內僅記 1 筆（reload 不灌爆 DB）。
 *      用 in-memory Map 做（單機 SQLite OK）；多 worker 改 Redis。
 *
 * 安全：客端可任意送資料 → 我們不信任 productId 之外的欄位。
 *      productId 用 payload.findByID 確認存在，否則 400。
 *      其他欄位（sessionId / utm*）為 client-controlled string，但攻擊面有限：
 *        - 灌假 UTM 只影響行銷報表（不影響營收 / 帳號）
 *        - 攻擊者要灌大量需穿透 CDN + rate limit；視之為低風險
 */

interface TrackPayload {
  productId?: number | string
  sessionId?: string
  deviceType?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  referrer?: string
  landingPath?: string
}

// In-memory dedup: key = `${sessionId}:${productId}`, value = last write timestamp
const recentWrites = new Map<string, number>()
const DEDUP_WINDOW_MS = 30 * 1000

function shouldDedupe(key: string): boolean {
  const now = Date.now()
  const last = recentWrites.get(key)
  if (last && now - last < DEDUP_WINDOW_MS) return true
  recentWrites.set(key, now)
  // 簡單清理：超過 1000 條就刪掉最舊的 200 條
  if (recentWrites.size > 1000) {
    const entries = Array.from(recentWrites.entries()).sort((a, b) => a[1] - b[1])
    for (let i = 0; i < 200; i += 1) recentWrites.delete(entries[i][0])
  }
  return false
}

function clipString(v: unknown, max = 500): string | undefined {
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

const ALLOWED_DEVICE_TYPES = new Set(['mobile', 'tablet', 'desktop', 'other'])

export async function POST(request: NextRequest) {
  let body: TrackPayload
  try {
    body = (await request.json()) as TrackPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const productIdRaw = body.productId
  const sessionId = clipString(body.sessionId, 100)
  if (!productIdRaw || !sessionId) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }

  // Dedup check before payload init (cheap)
  const dedupeKey = `${sessionId}:${productIdRaw}`
  if (shouldDedupe(dedupeKey)) {
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 })
  }

  const payload = await getPayload({ config })

  // Validate product exists
  let productId: number
  try {
    const productCheck = await payload.findByID({
      collection: 'products',
      id: productIdRaw as number,
      depth: 0,
    })
    if (!productCheck) {
      return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 400 })
    }
    productId = productCheck.id as number
  } catch {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 400 })
  }

  // Resolve current user (optional, may be guest)
  let userId: number | undefined
  try {
    const authResult = await payload.auth({ headers: request.headers })
    if (authResult?.user?.id) userId = authResult.user.id as number
  } catch {
    // ignore — guest is fine
  }

  const deviceType = body.deviceType
  type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'other'
  const sanitizedDevice: DeviceType | undefined =
    typeof deviceType === 'string' && ALLOWED_DEVICE_TYPES.has(deviceType)
      ? (deviceType as DeviceType)
      : undefined

  // Country from CDN headers (Cloudflare adds CF-IPCountry; Hetzner direct doesn't)
  const countryCode =
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    undefined

  try {
    const event = await payload.create({
      collection: 'product-view-events',
      data: {
        product: productId,
        sessionId,
        user: userId,
        utmSource: clipString(body.utmSource, 100),
        utmMedium: clipString(body.utmMedium, 100),
        utmCampaign: clipString(body.utmCampaign, 200),
        utmTerm: clipString(body.utmTerm, 200),
        utmContent: clipString(body.utmContent, 200),
        referrer: clipString(body.referrer, 500),
        landingPath: clipString(body.landingPath, 500),
        deviceType: sanitizedDevice,
        countryCode: countryCode ? countryCode.slice(0, 2).toUpperCase() : undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true, eventId: event.id }, { status: 201 })
  } catch (err) {
    payload.logger?.error?.({
      err,
      msg: '[utm/track] create event failed',
    })
    return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 })
  }
}
