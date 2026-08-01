import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  collectKimBlogGallery,
  collectKimBlogImages,
  kimBlogCategoryLabel,
  kimBlogMediaUrl,
  kimBlogSourceUrl,
  kimBlogTags,
  serializeLexicalForKimBlog,
} from '@/lib/blog/kimFeed'

export const dynamic = 'force-dynamic'

function responseHeaders(etag?: string) {
  return {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...(etag ? { ETag: etag } : {}),
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com'
    ).replace(/\/$/, '')
    const result = await payload.find({
      collection: 'blog-posts',
      where: {
        and: [
          { status: { equals: 'published' } },
          { publishToKimLafayette: { equals: true } },
        ],
      },
      sort: '-publishedAt',
      limit: 1000,
      depth: 2,
      overrideAccess: false,
    })

    const posts = (result.docs as unknown as Array<Record<string, unknown>>)
      .filter((doc) => typeof doc.slug === 'string' && doc.slug.trim() !== '')
      .map((doc) => {
        const slug = String(doc.slug)
        const images = [
          ...collectKimBlogImages(doc.content, baseUrl),
          ...collectKimBlogGallery(doc.gallery, baseUrl),
        ].filter(
          (image, index, allImages) =>
            allImages.findIndex((candidate) => candidate.src === image.src) ===
            index,
        )
        const featuredImage = kimBlogMediaUrl(doc.featuredImage, baseUrl)
        const excerptCtaUrl = String(doc.excerptCtaUrl || '').trim()
        const excerptCta =
          doc.excerptCtaEnabled && /^https?:\/\//i.test(excerptCtaUrl)
            ? {
                enabled: true,
                label: String(doc.excerptCtaLabel || '立即購買').trim() || '立即購買',
                url: excerptCtaUrl,
              }
            : null
        return {
          version: 1,
          origin: 'payload',
          id: `payload-${String(doc.id)}`,
          slug,
          sourceUrl: kimBlogSourceUrl(doc.sourceUrl, slug),
          title: String(doc.title ?? ''),
          excerpt: String(doc.excerpt ?? ''),
          excerptCta,
          category: kimBlogCategoryLabel(doc.category),
          tags: kimBlogTags(doc.tags),
          publishedAt: String(doc.publishedAt || doc.createdAt || ''),
          viewCount: Math.max(
            0,
            Math.trunc(Number.isFinite(Number(doc.viewCount)) ? Number(doc.viewCount) : 0),
          ),
          migratedAt: String(doc.updatedAt || new Date().toISOString()),
          featuredImage,
          imageCount: images.length,
          html: serializeLexicalForKimBlog(doc.content, baseUrl),
          images,
        }
      })

    const generatedAt =
      posts
        .map((post) => post.migratedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || '1970-01-01T00:00:00.000Z'
    const body = JSON.stringify({
      version: 1,
      generatedAt,
      posts,
    })
    const etag = `"${createHash('sha256').update(body).digest('base64url')}"`
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: responseHeaders(etag) })
    }
    return new NextResponse(body, { status: 200, headers: responseHeaders(etag) })
  } catch (error) {
    console.error(
      '[api/kim-blog/feed] failed:',
      error instanceof Error ? error.message : String(error),
    )
    return NextResponse.json(
      { error: 'Kim blog feed is temporarily unavailable' },
      { status: 503, headers: responseHeaders() },
    )
  }
}
