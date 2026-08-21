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

/**
 * Return a cache-safe media URL for assets whose relationship can be replaced
 * in Payload while keeping the same filename (favicon, Apple Touch icon, etc.).
 *
 * `/media/*` is intentionally immutable for one year. Appending the Media
 * document's timestamp gives browsers a new URL whenever Payload updates the
 * file, while preserving the long-cache policy for every historical version.
 */
export function getVersionedMediaUrl(field: unknown): string | undefined {
  const url = getMediaUrl(field)
  if (!url || typeof field !== 'object' || field === null) return url

  const media = field as { createdAt?: unknown; id?: unknown; updatedAt?: unknown }
  const versionCandidate = media.updatedAt ?? media.createdAt ?? media.id
  if (typeof versionCandidate !== 'string' && typeof versionCandidate !== 'number') {
    return url
  }

  const version = String(versionCandidate).trim()
  if (!version) return url

  const hashIndex = url.indexOf('#')
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  const fragment = hashIndex >= 0 ? url.slice(hashIndex) : ''
  const separator = base.includes('?') ? '&' : '?'

  return `${base}${separator}v=${encodeURIComponent(version)}${fragment}`
}
