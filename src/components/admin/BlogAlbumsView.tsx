/* eslint-disable @next/next/no-img-element */
import { DefaultTemplate } from '@payloadcms/next/templates'
import { FolderOpen, ImagePlus, Images } from 'lucide-react'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import BlogStudioNav from './BlogStudioNav'

type MediaRow = {
  id: number | string
  filename?: string | null
  alt?: string | null
  url?: string | null
  mimeType?: string | null
  updatedAt?: string | null
  sizes?: {
    thumbnail?: {
      url?: string | null
    } | null
  } | null
}

function imageUrl(media: MediaRow) {
  const thumbnail = media.sizes?.thumbnail?.url
  if (thumbnail) return thumbnail
  if (media.url) return media.url
  if (media.filename) {
    return `/api/media/file/${encodeURIComponent(media.filename)}`
  }
  return ''
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Taipei',
  }).format(date)
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

  const mediaResult = await req.payload.find({
    collection: 'media',
    depth: 0,
    limit: 24,
    sort: '-updatedAt',
    where: { mimeType: { contains: 'image/' } },
  })
  const media = mediaResult.docs as MediaRow[]

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
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px 48px' }}>
        <BlogStudioNav />

        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
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
              Albums
            </p>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>相簿</h1>
            <p
              style={{
                margin: '7px 0 0',
                color: 'var(--theme-elevation-600, #666)',
                fontSize: 13,
              }}
            >
              {mediaResult.totalDocs.toLocaleString('zh-TW')} 張圖片
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <a
              href="/admin/collections/media"
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
              <FolderOpen aria-hidden size={17} />
              資料夾管理
            </a>
            <a
              href="/admin/collections/media/create"
              style={{
                display: 'inline-flex',
                minHeight: 40,
                alignItems: 'center',
                gap: 7,
                padding: '9px 13px',
                borderRadius: 6,
                background: '#202124',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ImagePlus aria-hidden size={17} />
              上傳照片
            </a>
          </div>
        </header>

        {media.length === 0 ? (
          <div
            style={{
              display: 'grid',
              minHeight: 240,
              placeItems: 'center',
              borderTop: '1px solid var(--theme-elevation-200, #ddd)',
              borderBottom: '1px solid var(--theme-elevation-200, #ddd)',
              color: 'var(--theme-elevation-550, #666)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Images aria-hidden size={30} strokeWidth={1.4} />
              <p>尚無圖片</p>
            </div>
          </div>
        ) : (
          <section
            aria-label="最近圖片"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 14,
            }}
          >
            {media.map((item) => {
              const src = imageUrl(item)
              return (
                <a
                  key={String(item.id)}
                  href={`/admin/collections/media/${item.id}`}
                  style={{
                    display: 'block',
                    overflow: 'hidden',
                    border: '1px solid var(--theme-elevation-200, #ddd)',
                    borderRadius: 6,
                    background: 'var(--theme-elevation-0, #fff)',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '1 / 1',
                      overflow: 'hidden',
                      background: 'var(--theme-elevation-100, #f3f3f3)',
                    }}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={item.alt || item.filename || ''}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ padding: '9px 10px' }}>
                    <strong
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        fontSize: 12,
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.filename || '未命名圖片'}
                    </strong>
                    <span
                      style={{
                        display: 'block',
                        marginTop: 4,
                        color: 'var(--theme-elevation-550, #666)',
                        fontSize: 11,
                      }}
                    >
                      {formatDate(item.updatedAt)}
                    </span>
                  </div>
                </a>
              )
            })}
          </section>
        )}
      </main>
    </DefaultTemplate>
  )
}

export default BlogAlbumsView
