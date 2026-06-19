import { createClient } from '@libsql/client'
import { createHash } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_URL = 'https://www.chickimmiu.com/pages/ckmupackaging'
const PAGE_SLUG = 'ckmupackaging'
const PAGE_TITLE = '商品包裝'
const FOLDER_NAME = 'ckmu-page-ckmupackaging'

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const dryRun = args.has('--dry-run') || !apply
const dbUrl = getArg('--db') || process.env.DATABASE_URI || 'file:./data/chickimmiu.db'
const mediaDir = getArg('--media-dir') || 'public/media'
const downloadMedia = apply && !args.has('--skip-download-media')
const now = new Date().toISOString()

function getArg(name) {
  const prefix = `${name}=`
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : undefined
}

function hashId(value, len = 24) {
  return createHash('sha1').update(String(value)).digest('hex').slice(0, len)
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
}

function attr(html, name) {
  const re = new RegExp(`${name}=["']([^"']*)["']`, 'i')
  const match = String(html || '').match(re)
  return match ? decodeEntities(match[1]) : ''
}

function cleanUrl(url) {
  return decodeEntities(String(url || '')).trim()
}

function highestSrcsetUrl(pictureHtml) {
  const candidates = []
  for (const source of String(pictureHtml || '').matchAll(/<source\b[\s\S]*?>/gi)) {
    const srcset = attr(source[0], 'srcset')
    for (const part of srcset.split(',')) {
      const match = part.trim().match(/^(\S+)\s+(\d+)w$/)
      if (match) candidates.push({ url: cleanUrl(match[1]), width: Number(match[2]) })
    }
  }
  candidates.sort((a, b) => b.width - a.width)
  return candidates[0]?.url || ''
}

function extractContentHtml(html) {
  const start = html.indexOf('<div id="Content"')
  const end = html.indexOf('<!-- END content_for_index -->')
  if (start < 0 || end <= start) {
    throw new Error('Could not find Shopline custom page content scope')
  }
  return html.slice(start, end)
}

function metaContent(html, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<meta\\b(?=[^>]*${escaped})[^>]*content=["']([^"']*)["'][^>]*>`, 'i')
  return decodeEntities(html.match(re)?.[1] || '')
}

function extractImages(contentHtml) {
  const images = []
  const seen = new Set()

  for (const match of contentHtml.matchAll(/<picture\b[\s\S]*?<\/picture>/gi)) {
    const picture = match[0]
    const img = picture.match(/<img\b[\s\S]*?>/i)?.[0] || ''
    if (!/\bgallery__img\b/i.test(img)) continue

    const fallback = cleanUrl(attr(img, 'src'))
    const url = highestSrcsetUrl(picture) || fallback
    if (!url || url.startsWith('data:') || seen.has(url)) continue

    seen.add(url)
    images.push({
      url,
      fallback,
      alt: attr(img, 'alt'),
      width: Number(attr(img, 'width')) || null,
      height: Number(attr(img, 'height')) || null,
    })
  }

  return images
}

function mimeFromFilename(filename) {
  if (filename.endsWith('.png')) return 'image/png'
  if (filename.endsWith('.webp')) return 'image/webp'
  if (filename.endsWith('.gif')) return 'image/gif'
  if (filename.endsWith('.jpeg')) return 'image/jpeg'
  return 'image/jpeg'
}

function filenameForImage(index, url) {
  const lower = url.split('?')[0].toLowerCase()
  const ext =
    lower.endsWith('.jpeg') ? 'jpeg' :
    lower.endsWith('.png') ? 'png' :
    lower.endsWith('.webp') ? 'webp' :
    lower.endsWith('.gif') ? 'gif' :
    'jpg'
  return `${FOLDER_NAME}-${String(index + 1).padStart(2, '0')}.${ext}`
}

function textNode(text) {
  return {
    type: 'text',
    version: 1,
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
  }
}

function headingNode(text, tag = 'h2') {
  return {
    type: 'heading',
    tag,
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: [textNode(text)],
  }
}

function uploadNode(mediaDoc) {
  return {
    type: 'upload',
    version: 3,
    format: '',
    id: hashId(`page-upload:${PAGE_SLUG}:${mediaDoc.id}:${mediaDoc.filename}`),
    fields: {},
    relationTo: 'media',
    // Payload Lexical UploadFeature 期望 value 是 media 的 id（read 時才 populate
    // 成物件）。存成完整物件會讓 admin 編輯器反序列化失敗（前台因 depth populate
    // 仍正常，後台編輯頁壞）。務必只存 id。
    value: mediaDoc.id,
  }
}

function richText(mediaDocs) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: [headingNode(PAGE_TITLE), ...mediaDocs.map(uploadNode)],
    },
  }
}

async function fetchSourcePage() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      'user-agent': 'Mozilla/5.0 CKMU page importer',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${SOURCE_URL}: ${res.status}`)
  const html = await res.text()
  const contentHtml = extractContentHtml(html)
  const images = extractImages(contentHtml)
  if (images.length === 0) throw new Error('No gallery images found in source page content')

  return {
    title: decodeEntities(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || PAGE_TITLE).trim() || PAGE_TITLE,
    description: metaContent(html, 'name="description"') || PAGE_TITLE,
    ogImage: metaContent(html, 'property="og:image"'),
    images,
  }
}

async function upsertMedia(db, image, index) {
  const filename = filenameForImage(index, image.url)
  const mimeType = mimeFromFilename(filename)
  const alt = image.alt || `${PAGE_TITLE} ${index + 1}`
  const localUrl = `/media/${filename}`
  const existing = await dbExecute(db, {
    sql: 'SELECT id FROM media WHERE filename = ? LIMIT 1',
    args: [filename],
  })

  if (existing.rows[0]) {
    const id = existing.rows[0].id
    if (apply) {
      await dbExecute(db, {
        sql: 'UPDATE media SET alt = ?, url = ?, mime_type = ?, width = ?, height = ?, folder_name = ?, updated_at = ? WHERE id = ?',
        args: [alt, localUrl, mimeType, image.width, image.height, FOLDER_NAME, now, id],
      })
      await ensureMediaFile({ url: image.url, filename })
    }
    return { id, alt, url: localUrl, filename, mimeType, width: image.width, height: image.height, action: 'update' }
  }

  if (!apply) {
    return {
      id: Number(`88${String(index + 1).padStart(3, '0')}`),
      alt,
      url: localUrl,
      filename,
      mimeType,
      width: image.width,
      height: image.height,
      action: 'create',
    }
  }

  const inserted = await dbExecute(db, {
    sql: `
      INSERT INTO media
        (alt, caption, updated_at, created_at, url, filename, mime_type, filesize, width, height, focal_x, focal_y, folder_name)
      VALUES
        (?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, 50, 50, ?)
      RETURNING id
    `,
    args: [alt, now, now, localUrl, filename, mimeType, image.width, image.height, FOLDER_NAME],
  })
  await ensureMediaFile({ url: image.url, filename })
  return { id: inserted.rows[0].id, alt, url: localUrl, filename, mimeType, width: image.width, height: image.height, action: 'create' }
}

async function ensureMediaFile({ url, filename }) {
  if (!downloadMedia) return
  const target = path.join(mediaDir, filename)
  try {
    const existing = await stat(target)
    if (existing.size > 0) return
  } catch {
    // missing file, download below
  }

  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 CKMU page media importer',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`Media download failed ${url}: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await mkdir(mediaDir, { recursive: true })
  await writeFile(target, buffer)
}

async function upsertPage(db, source, mediaDocs) {
  const content = JSON.stringify(richText(mediaDocs))
  const existing = await dbExecute(db, {
    sql: 'SELECT id FROM pages WHERE slug = ? LIMIT 1',
    args: [PAGE_SLUG],
  })

  let pageId = existing.rows[0]?.id
  const action = pageId ? 'update' : 'create'
  const featured = mediaDocs[0]?.id || null

  if (apply) {
    if (pageId) {
      await dbExecute(db, {
        sql: `
          UPDATE pages
          SET title = ?, status = ?, seo_meta_title = ?, seo_meta_description = ?, seo_meta_image_id = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [source.title, 'published', source.title, source.description, featured, now, pageId],
      })
    } else {
      const inserted = await dbExecute(db, {
        sql: `
          INSERT INTO pages
            (title, slug, status, seo_meta_title, seo_meta_description, seo_meta_image_id, updated_at, created_at)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        args: [source.title, PAGE_SLUG, 'published', source.title, source.description, featured, now, now],
      })
      pageId = inserted.rows[0].id
    }

    await dbExecute(db, {
      sql: 'DELETE FROM pages_blocks_rich_content WHERE _parent_id = ? AND _path = ?',
      args: [pageId, 'layout'],
    })
    await dbExecute(db, {
      sql: `
        INSERT INTO pages_blocks_rich_content
          (_order, _parent_id, _path, id, content, block_name)
        VALUES
          (0, ?, 'layout', ?, ?, ?)
      `,
      args: [pageId, hashId(`page:${PAGE_SLUG}:rich-content`), content, PAGE_TITLE],
    })
  }

  return {
    id: pageId,
    action,
    slug: PAGE_SLUG,
    title: source.title,
    description: source.description,
    ogImage: source.ogImage,
    imageCount: mediaDocs.length,
    contentNodes: JSON.parse(content).root.children.length,
  }
}

async function main() {
  const source = await fetchSourcePage()
  const db = createClient({ url: dbUrl })
  await dbExecute(db, 'PRAGMA busy_timeout = 30000')

  const mediaDocs = []
  for (const [index, image] of source.images.entries()) {
    mediaDocs.push(await upsertMedia(db, image, index))
  }

  const page = await upsertPage(db, source, mediaDocs)
  const summary = {
    mode: dryRun ? 'dry-run' : 'apply',
    dbUrl,
    mediaDir,
    downloadMedia,
    sourceUrl: SOURCE_URL,
    targetUrl: `https://pre.chickimmiu.com/pages/${PAGE_SLUG}`,
    sourceImages: source.images.length,
    mediaCreates: mediaDocs.filter((m) => m.action === 'create').length,
    mediaUpdates: mediaDocs.filter((m) => m.action === 'update').length,
    page,
    media: mediaDocs.map((m) => ({
      id: m.id,
      filename: m.filename,
      url: m.url,
      width: m.width,
      height: m.height,
      action: m.action,
    })),
  }
  console.log(JSON.stringify(summary, null, 2))
}

async function dbExecute(db, statement, attempt = 0) {
  try {
    return await db.execute(statement)
  } catch (err) {
    const busy = err?.code === 'SQLITE_BUSY' || /database is locked/i.test(String(err?.message || err))
    if (!busy || attempt >= 5) throw err
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    return dbExecute(db, statement, attempt + 1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
