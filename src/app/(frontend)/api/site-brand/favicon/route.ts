import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@payload-config'
import { getVersionedMediaUrl } from '@/lib/media-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

function noStoreRedirect(request: Request, target: string) {
  const response = NextResponse.redirect(new URL(target, request.url), 307)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

/**
 * Stable admin favicon entrypoint.
 *
 * Payload's admin metadata is configured synchronously, so it cannot read a
 * Global at build time. This endpoint resolves the current relationship on
 * every request and redirects to its versioned media URL. The redirect itself
 * is never cached; the content-addressed destination can remain immutable.
 */
export async function GET(request: Request) {
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'global-settings', depth: 1 })
    const site = (settings as { site?: { favicon?: unknown } }).site
    const faviconUrl = getVersionedMediaUrl(site?.favicon)
    if (faviconUrl) return noStoreRedirect(request, faviconUrl)
  } catch {
    // Keep the admin usable while the database is temporarily unavailable.
  }

  return noStoreRedirect(request, '/favicon.ico')
}
