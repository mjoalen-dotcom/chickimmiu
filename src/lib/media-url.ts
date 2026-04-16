/**
 * Extract media URL from a Payload upload field and normalise path.
 *
 * Payload stores URLs like `/api/media/file/hero-1.webp`.
 * Through certain proxies (e.g. Cloudflare Tunnel) the API endpoint
 * may fail for binary responses.  Since every uploaded file also lives
 * in `public/media/`, we rewrite the path to `/media/<filename>` so
 * Next.js serves the file statically — faster and more reliable.
 */
/**
 * Normalise a raw media URL — rewrite API paths to static paths.
 */
export function normalizeMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('/api/media/file/')) {
    return '/media/' + url.slice('/api/media/file/'.length)
  }
  return url
}

export function getMediaUrl(field: unknown): string | undefined {
  if (!field) return undefined

  let url: string | undefined
  if (typeof field === 'object' && field !== null && 'url' in field) {
    url = (field as { url?: string }).url ?? undefined
  }
  if (typeof field === 'string') {
    url = field
  }

  if (!url) return undefined

  // Rewrite Payload API media path → static /media/ path
  if (url.startsWith('/api/media/file/')) {
    return '/media/' + url.slice('/api/media/file/'.length)
  }

  return url
}
