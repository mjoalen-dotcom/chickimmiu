import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
const CACHE_TTL_MS = 15 * 60 * 1000

type InstagramApiItem = {
  id?: string
  caption?: string
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
}

type PublicInstagramItem = {
  id: string
  caption?: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  mediaUrl: string
  thumbnailUrl?: string
  permalink: string
  timestamp?: string
}

let cache: { expiresAt: number; items: PublicInstagramItem[] } | null = null

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function response(request: NextRequest, body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...corsHeaders(request),
      'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
    },
  })
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  if (!allowedOrigins().has(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  if (origin && !allowedOrigins().has(origin)) {
    return response(request, { configured: false, items: [] }, 403)
  }

  const userId = String(process.env.KIM_INSTAGRAM_USER_ID || '').trim()
  const accessToken = String(process.env.KIM_INSTAGRAM_ACCESS_TOKEN || '').trim()
  if (!userId || !accessToken) {
    return response(request, { configured: false, items: [] })
  }

  if (cache && cache.expiresAt > Date.now()) {
    return response(request, { configured: true, items: cache.items })
  }

  const apiBase = String(process.env.KIM_INSTAGRAM_API_BASE || 'https://graph.instagram.com')
    .replace(/\/$/, '')
  const version = String(process.env.KIM_INSTAGRAM_GRAPH_VERSION || 'v25.0').replace(/^\/|\/$/g, '')
  const fields = [
    'id',
    'caption',
    'media_type',
    'media_url',
    'thumbnail_url',
    'permalink',
    'timestamp',
  ].join(',')
  const url = new URL(`${apiBase}/${version}/${encodeURIComponent(userId)}/media`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('limit', '32')

  try {
    const graphResponse = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })
    if (!graphResponse.ok) {
      const errorText = (await graphResponse.text()).slice(0, 500)
      console.error(`[kim-blog/instagram] Meta API ${graphResponse.status}: ${errorText}`)
      return response(request, { configured: true, items: [], error: 'temporarily_unavailable' })
    }

    const result = (await graphResponse.json()) as { data?: InstagramApiItem[] }
    const items = (Array.isArray(result.data) ? result.data : [])
      .filter(
        (item): item is Required<Pick<InstagramApiItem, 'id' | 'media_type' | 'media_url' | 'permalink'>> &
          InstagramApiItem =>
          Boolean(item.id && item.media_type && item.media_url && item.permalink),
      )
      .slice(0, 32)
      .map((item) => ({
        id: item.id,
        caption: item.caption?.slice(0, 500),
        mediaType: item.media_type,
        mediaUrl: item.media_url,
        thumbnailUrl: item.thumbnail_url,
        permalink: item.permalink,
        timestamp: item.timestamp,
      }))

    cache = { expiresAt: Date.now() + CACHE_TTL_MS, items }
    return response(request, { configured: true, items })
  } catch (error) {
    console.error('[kim-blog/instagram] request failed', error)
    return response(request, { configured: true, items: [], error: 'temporarily_unavailable' })
  }
}
