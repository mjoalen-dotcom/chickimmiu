import { getPayload } from 'payload'

import config from '@payload-config'

const ALBUM_ID = '117824267'
const ALBUM_URL = `https://panel.pixnet.tw/albums/${ALBUM_ID}`
const FOLDER_NAME = `Kim 表情圖案（PIXNET ${ALBUM_ID}）`
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const IMAGE_URLS = [
  'https://pimg.1px.tw/youwin721/1554098494-1584868615.png',
  'https://pimg.1px.tw/youwin721/1442777929-657771109.png',
  'https://pimg.1px.tw/youwin721/1442777928-948031758.png',
  'https://pimg.1px.tw/youwin721/1416848810-3762742312.png',
  'https://pimg.1px.tw/youwin721/1416848810-3463825283.png',
  'https://pimg.1px.tw/youwin721/1416848809-788201588.png',
  'https://pimg.1px.tw/youwin721/1416848809-854371713.png',
  'https://pimg.1px.tw/youwin721/1416848809-1708857433.png',
  'https://pimg.1px.tw/youwin721/1413383653-3881506789.jpg',
  'https://pimg.1px.tw/youwin721/1413383382-542423003.jpg',
  'https://pimg.1px.tw/youwin721/1413383382-2123421760.png',
  'https://pimg.1px.tw/youwin721/1413383382-1104952085.jpg',
  'https://pimg.1px.tw/youwin721/1413383242-896872135.jpg',
  'https://pimg.1px.tw/youwin721/1412730822-2460983750.png',
  'https://pimg.1px.tw/youwin721/1412479571-2251017910.png',
  'https://pimg.1px.tw/youwin721/1407397473-2760421794.png',
  'https://pimg.1px.tw/youwin721/1407152868-3939504772.gif',
  'https://pimg.1px.tw/youwin721/1362070058-1879523416.gif',
  'https://pimg.1px.tw/youwin721/1362070058-4136063479.gif',
  'https://pimg.1px.tw/youwin721/1362070058-1997678197.gif',
  'https://pimg.1px.tw/youwin721/1362070057-3013257037.gif',
  'https://pimg.1px.tw/youwin721/1362070058-389910701.gif',
  'https://pimg.1px.tw/youwin721/1362070057-1846644402.gif',
  'https://pimg.1px.tw/youwin721/1362070057-1843214132.gif',
  'https://pimg.1px.tw/youwin721/1362070057-1732431312.gif',
  'https://pimg.1px.tw/youwin721/1362070056-2834108071.gif',
  'https://pimg.1px.tw/youwin721/1359046999-2688773967.gif',
  'https://pimg.1px.tw/youwin721/1359046999-1527065302.gif',
  'https://pimg.1px.tw/youwin721/1359046999-1577393080.gif',
  'https://pimg.1px.tw/youwin721/1359046999-2472827486.gif',
  'https://pimg.1px.tw/youwin721/1359046998-3354957272.gif',
  'https://pimg.1px.tw/youwin721/1359046998-397744146.gif',
  'https://pimg.1px.tw/youwin721/1359046998-1688924165.gif',
  'https://pimg.1px.tw/youwin721/1342158564-3457558319.gif',
  'https://pimg.1px.tw/youwin721/1342158165-1860007040.gif',
  'https://pimg.1px.tw/youwin721/1316520500-1003292395.jpg',
  'https://pimg.1px.tw/youwin721/770ec5ba1b9f66dd60774f696bde6646.png',
  'https://pimg.1px.tw/youwin721/0b7ca19eb0b85c7e37a685bac067d7b1.jpg',
] as const

const MIME_BY_EXTENSION: Record<string, string> = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
}

function parseArgs(argv: string[]) {
  let dryRun = process.env.KIM_EMOTICON_DRY_RUN === '1'
  for (const value of argv) {
    if (value === '--dry-run') dryRun = true
    else if (value !== '--') throw new Error(`Unknown argument: ${value}`)
  }
  return { dryRun }
}

function sourceMetadata(sourceUrl: string, index: number) {
  const pathname = new URL(sourceUrl).pathname
  const extension = pathname.split('.').pop()?.toLowerCase() || ''
  const mimetype = MIME_BY_EXTENSION[extension]
  if (!mimetype) throw new Error(`Unsupported image extension: ${sourceUrl}`)
  const order = String(index + 1).padStart(3, '0')
  return {
    alt: `金老佛爺表情圖案 ${order}`,
    filename: `kim-emoticon-${ALBUM_ID}-${order}.${extension}`,
    mimetype,
  }
}

async function fetchImage(sourceUrl: string) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/gif,image/jpeg,*/*',
          'User-Agent': 'KimLafayetteBlogMigration/1.0',
        },
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const contentType = response.headers.get('content-type')?.split(';')[0] || ''
      if (!contentType.startsWith('image/')) {
        throw new Error(`Unexpected content type: ${contentType || 'missing'}`)
      }
      const data = Buffer.from(await response.arrayBuffer())
      if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
        throw new Error(`Invalid image size: ${data.length}`)
      }
      return { contentType, data }
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750))
      }
    }
  }
  throw new Error(
    `Failed to fetch ${sourceUrl}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2))
  const metadata = IMAGE_URLS.map(sourceMetadata)
  const filenames = metadata.map((item) => item.filename)
  const payload = dryRun ? null : await getPayload({ config })
  const existing = payload
    ? await payload.find({
        collection: 'media',
        depth: 0,
        limit: 100,
        where: { filename: { in: filenames } },
      })
    : { docs: [] }
  const existingFilenames = new Set(
    existing.docs.map((doc) => String(doc.filename || '')),
  )
  const createdIds: Array<number | string> = []
  let checked = 0
  let created = 0
  let reused = 0
  let totalBytes = 0

  try {
    for (let index = 0; index < IMAGE_URLS.length; index += 1) {
      const sourceUrl = IMAGE_URLS[index]!
      const item = metadata[index]!
      if (existingFilenames.has(item.filename)) {
        reused += 1
        console.log(`reuse ${index + 1}/${IMAGE_URLS.length}: ${item.filename}`)
        continue
      }

      const { contentType, data } = await fetchImage(sourceUrl)
      if (contentType !== item.mimetype) {
        throw new Error(
          `MIME mismatch for ${sourceUrl}: expected ${item.mimetype}, got ${contentType}`,
        )
      }
      checked += 1
      totalBytes += data.length

      if (dryRun) {
        console.log(
          `check ${index + 1}/${IMAGE_URLS.length}: ${item.filename} (${data.length} bytes)`,
        )
        continue
      }

      const media = await payload!.create({
        collection: 'media',
        data: {
          alt: item.alt,
          caption: `PIXNET 表情圖案相簿 ${ALBUM_ID}`,
          folderName: FOLDER_NAME,
        },
        file: {
          data,
          mimetype: item.mimetype,
          name: item.filename,
          size: data.length,
        },
      })
      createdIds.push(media.id)
      created += 1
      console.log(`upload ${index + 1}/${IMAGE_URLS.length}: ${item.filename}`)
    }

    console.log(
      JSON.stringify(
        {
          albumId: ALBUM_ID,
          albumUrl: ALBUM_URL,
          checked,
          created,
          dryRun,
          folderName: FOLDER_NAME,
          images: IMAGE_URLS.length,
          reused,
          totalBytes,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    if (payload && createdIds.length > 0) {
      console.error(`rolling back ${createdIds.length} new media records`)
      for (const id of createdIds.reverse()) {
        try {
          await payload.delete({ collection: 'media', id })
        } catch (rollbackError) {
          console.error(
            `failed to roll back media ${id}: ${
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError)
            }`,
          )
        }
      }
    }
    throw error
  }
}

let exitCode = 0
await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  exitCode = 1
})

// Payload keeps framework resources open after local API work. This script is
// one-shot, so exit only after every download, create, or rollback has finished.
process.exit(exitCode)
