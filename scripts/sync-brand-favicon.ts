/**
 * Upload the tracked storefront favicon as a content-addressed Media record
 * and wire GlobalSettings.site.favicon to it.
 *
 * The previous deployment replaced `public/media/favicon-192.png` in place,
 * leaving Media metadata and long-lived browser caches stale. This script is
 * additive and idempotent: the filename contains the file hash, the old Media
 * record is retained for rollback, and only the favicon relationship changes.
 *
 * Usage:
 *   pnpm sync:brand:favicon:dry
 *   pnpm sync:brand:favicon
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { getPayload } from 'payload'

import config from '../src/payload.config'

const DRY_RUN = process.argv.includes('--dry-run')
const SOURCE_PATH = path.join(process.cwd(), 'public', 'icon-192.png')
const ALT = 'CHIC KIM & MIU Favicon'

function log(message: string) {
  process.stderr.write(`[syncBrandFavicon] ${message}\n`)
}

function relationshipId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

const keepAlive = setInterval(() => {}, 60_000)

async function main() {
  if (!fs.existsSync(SOURCE_PATH)) throw new Error(`source missing: ${SOURCE_PATH}`)

  const data = fs.readFileSync(SOURCE_PATH)
  const hash = createHash('sha256').update(data).digest('hex')
  const filename = `favicon-${hash.slice(0, 16)}.png`
  const payload = await getPayload({ config })
  const current = await payload.findGlobal({ slug: 'global-settings', depth: 0 })
  const site = ((current as unknown as Record<string, unknown>).site || {}) as Record<string, unknown>
  const previousId = relationshipId(site.favicon)

  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
  })

  log(`source=${SOURCE_PATH}`)
  log(`sha256=${hash}`)
  log(`target=${filename} (${data.length} bytes)`)
  log(`current site.favicon=${previousId ?? 'none'}`)

  if (DRY_RUN) {
    log(existing.docs.length > 0 ? `DRY reuse media id=${existing.docs[0].id}` : 'DRY create media')
    log('DRY update GlobalSettings.site.favicon')
    return
  }

  let mediaId: number | string
  if (existing.docs.length > 0) {
    mediaId = existing.docs[0].id
    log(`reuse media id=${mediaId}`)
  } else {
    const media = await (payload.create as (args: unknown) => Promise<{ id: number | string }>)({
      collection: 'media',
      data: { alt: ALT },
      file: {
        data,
        mimetype: 'image/png',
        name: filename,
        size: data.length,
      },
    })
    mediaId = media.id
    log(`created media id=${mediaId}`)
  }

  if (String(previousId) === String(mediaId)) {
    log('GlobalSettings.site.favicon already current')
    return
  }

  await payload.updateGlobal({
    slug: 'global-settings',
    data: {
      site: {
        ...site,
        favicon: mediaId,
      },
    } as unknown as Parameters<typeof payload.updateGlobal>[0]['data'],
  })

  log(`updated GlobalSettings.site.favicon: ${previousId ?? 'none'} -> ${mediaId}`)
  log(`rollback value: ${previousId ?? 'none'}`)
}

await main()
  .then(() => {
    clearInterval(keepAlive)
    process.exit(0)
  })
  .catch((error: unknown) => {
    clearInterval(keepAlive)
    log(`FATAL: ${error instanceof Error ? error.stack || error.message : String(error)}`)
    process.exit(1)
  })
