import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { clientIpForRateLimit } from '@/lib/rateLimit'

/**
 * POST /api/newsletter/subscribe  { email, name?, source?, locale? }
 * ──────────────────────────────────────────────────────────────────
 * 前台「訂閱最新消息」表單。任何訪客皆可（不需登入）。
 *
 * 行為：以 email upsert
 *   - 不存在 → 建立（status=subscribed）
 *   - 已存在且 subscribed → 冪等成功（alreadySubscribed）
 *   - 已存在但 unsubscribed → 重新啟用（resubscribed）
 * 若為登入會員訂閱，回連 user 並帶入姓名。
 *
 * 安全：newsletter-subscribers collection create access 是 isAdmin，故走此 server
 * route 以 local API 寫入（overrideAccess 預設 true），避免開放公開 create。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_SOURCES = new Set([
  'homepage',
  'footer',
  'checkout',
  'popup',
  'import',
  'kim-blog',
  'other',
])
const KIM_BLOG_ALLOWED_ORIGINS = new Set([
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
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 12
const rateBucket = new Map<string, number[]>()

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  if (!KIM_BLOG_ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(
  req: NextRequest,
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) })
}


function isRateLimited(ip: string) {
  const now = Date.now()
  const recent = (rateBucket.get(ip) || []).filter(
    (time) => now - time < RATE_WINDOW_MS,
  )
  if (recent.length >= RATE_LIMIT) {
    rateBucket.set(ip, recent)
    return true
  }
  recent.push(now)
  rateBucket.set(ip, recent)
  return false
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || ''
  if (origin && !KIM_BLOG_ALLOWED_ORIGINS.has(origin)) {
    return json(req, { success: false, error: 'origin_not_allowed' }, 403)
  }
  if (isRateLimited(clientIpForRateLimit(req) || '0.0.0.0')) {
    return json(req, { success: false, error: '請稍後再試' }, 429)
  }

  try {
    const payload = await getPayload({ config })

    const body = (await req.json().catch(() => ({}))) as {
      email?: string
      name?: string
      source?: string
      locale?: string
    }

    const email = String(body.email || '').trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      return json(req, { success: false, error: '請輸入正確的 Email' }, 400)
    }

    const source = VALID_SOURCES.has(String(body.source)) ? String(body.source) : 'homepage'
    const isKimBlogSubscription = source === 'kim-blog'
    const name = body.name ? String(body.name).trim().slice(0, 120) : undefined
    const locale = body.locale ? String(body.locale).trim().slice(0, 12) : undefined
    const ipAddress = clientIpForRateLimit(req)
    const now = new Date().toISOString()

    // 若為登入會員，回連 user（best-effort，未登入則跳過）
    let userId: string | number | undefined
    try {
      const { user } = await payload.auth({ headers: req.headers })
      if (user) userId = user.id
    } catch {
      /* 未登入 — 匿名訂閱 */
    }

    const existingRes = await payload.find({
      collection: 'newsletter-subscribers',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
    })

    if (existingRes.totalDocs > 0) {
      const doc = existingRes.docs[0]!
      if (doc.status === 'unsubscribed') {
        await payload.update({
          collection: 'newsletter-subscribers',
          id: String(doc.id),
          data: {
            status: 'subscribed',
            unsubscribedAt: null,
            confirmedAt: now,
            ...(userId && !doc.user ? { user: userId } : {}),
            ...(name && !doc.name ? { name } : {}),
            ...(isKimBlogSubscription
              ? {
                  kimBlogSubscribed: true,
                  kimBlogSubscribedAt: now,
                }
              : {}),
          } as never,
        })
        return json(req, { success: true, resubscribed: true })
      }
      if (isKimBlogSubscription && !doc.kimBlogSubscribed) {
        await payload.update({
          collection: 'newsletter-subscribers',
          id: String(doc.id),
          data: {
            kimBlogSubscribed: true,
            kimBlogSubscribedAt: now,
            ...(userId && !doc.user ? { user: userId } : {}),
            ...(name && !doc.name ? { name } : {}),
          } as never,
        })
        return json(req, { success: true, blogSubscriptionAdded: true })
      }
      // 已訂閱 → 冪等成功
      return json(req, { success: true, alreadySubscribed: true })
    }

    await payload.create({
      collection: 'newsletter-subscribers',
      data: {
        email,
        status: 'subscribed',
        source,
        name,
        locale,
        ipAddress,
        confirmedAt: now,
        kimBlogSubscribed: isKimBlogSubscription,
        ...(isKimBlogSubscription ? { kimBlogSubscribedAt: now } : {}),
        ...(userId ? { user: userId } : {}),
      } as never,
    })

    return json(req, { success: true })
  } catch (error) {
    console.error('[newsletter/subscribe POST] error:', error)
    return json(req, { success: false, error: '訂閱失敗，請稍後再試' }, 500)
  }
}

export function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || ''
  if (!KIM_BLOG_ALLOWED_ORIGINS.has(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}
