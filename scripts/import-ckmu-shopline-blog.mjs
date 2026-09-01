import { createClient } from '@libsql/client'
import { createHash } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const SOURCE_ORIGIN = 'https://www.chickimmiu.com'
// 媒體庫資料夾樹的根：後台「部落格」資料夾（payload_folders 裡 folder_id IS NULL 那筆）
const BLOG_ROOT_FOLDER_NAME = '部落格'
const POST_IDS = [
  '260422',
  '260415',
  '260408',
  '260401',
  '260325',
  '260318',
  '260311',
  '260304',
  '260225',
  '260211',
  '260204',
  '260128',
]

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const dryRun = args.has('--dry-run') || !apply
const dbUrl = getArg('--db') || process.env.DATABASE_URI || 'file:./data/chickimmiu.db'
const authorEmail = getArg('--author-email') || 'admin@chickimmiu.com'
const downloadMedia = apply && !args.has('--skip-download-media')
const mediaDir = getArg('--media-dir') || 'public/media'
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

function cleanText(text) {
  return decodeEntities(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function stripTags(html) {
  return cleanText(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
        const text = stripTags(inner)
        return text && !text.includes(href) ? `${text} (${decodeEntities(href)})` : decodeEntities(href)
      })
      .replace(/<[^>]+>/g, ''),
  )
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

function paragraphNodeFromText(text) {
  const lines = cleanText(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  const children = []
  for (const [index, line] of lines.entries()) {
    if (index > 0) children.push({ type: 'linebreak', version: 1 })
    children.push(textNode(line))
  }

  return {
    type: 'paragraph',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    children,
  }
}

function headingNode(text, tag = 'h3') {
  const trimmed = cleanText(text)
  if (!trimmed) return null
  return {
    type: 'heading',
    tag,
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: [textNode(trimmed)],
  }
}

function uploadNode(mediaDoc) {
  return {
    type: 'upload',
    version: 3,
    format: '',
    id: hashId(`upload-node:${mediaDoc.id}:${mediaDoc.url}`),
    fields: {},
    relationTo: 'media',
    // Payload Lexical UploadFeature 期望 value 是 media 的 id（read 時才 populate
    // 成物件）。存成完整物件會讓 admin 編輯器反序列化失敗（前台因 depth populate
    // 仍正常，後台編輯頁壞）。務必只存 id。
    value: mediaDoc.id,
  }
}

function rootNode(children) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: children.length ? children : [paragraphNodeFromText('')].filter(Boolean),
    },
  }
}

function attr(html, name) {
  const re = new RegExp(`${name}=["']([^"']*)["']`, 'i')
  const match = String(html || '').match(re)
  return match ? decodeEntities(match[1]) : ''
}

function imageUrlFromFigure(html) {
  const img = String(html || '').match(/<img\b[\s\S]*?>/i)?.[0] || ''
  const url = attr(img, 'data-src') || attr(img, 'src')
  if (!url || url.startsWith('data:')) return null
  return {
    url,
    alt: attr(img, 'alt'),
    width: Number(attr(img, 'width')) || null,
    height: Number(attr(img, 'height')) || null,
  }
}

function mediaFilename(postId, index, url) {
  const path = url.split('?')[0].toLowerCase()
  const ext =
    path.endsWith('.jpeg') ? 'jpeg' :
    path.endsWith('.png') ? 'png' :
    path.endsWith('.webp') ? 'webp' :
    path.endsWith('.gif') ? 'gif' :
    'jpg'
  return `ckmu-blog-${postId}-${String(index + 1).padStart(2, '0')}.${ext}`
}

function mimeFromFilename(filename) {
  if (filename.endsWith('.png')) return 'image/png'
  if (filename.endsWith('.webp')) return 'image/webp'
  if (filename.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function categoryForTitle(title) {
  if (/穿搭|墨鏡|褲|鞋款|外套|造型/.test(title)) return 'styling'
  return 'trends'
}

function tagsForTitle(title) {
  const tags = ['CKMU BLOG']
  if (/韓劇/.test(title)) tags.push('韓劇')
  if (/韓星|IU|高胤禎|K-Pop/.test(title)) tags.push('韓星穿搭')
  if (/穿搭|褲|鞋款|墨鏡|外套|造型/.test(title)) tags.push('穿搭靈感')
  if (/生活|APP|咖啡/.test(title)) tags.push('生活風格')
  if (/活動|燈會|冬奧|時尚新聞/.test(title)) tags.push('話題趨勢')
  return [...new Set(tags)]
}

function extractRichContent(html) {
  const start = html.indexOf('<!-- START SHOPLINE RICH CONTENT -->')
  const end = html.indexOf('<!-- END SHOPLINE RICH CONTENT -->')
  if (start >= 0 && end > start) {
    return html.slice(start + '<!-- START SHOPLINE RICH CONTENT -->'.length, end)
  }
  const match = html.match(/<div class="Post-content ck-content">([\s\S]*?)<\/div>\s*<\/div>/i)
  return match ? match[1] : ''
}

function normalizeContentHtml(html) {
  return String(html || '')
    .replace(/^\s*<html><head><\/head><body>/i, '')
    .replace(/<\/body><\/html>\s*$/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

function extractPost(html, postId) {
  const title = stripTags(html.match(/<h1\b[^>]*class=["'][^"']*Post-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
  const date = stripTags(html.match(/<div\b[^>]*class=["'][^"']*Post-date[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '')
  const contentHtml = normalizeContentHtml(extractRichContent(html))
  if (!title || !date || !contentHtml) {
    throw new Error(`Could not parse post ${postId}`)
  }
  return { postId, title, date, contentHtml }
}

function collectImages(contentHtml) {
  const images = []
  const seen = new Set()
  for (const match of contentHtml.matchAll(/<figure\b[\s\S]*?<\/figure>/gi)) {
    const image = imageUrlFromFigure(match[0])
    if (!image || seen.has(image.url)) continue
    seen.add(image.url)
    images.push(image)
  }
  return images
}

function contentToLexical(contentHtml, mediaDocsByUrl) {
  const children = []
  const blockRe = /<figure\b[\s\S]*?<\/figure>|<p\b[\s\S]*?<\/p>|<h([1-6])\b[\s\S]*?<\/h\1>|<ul\b[\s\S]*?<\/ul>|<ol\b[\s\S]*?<\/ol>|<blockquote\b[\s\S]*?<\/blockquote>|<hr\b[^>]*\/?>/gi

  for (const match of contentHtml.matchAll(blockRe)) {
    const block = match[0]
    if (/^<figure/i.test(block)) {
      const image = imageUrlFromFigure(block)
      const mediaDoc = image ? mediaDocsByUrl.get(image.url) : null
      if (mediaDoc) children.push(uploadNode(mediaDoc))
      continue
    }

    if (/^<h[1-6]/i.test(block)) {
      const tag = (block.match(/^<h([1-6])/i)?.[1] || '3')
      const node = headingNode(stripTags(block), `h${tag}`)
      if (node) children.push(node)
      continue
    }

    if (/^<blockquote/i.test(block)) {
      const text = stripTags(block)
      if (text) {
        children.push({
          type: 'quote',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          children: [textNode(text)],
        })
      }
      continue
    }

    if (/^<ul|^<ol/i.test(block)) {
      const ordered = /^<ol/i.test(block)
      const items = [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((m) => stripTags(m[1]))
        .filter(Boolean)
      if (items.length) {
        children.push({
          type: 'list',
          listType: ordered ? 'number' : 'bullet',
          tag: ordered ? 'ol' : 'ul',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          start: 1,
          children: items.map((item, index) => ({
            type: 'listitem',
            version: 1,
            direction: 'ltr',
            format: '',
            indent: 0,
            value: index + 1,
            children: [textNode(item)],
          })),
        })
      }
      continue
    }

    if (/^<hr/i.test(block)) {
      children.push({ type: 'horizontalrule', version: 1 })
      continue
    }

    const node = paragraphNodeFromText(stripTags(block))
    if (node) children.push(node)
  }

  return rootNode(children)
}

function excerptFromHtml(contentHtml) {
  const text = stripTags(contentHtml.replace(/<figure\b[\s\S]*?<\/figure>/gi, ' '))
    .replace(/\s+/g, ' ')
    .replace(/現在加入CKMU LINE@.*$/u, '')
    .trim()
  return text.slice(0, 150)
}

async function fetchPost(postId) {
  const url = `${SOURCE_ORIGIN}/blog/posts/${postId}`
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 CKMU blog importer',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`)
  return extractPost(await res.text(), postId)
}

/**
 * 依 dbUrl scheme 建雙方言連線（file:/libsql → SQLite、postgres(ql):// → PG）。
 * 兩個 driver 都收斂成 { dialect, execute({sql,args}) → {rows}, close() }，
 * SQL 一律寫 `?` 佔位符，PG 端在這裡轉成 $1..$n（本腳本的 SQL 字串裡沒有
 * 字面 `?`，可以安全整串替換）。
 */
async function createDb() {
  if (/^postgres(ql)?:/i.test(dbUrl)) {
    // pg 不是直接依賴，但 @payloadcms/db-postgres 一定帶著——照
    // scripts/migrate-sqlite-to-pg.ts 的解析法借用，不另外裝套件。
    const require = createRequire(import.meta.url)
    const pgPath = require.resolve('pg', { paths: [require.resolve('@payloadcms/db-postgres')] })
    const { Client } = require(pgPath)
    const client = new Client({ connectionString: dbUrl })
    await client.connect()
    return {
      dialect: 'pg',
      async execute(statement) {
        const { sql, args } = normalizeStatement(statement)
        let index = 0
        const res = await client.query(sql.replace(/\?/g, () => `$${++index}`), args)
        return { rows: res.rows }
      },
      close: () => client.end(),
    }
  }

  const client = createClient({ url: dbUrl })
  await client.execute('PRAGMA busy_timeout = 30000')
  return {
    dialect: 'sqlite',
    execute: (statement) => client.execute(statement),
    close: async () => client.close(),
  }
}

function normalizeStatement(statement) {
  return typeof statement === 'string'
    ? { sql: statement, args: [] }
    : { sql: statement.sql, args: statement.args || [] }
}

/**
 * upsert 一個 Payload 原生媒體資料夾，回傳 folder id（dry-run 且不存在時回 null）。
 * 直接寫 payload_folders / payload_folders_folder_type，跟本腳本其他 SQL 同一條路。
 * folder_type 只在新建時補 value='media'（PG 端該欄是 enum
 * enum_payload_folders_folder_type，參數繫結會依欄位型別 cast，不用手寫 ::cast；
 * 既有資料夾不回填 folder_type，與線上既況一致）。
 */
async function ensureFolder(db, name, parentId) {
  const found = await dbExecute(db, {
    sql: `SELECT id FROM payload_folders WHERE name = ? AND ${
      parentId == null ? 'folder_id IS NULL' : 'folder_id = ?'
    } ORDER BY id LIMIT 1`,
    args: parentId == null ? [name] : [name, parentId],
  })
  if (found.rows[0]) return Number(found.rows[0].id)
  if (!apply) return null

  const inserted = await dbExecute(db, {
    sql: 'INSERT INTO payload_folders (name, folder_id, updated_at, created_at) VALUES (?, ?, ?, ?) RETURNING id',
    args: [name, parentId, now, now],
  })
  const id = Number(inserted.rows[0].id)
  await dbExecute(db, {
    sql: 'INSERT INTO payload_folders_folder_type ("order", parent_id, value) VALUES (1, ?, ?)',
    args: [id, 'media'],
  })
  return id
}

async function getAuthorId(db) {
  const byEmail = await dbExecute(db, {
    sql: 'SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1',
    args: [authorEmail, 'admin'],
  })
  if (byEmail.rows[0]) return byEmail.rows[0].id
  const admin = await dbExecute(db, "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
  if (admin.rows[0]) return admin.rows[0].id
  if (dryRun) return 0
  throw new Error('No admin author found')
}

async function upsertMedia(db, { postId, title, image, index, folderId }) {
  const filename = mediaFilename(postId, index, image.url)
  const mimeType = mimeFromFilename(filename)
  const alt = image.alt || `${title} ${index + 1}`
  const existing = await dbExecute(db, {
    sql: 'SELECT id, filename, url, alt, mime_type, width, height FROM media WHERE filename = ? LIMIT 1',
    args: [filename],
  })

  if (existing.rows[0]) {
    const id = existing.rows[0].id
    if (apply) {
      await dbExecute(db, {
        sql: 'UPDATE media SET alt = ?, url = ?, mime_type = ?, width = ?, height = ?, folder_name = ?, folder_id = ?, updated_at = ? WHERE id = ?',
        args: [alt, image.url, mimeType, image.width, image.height, 'ckmu-blog-import', folderId, now, id],
      })
      await ensureMediaFile({ url: image.url, filename })
    }
    return { id, alt, url: image.url, filename, mimeType, width: image.width, height: image.height, action: 'update' }
  }

  if (!apply) {
    return {
      id: Number(`9${postId}${String(index + 1).padStart(2, '0')}`),
      alt,
      url: image.url,
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
        (alt, caption, updated_at, created_at, url, filename, mime_type, filesize, width, height, focal_x, focal_y, folder_name, folder_id)
      VALUES
        (?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, 50, 50, ?, ?)
      RETURNING id
    `,
    args: [alt, now, now, image.url, filename, mimeType, image.width, image.height, 'ckmu-blog-import', folderId],
  })
  await ensureMediaFile({ url: image.url, filename })
  return { id: inserted.rows[0].id, alt, url: image.url, filename, mimeType, width: image.width, height: image.height, action: 'create' }
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
      'user-agent': 'Mozilla/5.0 CKMU blog media importer',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`Media download failed ${url}: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await mkdir(mediaDir, { recursive: true })
  await writeFile(target, buffer)
}

async function upsertPost(db, post, authorId, mediaDocs) {
  const slug = `ckmu-blog-${post.postId}`
  const excerpt = excerptFromHtml(post.contentHtml)
  const mediaDocsByUrl = new Map(mediaDocs.map((doc) => [doc.url, doc]))
  const content = JSON.stringify(contentToLexical(post.contentHtml, mediaDocsByUrl))
  const featured = mediaDocs[0]?.id || null
  const category = categoryForTitle(post.title)
  const tags = tagsForTitle(post.title)
  const existing = await dbExecute(db, {
    sql: 'SELECT id FROM blog_posts WHERE slug = ? LIMIT 1',
    args: [slug],
  })

  let postRowId = existing.rows[0]?.id
  const action = postRowId ? 'update' : 'create'

  if (apply) {
    if (postRowId) {
      await dbExecute(db, {
        sql: `
          UPDATE blog_posts
          SET title = ?, excerpt = ?, content = ?, featured_image_id = ?, author_id = ?, category = ?,
              status = ?, published_at = ?, seo_meta_title = ?, seo_meta_description = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [
          post.title,
          excerpt,
          content,
          featured,
          authorId,
          category,
          'published',
          post.date,
          post.title,
          excerpt,
          now,
          postRowId,
        ],
      })
    } else {
      const inserted = await dbExecute(db, {
        sql: `
          INSERT INTO blog_posts
            (title, slug, excerpt, content, featured_image_id, author_id, category, status,
             published_at, seo_meta_title, seo_meta_description, updated_at, created_at, featured)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        args: [
          post.title,
          slug,
          excerpt,
          content,
          featured,
          authorId,
          category,
          'published',
          post.date,
          post.title,
          excerpt,
          now,
          now,
          // featured 在 SQLite 是 integer 0/1、在 PG 是 boolean——字面值 0 在 PG 會硬報錯
          db.dialect === 'pg' ? false : 0,
        ],
      })
      postRowId = inserted.rows[0].id
    }

    await dbExecute(db, { sql: 'DELETE FROM blog_posts_tags WHERE _parent_id = ?', args: [postRowId] })
    for (const [index, tag] of tags.entries()) {
      await dbExecute(db, {
        sql: 'INSERT INTO blog_posts_tags (_order, _parent_id, id, tag) VALUES (?, ?, ?, ?)',
        args: [index + 1, postRowId, hashId(`${slug}:tag:${index}:${tag}`), tag],
      })
    }
  }

  return {
    id: postRowId,
    action,
    slug,
    title: post.title,
    date: post.date,
    category,
    tags,
    imageCount: mediaDocs.length,
    excerptLength: excerpt.length,
    contentNodes: JSON.parse(content).root.children.length,
  }
}

async function main() {
  const db = await createDb()
  try {
    const authorId = await getAuthorId(db)
    // 媒體庫資料夾樹：「部落格 / <文章標題>」。media 除了 legacy folder_name
    // 文字標籤外，還要掛 folder_id 關聯，否則後台媒體庫顯示「無資料夾」。
    const blogRootFolderId = await ensureFolder(db, BLOG_ROOT_FOLDER_NAME, null)
    const posts = []

    for (const postId of POST_IDS) {
      const post = await fetchPost(postId)
      const folderId =
        blogRootFolderId == null ? null : await ensureFolder(db, post.title, blogRootFolderId)
      const images = collectImages(post.contentHtml)
      const mediaDocs = []
      for (const [index, image] of images.entries()) {
        mediaDocs.push(await upsertMedia(db, { postId, title: post.title, image, index, folderId }))
      }
      posts.push({ ...(await upsertPost(db, post, authorId, mediaDocs)), folderId })
    }

    const summary = {
      mode: dryRun ? 'dry-run' : 'apply',
      dialect: db.dialect,
      // PG 連線字串帶密碼，落 log 前遮掉
      dbUrl: dbUrl.replace(/(:\/\/[^:/@]+):[^@]+@/, '$1:***@'),
      authorId,
      downloadMedia,
      mediaDir,
      blogRootFolderId,
      posts: posts.length,
      creates: posts.filter((p) => p.action === 'create').length,
      updates: posts.filter((p) => p.action === 'update').length,
      images: posts.reduce((sum, p) => sum + p.imageCount, 0),
      detail: posts,
    }
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await db.close()
  }
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
