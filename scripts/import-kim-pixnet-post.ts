import fs from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@payload-config'
import { convertPixnetHtmlToLexical } from '../src/lib/blog/pixnetImport'

interface ImportedImage {
  alt?: string
  src: string
}

interface ImportedPost {
  slug: string
  title: string
  excerpt?: string
  category?: string
  tags?: string[]
  publishedAt: string
  sourceUrl?: string
  html: string
  images: ImportedImage[]
}

interface Options {
  source: string
  mediaDir: string
  dryRun: boolean
  validateOnly: boolean
  skipExisting: boolean
}

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

function uploadFilename(
  slug: string,
  index: number,
  extension: string,
): string {
  return `kim-pixnet-${slug}-${String(index + 1).padStart(3, '0')}${extension}`
}

async function validateSource(options: Options) {
  const post = JSON.parse(await fs.readFile(options.source, 'utf8')) as ImportedPost
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u.test(post.slug)) {
    throw new Error(`Unsafe slug: ${post.slug}`)
  }
  if (!post.title?.trim() || !post.html?.trim()) {
    throw new Error('The imported post requires title and html')
  }
  if (!Array.isArray(post.images) || post.images.length === 0) {
    throw new Error('The imported post requires an images array')
  }

  const mediaPaths: string[] = []
  for (const image of post.images) {
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
      post.images.map((image, index) => [image.src, `dry-${index + 1}`]),
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

  process.env.KIM_BLOG_DEPLOY_HOOK_URL = ''
  console.log('source validated; initializing Payload')
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
  let reusedMedia = 0

  try {
    for (let index = 0; index < post.images.length; index += 1) {
      const image = post.images[index]!
      const filePath = mediaPaths[index]!
      const { extension, mimetype } = mediaFileMetadata(filePath)
      const filename = uploadFilename(post.slug, index, extension)
      const reused = existingByFilename.get(filename)
      if (reused) {
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
        },
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
      images: post.images.length,
      embeddedImages: converted.embeddedMediaIds.length,
      reusedMedia,
      createdMedia: createdMedia.length,
      pendingMedia: options.dryRun ? gallery.length - reusedMedia : 0,
      nodeCounts: converted.nodeCounts,
    }
    if (options.dryRun) {
      console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2))
      return
    }

    const blogPost = await payload.create({
      collection: 'blog-posts',
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || '',
        content: converted.content,
        featuredImage: gallery[0],
        gallery,
        featured: true,
        author: author.id,
        category: CATEGORY_VALUES[post.category || ''] || 'lifestyle',
        publishToKimLafayette: true,
        sourceUrl:
          post.sourceUrl ||
          `https://youwin721.pixnet.net/blog/post/${post.slug}`,
        tags: (post.tags || []).map((tag) => ({ tag })),
        status: 'published',
        publishedAt: post.publishedAt,
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
