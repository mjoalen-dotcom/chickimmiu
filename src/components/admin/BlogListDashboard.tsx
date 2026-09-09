'use client'

import { useEffect, useState } from 'react'

import { BLOG_STATUS_UPDATED_EVENT } from './BlogQuickStatusSelect'
import BlogStudioNav from './BlogStudioNav'

type Counts = {
  kimAll: number
  kimDraft: number
  kimPassword: number
  kimPublished: number
  kimPublic: number
  kimUnlisted: number
  storeAll: number
}

const emptyCounts: Counts = {
  kimAll: 0,
  kimDraft: 0,
  kimPassword: 0,
  kimPublished: 0,
  kimPublic: 0,
  kimUnlisted: 0,
  storeAll: 0,
}

const listHref = (filter: string) =>
  `/admin/collections/blog-posts?${filter}&sort=-updatedAt`

const statusLinks = [
  {
    key: 'kimAll' as const,
    label: 'Kim 全部文章',
    filter: 'where[publishToKimLafayette][equals]=true',
    color: '#1f2937',
  },
  {
    key: 'kimPublished' as const,
    label: 'Kim 已發佈',
    filter:
      'where[publishToKimLafayette][equals]=true&where[status][equals]=published',
    color: '#087f5b',
  },
  {
    key: 'kimDraft' as const,
    label: 'Kim 草稿',
    filter: 'where[publishToKimLafayette][equals]=true&where[status][equals]=draft',
    color: '#9a3412',
  },
  {
    key: 'kimPassword' as const,
    label: 'Kim 密碼文章',
    filter:
      'where[publishToKimLafayette][equals]=true&where[status][equals]=published&where[visibility][equals]=password',
    color: '#1d4ed8',
  },
  {
    key: 'kimUnlisted' as const,
    label: 'Kim 隱密連結',
    filter:
      'where[publishToKimLafayette][equals]=true&where[status][equals]=published&where[visibility][equals]=unlisted',
    color: '#6d28d9',
  },
  {
    key: 'kimPublic' as const,
    label: 'Kim 公開文章',
    filter:
      'where[publishToKimLafayette][equals]=true&where[status][equals]=published&where[visibility][equals]=public',
    color: '#0f766e',
  },
  {
    key: 'storeAll' as const,
    label: '購物網站文章',
    filter: 'where[publishToKimLafayette][not_equals]=true',
    color: '#1d4ed8',
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

    const loadCounts = () => {
      setLoading(true)
      void Promise.all(statusLinks.map((item) => fetchCount(`&${item.filter}`)))
        .then((values) => {
          if (!active) return

          const nextCounts = { ...emptyCounts }
          statusLinks.forEach((item, index) => {
            nextCounts[item.key] = values[index] ?? 0
          })
          setCounts(nextCounts)
        })
        .catch(() => {
          if (active) setCounts(emptyCounts)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    loadCounts()
    window.addEventListener(BLOG_STATUS_UPDATED_EVENT, loadCounts)

    return () => {
      active = false
      window.removeEventListener(BLOG_STATUS_UPDATED_EVENT, loadCounts)
    }
  }, [])

  return (
    <>
      <BlogStudioNav />
      <section
        aria-labelledby="blog-workspace-title"
        style={{
          margin: '0 0 24px',
          borderTop: '1px solid var(--theme-elevation-200, #ddd)',
          borderBottom: '1px solid var(--theme-elevation-200, #ddd)',
          background: 'var(--theme-elevation-0, #fff)',
        }}
      >
        <div style={{ padding: '18px 0' }}>
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
            CHIC KIM &amp; MIU × Lafayette Kim
          </p>
          <h2 id="blog-workspace-title" style={{ margin: 0, fontSize: 22, fontWeight: 650 }}>
            文章工作台：兩個網站的文章與分類分開管理
          </h2>
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
              href={listHref(item.filter)}
              style={{
                display: 'block',
                minHeight: 88,
                padding: '17px 18px',
                borderLeft: index === 0 ? 'none' : '1px solid var(--theme-elevation-150, #e5e7eb)',
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
    </>
  )
}
