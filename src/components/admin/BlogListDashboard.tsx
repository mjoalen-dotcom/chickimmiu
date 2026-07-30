'use client'

import {
  ExternalLink,
  FilePenLine,
  FileText,
  FolderTree,
  Image,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'

type Counts = {
  all: number
  draft: number
  published: number
  syndicated: number
}

const emptyCounts: Counts = {
  all: 0,
  draft: 0,
  published: 0,
  syndicated: 0,
}

const quickLinks = [
  {
    href: '/admin/collections/blog-posts',
    label: '我的文章',
    icon: FileText,
  },
  {
    href: '/admin/collections/blog-posts/create',
    label: '寫文章',
    icon: FilePenLine,
    primary: true,
  },
  {
    href: '/admin/collections/media',
    label: '相簿',
    icon: Image,
  },
  {
    href: '/admin/collections/blog-categories',
    label: '分類',
    icon: FolderTree,
  },
  {
    href: '/admin/tools/blog-ai-draft',
    label: 'AI 草稿',
    icon: Sparkles,
  },
  {
    href: 'https://blog.kimlafayette.com/blog/',
    label: '查看部落格',
    icon: ExternalLink,
    external: true,
  },
]

const statusLinks = [
  {
    key: 'all' as const,
    label: '全部文章',
    href: '/admin/collections/blog-posts',
    color: '#1f2937',
  },
  {
    key: 'published' as const,
    label: '已發佈',
    href: '/admin/collections/blog-posts?where[status][equals]=published',
    color: '#087f5b',
  },
  {
    key: 'draft' as const,
    label: '草稿',
    href: '/admin/collections/blog-posts?where[status][equals]=draft',
    color: '#9a3412',
  },
  {
    key: 'syndicated' as const,
    label: 'Kim 已同步',
    href:
      '/admin/collections/blog-posts?where[publishToKimLafayette][equals]=true',
    color: '#a25e5e',
  },
]

async function fetchCount(query = '') {
  const response = await fetch(`/api/blog-posts?limit=0&depth=0${query}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as { totalDocs?: number }
  return data.totalDocs ?? 0
}

export default function BlogListDashboard() {
  const [counts, setCounts] = useState<Counts>(emptyCounts)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    Promise.all([
      fetchCount(),
      fetchCount('&where[status][equals]=draft'),
      fetchCount('&where[status][equals]=published'),
      fetchCount('&where[publishToKimLafayette][equals]=true'),
    ])
      .then(([all, draft, published, syndicated]) => {
        if (active) setCounts({ all, draft, published, syndicated })
      })
      .catch(() => {
        if (active) setCounts(emptyCounts)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section
      aria-labelledby="blog-workspace-title"
      style={{
        margin: '0 0 24px',
        borderTop: '2px solid var(--theme-text, #1f2937)',
        borderBottom: '1px solid var(--theme-elevation-200, #ddd)',
        background: 'var(--theme-elevation-0, #fff)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 0',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              color: '#a25e5e',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0,
              textTransform: 'uppercase',
            }}
          >
            Lafayette Kim
          </p>
          <h2
            id="blog-workspace-title"
            style={{ margin: 0, fontSize: 22, fontWeight: 650 }}
          >
            文章工作台
          </h2>
        </div>

        <nav
          aria-label="文章管理捷徑"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {quickLinks.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'inline-flex',
                  minHeight: 38,
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 12px',
                  border: item.primary
                    ? '1px solid #1f2937'
                    : '1px solid var(--theme-elevation-200, #ddd)',
                  borderRadius: 6,
                  background: item.primary
                    ? '#1f2937'
                    : 'var(--theme-elevation-0, #fff)',
                  color: item.primary
                    ? '#fff'
                    : 'var(--theme-text, #1f2937)',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Icon aria-hidden size={16} strokeWidth={1.8} />
                {item.label}
              </a>
            )
          })}
        </nav>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          borderTop: '1px solid var(--theme-elevation-150, #e5e7eb)',
        }}
      >
        {statusLinks.map((item, index) => (
          <a
            key={item.key}
            href={item.href}
            style={{
              display: 'block',
              minHeight: 88,
              padding: '17px 18px',
              borderLeft:
                index === 0
                  ? 'none'
                  : '1px solid var(--theme-elevation-150, #e5e7eb)',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                display: 'block',
                color: 'var(--theme-elevation-600, #666)',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {item.label}
            </span>
            <strong
              style={{
                display: 'block',
                marginTop: 6,
                color: item.color,
                fontSize: 25,
                fontWeight: 650,
                lineHeight: 1,
              }}
            >
              {loading ? '—' : counts[item.key].toLocaleString('zh-TW')}
            </strong>
          </a>
        ))}
      </div>
    </section>
  )
}
