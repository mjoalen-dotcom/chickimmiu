import fs from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'

import { convertPixnetHtmlToLexical } from '../src/lib/blog/pixnetImport'

interface ImportedImage {
  alt?: string
  mediaId?: number | string
  src: string
}

interface ImportedPost {
  slug: string
  title: string
  excerpt?: string
  category?: string
  tags?: string[]
  publishedAt?: string
  viewCount?: number
  sourceUrl?: string
  html: string
  images: ImportedImage[]
  featured?: boolean
  status?: 'draft' | 'published'
  visibility?: 'public' | 'unlisted'
}

interface Options {
  source: string
  mediaDir: string
  dryRun: boolean
  validateOnly: boolean
  skipExisting: boolean
}

// 媒體庫資料夾樹的根：後台「部落格」資料夾（parent 為空的那筆）
const BLOG_ROOT_FOLDER_NAME = '部落格'

const CATEGORY_VALUES: Record<string, string> = {
  穿搭教學: 'styling',
  新品介紹: 'new-arrivals',
  品牌故事: 'brand-story',
  優惠活動: 'promotions',
  時尚趨勢: 'trends',
  時尚流行: 'fashion',
  美容彩妝: 'beauty',
  購物情報: 'shopping',
  美食料理: 'food',
  生活綜合: 'lifestyle',
  親子育兒: 'parenting',
  旅遊紀錄: 'travel',
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    source: process.env.KIM_PIXNET_IMPORT_FILE
      ? path.resolve(process.env.KIM_PIXNET_IMPORT_FILE)
      : '',
    mediaDir: process.env.KIM_PIXNET_MEDIA_DIR
      ? path.resolve(process.env.KIM_PIXNET_MEDIA_DIR)
      : '',
    dryRun: process.env.KIM_PIXNET_IMPORT_DRY_RUN === '1',
    validateOnly: process.env.KIM_PIXNET_IMPORT_VALIDATE_ONLY === '1',
    skipExisting: process.env.KIM_PIXNET_IMPORT_SKIP_EXISTING === '1',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source') options.source = path.resolve(argv[++index] || '')
    else if (value === '--media-dir') {
      options.mediaDir = path.resolve(argv[++index] || '')
    } else if (value === '--dry-run') options.dryRun = true
    else if (value === '--validate-only') options.validateOnly = true
    else if (value === '--skip-existing') options.skipExisting = true
    else if (value !== '--') throw new Error(`Unknown argument: ${value}`)
  }
  if (!options.source) throw new Error('--source is required')
  if (!options.mediaDir) throw new Error('--media-dir is required')
  return options
}

function safeMediaPath(mediaDir: string, source: string): string {
  const filename = path.basename(new URL(source, 'https://blog.kimlafayette.com').pathname)
  const resolved = path.resolve(mediaDir, filename)
  const relative = path.relative(mediaDir, resolved)
  if (!filename || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe media source: ${source}`)
  }
  return resolved
}

const MEDIA_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function mediaFileMetadata(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  const mimetype = MEDIA_TYPES[extension]
  if (!mimetype) throw new Error(`Unsupported media type: ${filePath}`)
  return { extension, mimetype }
}

async function loadLocalEnvironment() {
  const filename = path.resolve(process.cwd(), '.env')
  let source = ''
  try {
    source = await fs.readFile(filename, 'utf8')
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    if (code === 'ENOENT') return
    throw error
  }

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2].trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

function uploadFilename(
  slug: string,
  index: number,
  extension: string,
): string {
  return `kim-pixnet-${slug}-${String(index + 1).padStart(3, '0')}${extension}`
}

/**
 * upsert 一個 Payload 原生媒體資料夾（payload-folders collection）。
 * media 除了 legacy `folderName` 文字標籤外，還要掛真正的 `folder` 關聯，
 * 否則後台媒體庫一律顯示「無資料夾」。folderType=['media'] 對應 PG 端的
 * enum enum_payload_folders_folder_type / SQLite 端的 text，方言差異由
 * Payload adapter 處理。dry-run 且資料夾不存在時回 { id: null }。
 */
async function ensureMediaFolder(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
  parentId: number | string | null,
  dryRun: boolean,
): Promise<{ created: boolean; id: number | string | null }> {
  const existing = await payload.find({
    collection: 'payload-folders',
    where: {
      and: [
        { name: { equals: name } },
        parentId == null ? { folder: { exists: false } } : { folder: { equals: parentId } },
      ],
    },
    sort: 'createdAt',
    limit: 1,
    depth: 0,
  })
  const found = existing.docs[0]
  if (found) return { created: false, id: found.id }
  if (dryRun) return { created: false, id: null }

  const created = await payload.create({
    collection: 'payload-folders',
    data: {
      name,
      folderType: ['media'],
      ...(parentId == null ? {} : { folder: parentId }),
    } as never,
  })
  return { created: true, id: created.id }
}

async function validateSource(options: Options) {
  const post = JSON.parse(await fs.readFile(options.source, 'utf8')) as ImportedPost
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u.test(post.slug)) {
    throw new Error(`Unsafe slug: ${post.slug}`)
  }
  if (!post.title?.trim()) {
    throw new Error('The imported post requires a title')
  }
  if (!Array.isArray(post.images)) {
    throw new Error('The imported post requires an images array')
  }
  if (post.status && post.status !== 'draft' && post.status !== 'published') {
    throw new Error(`Unsupported article status: ${post.status}`)
  }
  if (post.visibility && post.visibility !== 'public' && post.visibility !== 'unlisted') {
    throw new Error(`Unsupported article visibility: ${post.visibility}`)
  }

  // PIXNET can retain title-only drafts. Payload still needs a valid Lexical root,
  // so preserve those drafts as an empty paragraph instead of dropping them.
  if (!post.html?.trim()) post.html = '<p></p>'

  const mediaPaths: Array<string | null> = []
  for (const image of post.images) {
    if (image.mediaId !== undefined && image.mediaId !== null) {
      if (!/^\d+$/.test(String(image.mediaId)) || Number(image.mediaId) < 1) {
        throw new Error(`Invalid reusable media id: ${image.mediaId}`)
      }
      mediaPaths.push(null)
      continue
    }
    const filename = safeMediaPath(options.mediaDir, image.src)
    const stats = await fs.stat(filename)
    if (!stats.isFile() || stats.size === 0) {
      throw new Error(`Missing media file: ${filename}`)
    }
    mediaFileMetadata(filename)
    mediaPaths.push(filename)
  }
  return { post, mediaPaths }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { post, mediaPaths } = await validateSource(options)

  if (options.validateOnly) {
    const mediaBySource = new Map(
      post.images.map((image, index) => [
        image.src,
        image.mediaId || `dry-${index + 1}`,
      ]),
    )
    const converted = convertPixnetHtmlToLexical(post.html, mediaBySource)
    if (converted.missingImageSources.length > 0) {
      throw new Error(
        `HTML references missing images: ${converted.missingImageSources.join(', ')}`,
      )
    }
    console.log(
      JSON.stringify(
        {
          valid: true,
          slug: post.slug,
          images: post.images.length,
          embeddedImages: converted.embeddedMediaIds.length,
          nodeCounts: converted.nodeCounts,
        },
        null,
        2,
      ),
    )
    return
  }

  await loadLocalEnvironment()
  process.env.KIM_BLOG_DEPLOY_HOOK_URL = ''
  console.log('source validated; initializing Payload')
  const { default: config } = await import('@payload-config')
  const payload = await getPayload({ config })
  console.log('Payload initialized; checking for an existing article')
  const existingPost = await payload.find({
    collection: 'blog-posts',
    where: { slug: { equals: post.slug } },
    limit: 1,
    depth: 0,
  })
  if (existingPost.totalDocs > 0) {
    if (options.skipExisting) {
      console.log(
        JSON.stringify(
          {
            skipped: true,
            reason: 'already-exists',
            slug: post.slug,
            articleId: existingPost.docs[0]?.id,
          },
          null,
          2,
        ),
      )
      return
    }
    throw new Error(`Blog post already exists: ${post.slug}`)
  }

  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    sort: 'id',
    limit: 1,
    depth: 0,
  })
  const author = admins.docs[0]
  if (!author) throw new Error('No admin user is available for the article author')

  const folderName = `kim-pixnet-${post.slug}`
  console.log('author resolved; checking reusable media')
  const existingMedia = await payload.find({
    collection: 'media',
    where: { folderName: { equals: folderName } },
    limit: 500,
    depth: 0,
  })
  const existingByFilename = new Map(
    existingMedia.docs.map((media) => [String(media.filename), media]),
  )
  const mediaBySource = new Map<string, number | string>()
  const gallery: Array<number | string> = []
  const createdMedia: Array<number | string> = []
  const createdFolders: Array<number | string> = []
  let articleFolderId: number | string | null = null
  let reusedMedia = 0

  try {
    // 媒體庫資料夾樹：「部落格 / <文章標題>」
    const rootFolder = await ensureMediaFolder(
      payload,
      BLOG_ROOT_FOLDER_NAME,
      null,
      options.dryRun,
    )
    if (rootFolder.created && rootFolder.id != null) createdFolders.push(rootFolder.id)
    if (rootFolder.id != null) {
      const articleFolder = await ensureMediaFolder(
        payload,
        post.title,
        rootFolder.id,
        options.dryRun,
      )
      if (articleFolder.created && articleFolder.id != null) {
        createdFolders.push(articleFolder.id)
      }
      articleFolderId = articleFolder.id
    }

    for (let index = 0; index < post.images.length; index += 1) {
      const image = post.images[index]!
      const filePath = mediaPaths[index]!
      if (image.mediaId) {
        const reusable = await payload.findByID({
          collection: 'media',
          id: image.mediaId,
          depth: 0,
        })
        mediaBySource.set(image.src, reusable.id)
        gallery.push(reusable.id)
        reusedMedia += 1
        continue
      }
      if (!filePath) throw new Error(`Missing media file path for ${image.src}`)
      const { extension, mimetype } = mediaFileMetadata(filePath)
      const filename = uploadFilename(post.slug, index, extension)
      const reused = existingByFilename.get(filename)
      if (reused) {
        // 舊匯入（或中斷後重跑）留下的同名 media 若還沒掛資料夾，順手補上
        if (!options.dryRun && articleFolderId != null && !reused.folder) {
          await payload.update({
            collection: 'media',
            id: reused.id,
            data: { folder: articleFolderId } as never,
          })
        }
        mediaBySource.set(image.src, reused.id)
        gallery.push(reused.id)
        reusedMedia += 1
        continue
      }
      if (options.dryRun) {
        mediaBySource.set(image.src, `dry-${index + 1}`)
        gallery.push(`dry-${index + 1}`)
        continue
      }

      const data = await fs.readFile(filePath)
      const media = await payload.create({
        collection: 'media',
        data: {
          alt: String(image.alt || `文章相片 ${index + 1}`).slice(0, 160),
          folderName,
          ...(articleFolderId != null ? { folder: articleFolderId } : {}),
        } as never,
        filePath,
        file: {
          data,
          mimetype,
          name: filename,
          size: data.byteLength,
        },
      })
      mediaBySource.set(image.src, media.id)
      gallery.push(media.id)
      createdMedia.push(media.id)
      console.log(`media ${index + 1}/${post.images.length}: ${filename}`)
    }

    const converted = convertPixnetHtmlToLexical(post.html, mediaBySource)
    if (converted.missingImageSources.length > 0) {
      throw new Error(
        `HTML references missing images: ${converted.missingImageSources.join(', ')}`,
      )
    }
    if (converted.embeddedMediaIds.length < post.images.length - 1) {
      throw new Error(
        `Expected at least ${post.images.length - 1} embedded images, got ${converted.embeddedMediaIds.length}`,
      )
    }

    const summary = {
      slug: post.slug,
      title: post.title,
      status: post.status || 'published',
      visibility: post.visibility || 'public',
      images: post.images.length,
      embeddedImages: converted.embeddedMediaIds.length,
      reusedMedia,
      createdMedia: createdMedia.length,
      pendingMedia: options.dryRun ? gallery.length - reusedMedia : 0,
      // dry-run 且資料夾尚不存在時為 null（實際匯入時會建立）
      mediaFolder: `${BLOG_ROOT_FOLDER_NAME} / ${post.title}`,
      mediaFolderId: articleFolderId,
      createdFolders: createdFolders.length,
      nodeCounts: converted.nodeCounts,
    }
    if (options.dryRun) {
      console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2))
      return
    }

    const status = post.status || 'published'
    const visibility = post.visibility || 'public'
    const blogPost = await payload.create({
      collection: 'blog-posts',
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || '',
        content: converted.content,
        ...(gallery[0] ? { featuredImage: gallery[0] } : {}),
        gallery,
        featured: post.featured ?? status === 'published',
        author: author.id,
        category: CATEGORY_VALUES[post.category || ''] || 'lifestyle',
        publishToKimLafayette: true,
        sourceUrl:
          post.sourceUrl ||
          `https://youwin721.pixnet.net/blog/post/${post.slug}`,
        tags: (post.tags || []).map((tag) => ({ tag })),
        status,
        visibility,
        ...(post.publishedAt ? { publishedAt: post.publishedAt } : {}),
        viewCount: Math.max(
          0,
          Math.trunc(Number.isFinite(Number(post.viewCount)) ? Number(post.viewCount) : 0),
        ),
      } as never,
    })

    console.log(
      JSON.stringify(
        { imported: true, articleId: blogPost.id, ...summary },
        null,
        2,
      ),
    )
  } catch (error) {
    if (!options.dryRun && createdMedia.length > 0) {
      console.error(`rolling back ${createdMedia.length} newly created media records`)
      for (const id of createdMedia.reverse()) {
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
    // media 都刪掉後資料夾已空；反序（先子後父）回滾本次新建的資料夾
    if (!options.dryRun && createdFolders.length > 0) {
      console.error(`rolling back ${createdFolders.length} newly created media folders`)
      for (const id of createdFolders.reverse()) {
        try {
          await payload.delete({ collection: 'payload-folders', id })
        } catch (rollbackError) {
          console.error(
            `failed to roll back folder ${id}: ${
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
  process.stderr.write(
    `[import-kim-pixnet-post] FATAL: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  )
  exitCode = 1
})

// Payload keeps a Next.js cache connection open after local API work completes.
// This is a one-shot CLI, so exit only after every awaited import or rollback is done.
process.exit(exitCode)
