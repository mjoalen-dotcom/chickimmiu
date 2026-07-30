import { DefaultTemplate } from '@payloadcms/next/templates'
import { FolderOpen, ImagePlus, Plus } from 'lucide-react'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import BlogAlbumsGrid, { type BlogAlbumAdminCard } from './BlogAlbumsGrid'
import BlogStudioNav from './BlogStudioNav'

type MediaRow = {
  id: number | string
  filename?: string | null
  alt?: string | null
  url?: string | null
  sizes?: {
    thumbnail?: {
      url?: string | null
    } | null
  } | null
}

type BlogPostAlbumRow = {
  id: number | string
  title?: string | null
  slug?: string | null
  category?: string | null
  status?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  featuredImage?: number | string | { id?: number | string } | null
  gallery?: (number | string | { id?: number | string })[] | null
  content?: unknown
}

function relationId(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

function collectContentMedia(value: unknown, ids: Set<number | string>) {
  if (Array.isArray(value)) {
    for (const item of value) collectContentMedia(item, ids)
    return
  }
  if (!value || typeof value !== 'object') return

  const row = value as Record<string, unknown>
  if (row.relationTo === 'media') {
    const id = relationId(row.value)
    if (id != null) ids.add(id)
  }
  for (const child of Object.values(row)) collectContentMedia(child, ids)
}

function collectAlbumMedia(post: BlogPostAlbumRow) {
  const ids = new Set<number | string>()
  for (const value of [post.featuredImage, ...(post.gallery || [])]) {
    const id = relationId(value)
    if (id != null) ids.add(id)
  }
  if (ids.size === 0) collectContentMedia(post.content, ids)
  return [...ids]
}

function imageUrl(media: MediaRow, baseUrl: string) {
  const thumbnail = media.sizes?.thumbnail?.url
  const source =
    thumbnail ||
    media.url ||
    (media.filename
      ? `/api/media/file/${encodeURIComponent(media.filename)}`
      : '')
  if (!source) return ''
  if (/^https?:\/\//i.test(source) || !baseUrl) return source
  return `${baseUrl.replace(/\/$/, '')}/${source.replace(/^\//, '')}`
}

const BlogAlbumsView: React.FC<AdminViewServerProps> = async ({
  initPageResult,
  params,
  searchParams,
}) => {
  const req = initPageResult.req
  const user = req.user as { role?: string } | null
  const isAdmin = user?.role === 'admin'

  if (!isAdmin) {
    return (
      <DefaultTemplate
        i18n={req.i18n}
        locale={initPageResult.locale}
        params={params}
        payload={req.payload}
        permissions={initPageResult.permissions}
        searchParams={searchParams}
        user={req.user || undefined}
        visibleEntities={initPageResult.visibleEntities}
      >
        <div style={{ padding: 32 }}>需要管理員權限。</div>
      </DefaultTemplate>
    )
  }

  const postsResult = await req.payload.find({
    collection: 'blog-posts',
    depth: 0,
    limit: 500,
    sort: '-updatedAt',
    where: { publishToKimLafayette: { equals: true } },
  })
  const posts = postsResult.docs as BlogPostAlbumRow[]
  const albumMedia = new Map(
    posts.map((post) => [String(post.id), collectAlbumMedia(post)]),
  )
  const previewMediaIds = [
    ...new Set(
      [...albumMedia.values()].flatMap((ids) => ids.slice(0, 4)),
    ),
  ]
  const mediaResult =
    previewMediaIds.length > 0
      ? await req.payload.find({
          collection: 'media',
          depth: 0,
          limit: 100,
          where: {
            and: [
              { mimeType: { contains: 'image/' } },
              { id: { in: previewMediaIds } },
            ],
          },
        })
      : { docs: [] }
  const mediaById = new Map(
    (mediaResult.docs as MediaRow[]).map((media) => [String(media.id), media]),
  )
  const publicServerUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    ''

  const albums: BlogAlbumAdminCard[] = posts.map((post) => {
    const ids = albumMedia.get(String(post.id)) || []
    return {
      id: String(post.id),
      slug: post.slug || '',
      title: post.title || '未命名相簿',
      category: post.category || 'lifestyle',
      status: post.status || 'draft',
      publishedAt: post.publishedAt || null,
      updatedAt: post.updatedAt || null,
      photoCount: ids.length,
      previews: ids.slice(0, 4).flatMap((id) => {
        const media = mediaById.get(String(id))
        if (!media) return []
        const src = imageUrl(media, publicServerUrl)
        return src
          ? [{ id: String(media.id), src, alt: media.alt || media.filename || '' }]
          : []
      }),
    }
  })
  const totalPhotos = albums.reduce((total, album) => total + album.photoCount, 0)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <main style={{ maxWidth: 1420, margin: '0 auto', padding: '24px 32px 48px' }}>
        <BlogStudioNav />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            minHeight: 48,
            marginBottom: 22,
            borderBottom: '1px solid var(--theme-elevation-200, #dedede)',
          }}
        >
          <span
            style={{
              alignSelf: 'stretch',
              display: 'inline-flex',
              alignItems: 'center',
              borderBottom: '2px solid #a25e5e',
              color: 'var(--theme-text, #202124)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            我的相簿
          </span>
          <a
            href="/admin/collections/media"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--theme-elevation-650, #555)',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <FolderOpen aria-hidden size={16} />
            資料夾
          </a>
        </div>

        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 18,
            marginBottom: 22,
          }}
        >
          <div>
            <p
              style={{
                margin: '0 0 5px',
                color: '#a25e5e',
                fontSize: 11,
                fontWeight: 750,
                textTransform: 'uppercase',
              }}
            >
              Kim Albums
            </p>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
              我的相簿
            </h1>
            <p
              style={{
                margin: '7px 0 0',
                color: 'var(--theme-elevation-600, #666)',
                fontSize: 13,
              }}
            >
              {albums.length.toLocaleString('zh-TW')} 本相簿 ·{' '}
              {totalPhotos.toLocaleString('zh-TW')} 個檔案
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <a
              href="/admin/collections/media/create"
              style={{
                display: 'inline-flex',
                minHeight: 40,
                alignItems: 'center',
                gap: 7,
                padding: '9px 13px',
                border: '1px solid var(--theme-elevation-250, #ccc)',
                borderRadius: 6,
                color: 'var(--theme-text, #202124)',
                fontSize: 13,
                fontWeight: 650,
                textDecoration: 'none',
              }}
            >
              <ImagePlus aria-hidden size={17} />
              上傳照片
            </a>
            <a
              href="/admin/collections/blog-posts/create"
              style={{
                display: 'inline-flex',
                minHeight: 40,
                alignItems: 'center',
                gap: 7,
                padding: '9px 14px',
                borderRadius: 6,
                background: '#a25e5e',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Plus aria-hidden size={17} />
              建立相簿
            </a>
          </div>
        </header>

        <BlogAlbumsGrid albums={albums} />
      </main>
    </DefaultTemplate>
  )
}

export default BlogAlbumsView
