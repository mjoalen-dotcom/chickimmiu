'use client'

import { ExternalLink, Images, MoreVertical, Search } from 'lucide-react'
import React, { useMemo, useState } from 'react'

export type BlogAlbumAdminCard = {
  id: string
  slug: string
  title: string
  category: string
  status: string
  publishedAt: string | null
  updatedAt: string | null
  photoCount: number
  previews: Array<{
    id: string
    src: string
    alt: string
  }>
}

const categoryLabels: Record<string, string> = {
  styling: '穿搭教學',
  'new-arrivals': '新品介紹',
  'brand-story': '品牌故事',
  promotions: '優惠活動',
  trends: '時尚趨勢',
  fashion: '時尚流行',
  beauty: '美容彩妝',
  shopping: '購物情報',
  food: '美食料理',
  lifestyle: '生活綜合',
  parenting: '親子育兒',
  travel: '旅遊紀錄',
}

function formatDate(value: string | null) {
  if (!value) return '尚未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Taipei',
  }).format(date)
}

function previewCellStyle(index: number, total: number): React.CSSProperties {
  if (total === 1) return { gridColumn: 'span 2', gridRow: 'span 2' }
  if (total === 2) return { gridRow: 'span 2' }
  if (total === 3 && index === 0) return { gridRow: 'span 2' }
  return {}
}

export default function BlogAlbumsGrid({
  albums,
}: {
  albums: BlogAlbumAdminCard[]
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')

  const categories = useMemo(
    () => [...new Set(albums.map((album) => album.category))].sort(),
    [albums],
  )
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-TW')
    const result = albums.filter((album) => {
      if (status !== 'all' && album.status !== status) return false
      if (category !== 'all' && album.category !== category) return false
      if (!normalized) return true
      return [album.title, categoryLabels[album.category] || album.category]
        .join(' ')
        .toLocaleLowerCase('zh-TW')
        .includes(normalized)
    })

    return result.sort((left, right) => {
      if (sort === 'oldest') {
        return String(left.publishedAt || left.updatedAt).localeCompare(
          String(right.publishedAt || right.updatedAt),
        )
      }
      if (sort === 'title') return left.title.localeCompare(right.title, 'zh-TW')
      if (sort === 'photos') return right.photoCount - left.photoCount
      return String(right.publishedAt || right.updatedAt).localeCompare(
        String(left.publishedAt || left.updatedAt),
      )
    })
  }, [albums, category, query, sort, status])

  const controlStyle: React.CSSProperties = {
    minHeight: 40,
    border: '1px solid var(--theme-elevation-250, #d5d5d5)',
    borderRadius: 6,
    background: 'var(--theme-elevation-0, #fff)',
    color: 'var(--theme-text, #202124)',
    fontSize: 13,
  }

  return (
    <section aria-label="相簿管理">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 9,
          marginBottom: 22,
          padding: '14px 0',
          borderTop: '1px solid var(--theme-elevation-150, #ececec)',
          borderBottom: '1px solid var(--theme-elevation-150, #ececec)',
        }}
      >
        <label
          style={{
            position: 'relative',
            flex: '1 1 260px',
            maxWidth: 390,
          }}
        >
          <Search
            aria-hidden
            size={17}
            style={{
              position: 'absolute',
              top: '50%',
              left: 12,
              color: 'var(--theme-elevation-500, #777)',
              transform: 'translateY(-50%)',
            }}
          />
          <input
            aria-label="搜尋相簿名稱"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋名稱"
            style={{
              ...controlStyle,
              width: '100%',
              padding: '8px 12px 8px 38px',
            }}
          />
        </label>

        <select
          aria-label="相簿排序"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          style={{ ...controlStyle, padding: '8px 32px 8px 11px' }}
        >
          <option value="newest">日期最新</option>
          <option value="oldest">日期最舊</option>
          <option value="title">名稱排序</option>
          <option value="photos">照片最多</option>
        </select>
        <select
          aria-label="公開狀態"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          style={{ ...controlStyle, padding: '8px 32px 8px 11px' }}
        >
          <option value="all">全部狀態</option>
          <option value="published">公開</option>
          <option value="draft">草稿</option>
        </select>
        <select
          aria-label="相簿分類"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          style={{ ...controlStyle, padding: '8px 32px 8px 11px' }}
        >
          <option value="all">全部分類</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {categoryLabels[value] || value}
            </option>
          ))}
        </select>
        <span
          style={{
            marginLeft: 'auto',
            color: 'var(--theme-elevation-550, #666)',
            fontSize: 12,
            whiteSpace: 'nowrap',
          }}
        >
          {filtered.length.toLocaleString('zh-TW')} 本相簿
        </span>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            display: 'grid',
            minHeight: 240,
            placeItems: 'center',
            color: 'var(--theme-elevation-550, #666)',
          }}
        >
          找不到符合條件的相簿
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '24px 16px',
          }}
        >
          {filtered.map((album) => {
            const published = album.status === 'published'
            return (
              <article key={album.id} style={{ minWidth: 0 }}>
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    aspectRatio: '4 / 3',
                    border: '1px solid var(--theme-elevation-200, #ddd)',
                    borderRadius: 7,
                    background: 'var(--theme-elevation-100, #f3f3f3)',
                  }}
                >
                  <a
                    href={`/admin/collections/blog-posts/${album.id}`}
                    aria-label={`編輯相簿 ${album.title}`}
                    style={{
                      display: 'grid',
                      width: '100%',
                      height: '100%',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                      gap: 2,
                    }}
                  >
                    {album.previews.length > 0 ? (
                      album.previews.map((preview, index) => (
                        <span
                          key={preview.id}
                          style={{
                            position: 'relative',
                            display: 'block',
                            minWidth: 0,
                            minHeight: 0,
                            overflow: 'hidden',
                            ...previewCellStyle(index, album.previews.length),
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preview.src}
                            alt=""
                            loading="lazy"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </span>
                      ))
                    ) : (
                      <span
                        style={{
                          gridColumn: 'span 2',
                          gridRow: 'span 2',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--theme-elevation-450, #888)',
                        }}
                      >
                        <Images aria-hidden size={30} strokeWidth={1.4} />
                      </span>
                    )}
                  </a>
                  <span
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: published ? '#fff7ed' : '#f3f4f6',
                      color: published ? '#a25e5e' : '#555',
                      fontSize: 11,
                      fontWeight: 750,
                      boxShadow: '0 1px 4px rgb(0 0 0 / 12%)',
                    }}
                  >
                    {published ? '公開' : '草稿'}
                  </span>
                  <a
                    href={`/admin/collections/blog-posts/${album.id}`}
                    aria-label={`更多相簿操作：${album.title}`}
                    title="編輯相簿文章"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      display: 'grid',
                      width: 32,
                      height: 32,
                      placeItems: 'center',
                      borderRadius: 6,
                      background: 'rgb(255 255 255 / 92%)',
                      color: '#303030',
                      boxShadow: '0 1px 5px rgb(0 0 0 / 14%)',
                    }}
                  >
                    <MoreVertical aria-hidden size={17} />
                  </a>
                </div>

                <div style={{ padding: '10px 2px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        color: '#a25e5e',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {categoryLabels[album.category] || album.category}
                    </span>
                    {published && album.slug ? (
                      <a
                        href={`https://blog.kimlafayette.com/albums/${album.slug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`查看相簿 ${album.title}`}
                        title="查看相簿"
                        style={{ display: 'inline-flex', color: '#666' }}
                      >
                        <ExternalLink aria-hidden size={14} />
                      </a>
                    ) : null}
                  </div>
                  <a
                    href={`/admin/collections/blog-posts/${album.id}`}
                    style={{
                      display: '-webkit-box',
                      minHeight: 42,
                      marginTop: 5,
                      overflow: 'hidden',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      color: 'var(--theme-text, #202124)',
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1.5,
                      textDecoration: 'none',
                    }}
                  >
                    {album.title}
                  </a>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 8,
                      color: 'var(--theme-elevation-550, #666)',
                      fontSize: 11,
                    }}
                  >
                    <span>{formatDate(album.publishedAt || album.updatedAt)}</span>
                    <span>{album.photoCount.toLocaleString('zh-TW')} 個檔案</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
