import { getPayload } from 'payload'

import config from '@payload-config'
import { getVersionedMediaUrl } from '@/lib/media-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

function noStoreRedirect(target: string) {
  return new Response(null, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Expires: '0',
      Location: target,
      Pragma: 'no-cache',
    },
  })
}

/**
 * Stable admin favicon entrypoint.
 *
 * Payload's admin metadata is configured synchronously, so it cannot read a
 * Global at build time. This endpoint resolves the current relationship on
 * every request and redirects to its versioned media URL. The redirect itself
 * is never cached; the content-addressed destination can remain immutable.
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'global-settings', depth: 1 })
    const site = (settings as { site?: { favicon?: unknown } }).site
    const faviconUrl = getVersionedMediaUrl(site?.favicon)
    if (faviconUrl) return noStoreRedirect(faviconUrl)
  } catch {
    // Keep the admin usable while the database is temporarily unavailable.
  }

  return noStoreRedirect('/favicon.ico')
}
