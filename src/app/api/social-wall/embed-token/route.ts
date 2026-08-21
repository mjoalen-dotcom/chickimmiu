import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { isWidgetHostAllowed, normalizeWidgetHost } from '@/lib/social-wall/domain-policy'
import { signEmbedToken, SOCIAL_WALL_DEVELOPMENT_SECRET } from '@/lib/social-wall/embed-token'

export const dynamic = 'force-dynamic'

function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

function requestOriginMatchesHost(request: NextRequest, origin: string | null, expectedHost: string): boolean {
  if (!origin) {
    const referrer = request.headers.get('referer')
    if (request.headers.get('sec-fetch-site') !== 'same-origin' || !referrer) return false
    try {
      return normalizeWidgetHost(referrer) === expectedHost
    } catch {
      return false
    }
  }
  try {
    return normalizeWidgetHost(origin) === expectedHost
  } catch {
    return false
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const widgetPublicId = request.nextUrl.searchParams.get('widget')?.trim() || ''
  const requestedHostInput = request.nextUrl.searchParams.get('host')?.trim() || ''

  if (!widgetPublicId || !requestedHostInput) {
    return NextResponse.json({ error: '缺少 widget 或 host' }, { status: 400, headers: corsHeaders(origin) })
  }

  let requestedHost: string
  try {
    requestedHost = normalizeWidgetHost(requestedHostInput)
  } catch {
    return NextResponse.json({ error: '網域格式無效' }, { status: 400, headers: corsHeaders(origin) })
  }

  if (!requestOriginMatchesHost(request, origin, requestedHost)) {
    return NextResponse.json({ error: '請求來源與網域不一致' }, { status: 403, headers: corsHeaders(origin) })
  }

  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  const secret = process.env.SOCIAL_WALL_EMBED_SECRET || (environment === 'development' ? SOCIAL_WALL_DEVELOPMENT_SECRET : '')
  if (!secret) {
    return NextResponse.json({ error: '嵌入簽章服務尚未設定' }, { status: 503, headers: corsHeaders(origin) })
  }

  let allowedPatterns: string[] = []
  let widgetId = widgetPublicId

  if (environment === 'development' && widgetPublicId === 'kim-lafayette-demo') {
    allowedPatterns = [requestedHost]
  } else {
    try {
      const payload = await getPayload({ config })
      const widgets = await payload.find({
        collection: 'social-wall-widgets',
        where: { and: [{ publicId: { equals: widgetPublicId } }, { status: { equals: 'published' } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const widget = widgets.docs[0] as unknown as Record<string, unknown> | undefined
      if (!widget) throw new Error('widget_not_found')
      widgetId = String(widget.publicId)

      const licenses = await payload.find({
        collection: 'social-wall-licenses',
        where: {
          and: [
            { widget: { equals: widget.id } },
            { status: { equals: 'active' } },
            { or: [{ expiresAt: { exists: false } }, { expiresAt: { greater_than: new Date().toISOString() } }] },
          ],
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      allowedPatterns = licenses.docs
        .map((license) => String((license as unknown as Record<string, unknown>).hostPattern || ''))
        .filter(Boolean)

      const ownerId = relationId(widget.owner)
      if (ownerId === null) throw new Error('widget_owner_missing')

      const subscriptions = await payload.find({
        collection: 'social-wall-subscriptions',
        where: { owner: { equals: ownerId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const subscription = subscriptions.docs[0] as unknown as Record<string, unknown> | undefined
      if (!subscription || !['active', 'trialing'].includes(String(subscription.status))) {
        throw new Error('subscription_inactive')
      }
      if (subscription.plan !== 'free' && (!subscription.currentPeriodEnd || new Date(String(subscription.currentPeriodEnd)).getTime() <= Date.now())) {
        throw new Error('subscription_expired')
      }
    } catch {
      return NextResponse.json({ error: '找不到可用的社群牆授權' }, { status: 404, headers: corsHeaders(origin) })
    }
  }

  if (!isWidgetHostAllowed(requestedHost, allowedPatterns, { environment })) {
    return NextResponse.json({ error: '此網域未取得授權' }, { status: 403, headers: corsHeaders(origin) })
  }

  const token = signEmbedToken({
    widgetId,
    host: requestedHost,
    secret,
    now: Math.floor(Date.now() / 1000),
    ttlSeconds: 300,
  })
  const embedUrl = new URL(`/embed/${encodeURIComponent(widgetId)}`, request.nextUrl.origin)
  embedUrl.searchParams.set('token', token)
  embedUrl.searchParams.set('host', requestedHost)

  return NextResponse.json(
    { token, expiresIn: 300, embedUrl: embedUrl.toString() },
    { status: 200, headers: { ...corsHeaders(origin), 'Cache-Control': 'no-store, private' } },
  )
}
