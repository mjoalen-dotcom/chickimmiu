import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { clientIpForRateLimit } from '@/lib/rateLimit'
import { extractBlogSlug, incrementBlogViewCount, shouldCountView } from '@/lib/blog/viewCount'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PATH_PREFIX = 'kim-blog:'
const MAX_EVENTS_PER_REQUEST = 12
const ALLOWED_EVENT_TYPES = new Set(['pageview', 'click', 'scroll', 'dwell'])
const ALLOWED_DEVICE_TYPES = new Set(['mobile', 'tablet', 'desktop', 'other'])
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 90
const rateBucket = new Map<string, number[]>()

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://blog.kimlafayette.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3010',
  'http://127.0.0.1:3010',
  'http://localhost:3011',
  'http://127.0.0.1:3011',
  'http://localhost:3012',
  'http://127.0.0.1:3012',
  'http://localhost:3013',
  'http://127.0.0.1:3013',
])

type TrackEventInput = {
  eventType?: string
  sessionId?: string
  pagePath?: string
  elementKey?: string
  durationMs?: number
  scrollPctMax?: number
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referrer?: string
  landingPath?: string
  deviceType?: string
  meta?: Record<string, unknown>
}

function allowedOrigins() {
  const configured = String(process.env.KIM_BLOG_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])
}

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') || ''
  if (!allowedOrigins().has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(
  request: NextRequest,
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(request),
  })
}


function isRateLimited(ip: string) {
  const now = Date.now()
  const recent = (rateBucket.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    rateBucket.set(ip, recent)
    return true
  }
  recent.push(now)
  rateBucket.set(ip, recent)

  if (rateBucket.size > 5_000) {
    const oldest = [...rateBucket.entries()]
      .sort((left, right) => (left[1][0] || 0) - (right[1][0] || 0))
      .slice(0, 1_000)
    for (const [key] of oldest) rateBucket.delete(key)
  }
  return false
}

function clipString(value: unknown, max: number) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

function clipNumber(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(max, Math.max(min, value))
}

function clipHttpUrl(value: unknown, max: number) {
  const clipped = clipString(value, max)
  if (!clipped) return undefined
  try {
    const url = new URL(clipped)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? clipped
      : undefined
  } catch {
    return undefined
  }
}

async function requestBody(request: NextRequest) {
  const text = await request.text()
  if (!text) return {}
  return JSON.parse(text) as { events?: TrackEventInput[] }
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  if (!allowedOrigins().has(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  if (origin && !allowedOrigins().has(origin)) {
    return json(request, { ok: false, error: 'origin_not_allowed' }, 403)
  }
  if (isRateLimited(clientIpForRateLimit(request))) {
    return json(request, { ok: false, error: 'rate_limited' }, 429)
  }

  let body: { events?: TrackEventInput[] }
  try {
    body = await requestBody(request)
  } catch {
    return json(request, { ok: false, error: 'invalid_json' }, 400)
  }

  const events = Array.isArray(body.events)
    ? body.events.slice(0, MAX_EVENTS_PER_REQUEST)
    : []
  if (events.length === 0) {
    return json(request, { ok: false, error: 'no_events' }, 400)
  }

  const payload = await getPayload({ config })
  const countryCode =
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    undefined
  let written = 0
  let dropped = 0
  let failed = 0

  for (const event of events) {
    const eventType = clipString(event.eventType, 30)
    const sessionId = clipString(event.sessionId, 100)
    const rawPath = clipString(event.pagePath, 480)

    if (
      !eventType ||
      !ALLOWED_EVENT_TYPES.has(eventType) ||
      !sessionId ||
      !rawPath ||
      !rawPath.startsWith('/')
    ) {
      dropped += 1
      continue
    }

    const deviceType =
      typeof event.deviceType === 'string' && ALLOWED_DEVICE_TYPES.has(event.deviceType)
        ? (event.deviceType as 'mobile' | 'tablet' | 'desktop' | 'other')
        : undefined
    const title = clipString(event.meta?.title, 240)
    const articleTitle = clipString(event.meta?.articleTitle, 240)
    const targetUrl = clipHttpUrl(event.meta?.targetUrl, 500)

    try {
      await payload.create({
        collection: 'behavior-events',
        data: {
          eventType: eventType as 'pageview' | 'click' | 'scroll' | 'dwell',
          sessionId,
          pagePath: `${PATH_PREFIX}${rawPath}`,
          elementKey: clipString(event.elementKey, 100),
          durationMs: clipNumber(event.durationMs, 0, 86_400_000),
          scrollPctMax: clipNumber(event.scrollPctMax, 0, 100),
          utmSource: clipString(event.utmSource, 100),
          utmMedium: clipString(event.utmMedium, 100),
          utmCampaign: clipString(event.utmCampaign, 200),
          referrer: clipString(event.referrer, 500),
          landingPath: clipString(event.landingPath, 500),
          deviceType,
          countryCode: countryCode?.slice(0, 2).toUpperCase(),
          meta: {
            site: 'kim_lafayette_blog',
            ...(title ? { title } : {}),
            ...(articleTitle ? { articleTitle } : {}),
            ...(targetUrl ? { targetUrl } : {}),
          },
        },
        overrideAccess: true,
      })
      written += 1

      // 金老佛爺部落格（靜態站）的文章閱讀也要計進 blog-posts.viewCount。
      // 路徑形如 /blog/5069384750/，那串數字就是 slug。
      // 只認 pageview；同一 session 同一篇在視窗內只計一次。
      // 失敗不影響事件已寫入的結果，所以獨立 try。
      if (eventType === 'pageview') {
        const blogSlug = extractBlogSlug(rawPath)
        if (blogSlug && shouldCountView(`kim:${sessionId}:${blogSlug}`)) {
          try {
            await incrementBlogViewCount(payload, blogSlug)
          } catch (err) {
            payload.logger.warn({
              err,
              msg: '[kim-blog/analytics] viewCount 遞增失敗',
              slug: blogSlug,
            })
          }
        }
      }
    } catch (error) {
      payload.logger.error({
        err: error,
        msg: '[kim-blog/analytics] create event failed',
      })
      failed += 1
    }
  }

  if (written === 0 && failed > 0) {
    return json(request, { ok: false, error: 'analytics_unavailable', written, dropped }, 503)
  }
  return json(request, { ok: true, written, dropped }, 201)
}
