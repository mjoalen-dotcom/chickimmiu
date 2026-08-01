import { DefaultTemplate } from '@payloadcms/next/templates'
import { FilePenLine, FileText, Images, Mail, Radio, Store, Tags } from 'lucide-react'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { getKimBlogAnalytics } from '@/lib/blog/kimBlogAnalytics'

import BlogAnalyticsPanel from './BlogAnalyticsPanel'
import BlogQuickStatusSelect from './BlogQuickStatusSelect'
import BlogStudioNav from './BlogStudioNav'

type BlogPostRow = {
  id: number | string
  title?: string | null
  category?: string | null
  status?: string | null
  visibility?: string | null
  accessPasswordHash?: string | null
  publishToKimLafayette?: boolean | null
  publishedAt?: string | null
  updatedAt?: string | null
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
  'kpop-boy-groups': 'KPOP 男團介紹',
  'kpop-girl-groups': 'KPOP 女團介紹',
}

function formatDate(value?: string | null) {
  if (!value) return '尚未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Taipei',
  }).format(date)
}

const BlogStudioView: React.FC<AdminViewServerProps> = async ({
  initPageResult,
  params,
  searchParams,
}) => {
  const req = initPageResult.req
  const user = req.user as { role?: string } | null
  const isAdmin = user?.role === 'admin'
  const rawDays = Array.isArray(searchParams?.days)
    ? searchParams.days[0]
    : searchParams?.days
  const requestedDays = Number(rawDays)
  const analyticsDays = [7, 30, 90].includes(requestedDays)
    ? requestedDays
    : 30

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

  const [
    recentPosts,
    allPosts,
    publishedPosts,
    draftPosts,
    storePosts,
    subscribers,
    categories,
    analytics,
  ] = await Promise.all([
      req.payload.find({
        collection: 'blog-posts',
        depth: 0,
        limit: 8,
        sort: '-updatedAt',
        where: { publishToKimLafayette: { equals: true } },
      }),
      req.payload.find({
        collection: 'blog-posts',
        depth: 0,
        limit: 1,
        where: { publishToKimLafayette: { equals: true } },
      }),
      req.payload.find({
        collection: 'blog-posts',
        depth: 0,
        limit: 1,
        where: {
          and: [
            { publishToKimLafayette: { equals: true } },
            { status: { equals: 'published' } },
          ],
        },
      }),
      req.payload.find({
        collection: 'blog-posts',
        depth: 0,
        limit: 1,
        where: {
          and: [
            { publishToKimLafayette: { equals: true } },
            { status: { equals: 'draft' } },
          ],
        },
      }),
      req.payload.find({
        collection: 'blog-posts',
        depth: 0,
        limit: 1,
        where: { publishToKimLafayette: { not_equals: true } },
      }),
      req.payload.find({
        collection: 'newsletter-subscribers',
        depth: 0,
        limit: 1,
        where: {
          and: [
            { kimBlogSubscribed: { equals: true } },
            { status: { equals: 'subscribed' } },
          ],
        },
      }),
      req.payload.find({
        collection: 'blog-categories',
        depth: 0,
        limit: 1,
      }),
      getKimBlogAnalytics(req.payload, analyticsDays),
    ])

  const stats = [
    {
      label: '金老佛爺文章',
      value: allPosts.totalDocs,
      href: '/admin/collections/blog-posts?where[publishToKimLafayette][equals]=true',
      color: '#202124',
    },
    {
      label: '已發佈',
      value: publishedPosts.totalDocs,
      href: '/admin/collections/blog-posts?where[publishToKimLafayette][equals]=true&where[status][equals]=published',
      color: '#087f5b',
    },
    {
      label: '草稿',
      value: draftPosts.totalDocs,
      href: '/admin/collections/blog-posts?where[publishToKimLafayette][equals]=true&where[status][equals]=draft',
      color: '#9a3412',
    },
    {
      label: '文章訂閱',
      value: subscribers.totalDocs,
      href: '/admin/collections/newsletter-subscribers?where[kimBlogSubscribed][equals]=true',
      color: '#a25e5e',
    },
  ]

  const recent = recentPosts.docs as BlogPostRow[]

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
              Blog Control Panel
            </p>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
              金老佛爺部落格儀表板
            </h1>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                minHeight: 40,
                alignItems: 'center',
                gap: 7,
                padding: '9px 12px',
                border: '1px solid #a25e5e',
                borderRadius: 6,
                color: '#a25e5e',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Radio aria-hidden size={16} />
              金老佛爺部落格
            </span>
            <a
              href="/admin/collections/blog-posts?where[publishToKimLafayette][not_equals]=true"
              style={{
                display: 'inline-flex',
                minHeight: 40,
                alignItems: 'center',
                gap: 7,
                padding: '9px 12px',
                border: '1px solid var(--theme-elevation-250, #ccc)',
                borderRadius: 6,
                color: 'var(--theme-text, #202124)',
                fontSize: 12,
                fontWeight: 650,
                textDecoration: 'none',
              }}
            >
              <Store aria-hidden size={16} />
              購物網站文章 {storePosts.totalDocs}
            </a>
            <a
              href="/admin/collections/blog-posts/create"
              style={{
                display: 'inline-flex',
                minHeight: 40,
                alignItems: 'center',
                gap: 8,
                padding: '9px 14px',
                borderRadius: 6,
                background: '#202124',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <FilePenLine aria-hidden size={17} />
              寫文章
            </a>
          </div>
        </header>

        <BlogAnalyticsPanel analytics={analytics} />

        <section
          aria-label="金老佛爺文章統計"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            borderTop: '1px solid var(--theme-elevation-200, #dedede)',
            borderBottom: '1px solid var(--theme-elevation-200, #dedede)',
            marginBottom: 30,
          }}
        >
          {stats.map((stat, index) => (
            <a
              key={stat.label}
              href={stat.href}
              style={{
                minHeight: 92,
                padding: '18px 20px',
                borderLeft: index === 0 ? 'none' : '1px solid var(--theme-elevation-200, #dedede)',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  display: 'block',
                  color: 'var(--theme-elevation-600, #666)',
                  fontSize: 12,
                }}
              >
                {stat.label}
              </span>
              <strong
                style={{
                  display: 'block',
                  marginTop: 7,
                  color: stat.color,
                  fontSize: 27,
                  lineHeight: 1,
                }}
              >
                {stat.value.toLocaleString('zh-TW')}
              </strong>
            </a>
          ))}
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 30,
          }}
        >
          <section aria-labelledby="recent-posts-title">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h2 id="recent-posts-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                金老佛爺最近文章
              </h2>
              <a
                href="/admin/collections/blog-posts?where[publishToKimLafayette][equals]=true"
                style={{ color: '#a25e5e', fontSize: 12, fontWeight: 700 }}
              >
                查看全部
              </a>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: 690,
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid #d8d8d8' }}>
                    {['編輯', '文章', '狀態', '分類', '更新時間'].map((heading, index) => (
                      <th
                        key={heading}
                        style={{
                          padding: '10px 8px',
                          ...(index === 0
                            ? {
                                position: 'sticky' as const,
                                left: 0,
                                zIndex: 2,
                                width: 54,
                                background: 'var(--theme-bg, #fff)',
                              }
                            : {}),
                          color: 'var(--theme-elevation-550, #6a6a6a)',
                          fontWeight: 650,
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.length > 0 ? (
                    recent.map((post) => (
                      <tr
                        key={String(post.id)}
                        style={{
                          borderBottom: '1px solid var(--theme-elevation-150, #ececec)',
                        }}
                      >
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          width: 54,
                          padding: '13px 8px',
                          background: 'var(--theme-bg, #fff)',
                        }}
                      >
                        <a
                          href={`/admin/collections/blog-posts/${post.id}`}
                          style={{ color: '#a25e5e', fontWeight: 700 }}
                        >
                          編輯
                        </a>
                      </td>
                      <td style={{ maxWidth: 360, padding: '13px 8px' }}>
                        <a
                          href={`/admin/collections/blog-posts/${post.id}`}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            color: 'var(--theme-text, #202124)',
                            fontWeight: 650,
                            textOverflow: 'ellipsis',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {post.title || '未命名文章'}
                        </a>
                      </td>
                      <td style={{ padding: '13px 8px', whiteSpace: 'nowrap' }}>
                        <BlogQuickStatusSelect
                          id={post.id}
                          status={post.status}
                          visibility={post.visibility}
                          hasPassword={Boolean(post.accessPasswordHash)}
                        />
                      </td>
                      <td style={{ padding: '13px 8px', whiteSpace: 'nowrap' }}>
                        {post.category ? categoryLabels[post.category] || post.category : '未分類'}
                      </td>
                      <td
                        style={{
                          padding: '13px 8px',
                          color: 'var(--theme-elevation-550, #6a6a6a)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(post.updatedAt || post.publishedAt)}
                      </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: '22px 8px',
                          color: 'var(--theme-elevation-550, #6a6a6a)',
                        }}
                      >
                        尚無金老佛爺文章。新增文章時請在「發佈網站」勾選
                        blog.kimlafayette.com。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside aria-labelledby="content-tools-title">
            <h2
              id="content-tools-title"
              style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}
            >
              內容管理
            </h2>
            <div
              style={{
                borderTop: '1px solid var(--theme-elevation-200, #dedede)',
              }}
            >
              {[
                {
                  href: '/admin/collections/blog-posts?where[publishToKimLafayette][equals]=true',
                  label: '金老佛爺文章',
                  value: `${allPosts.totalDocs} 篇`,
                  icon: FileText,
                },
                {
                  href: '/admin/blog-studio/albums',
                  label: '金老佛爺相簿',
                  value: '專屬圖片',
                  icon: Images,
                },
                {
                  href: '/admin/collections/blog-categories',
                  label: '共用分類',
                  value: `${categories.totalDocs} 個`,
                  icon: Tags,
                },
                {
                  href: '/admin/collections/newsletter-subscribers?where[kimBlogSubscribed][equals]=true',
                  label: '文章訂閱名單',
                  value: `${subscribers.totalDocs} 位`,
                  icon: Mail,
                },
                {
                  href: 'https://blog.kimlafayette.com/blog/',
                  label: '正式部落格',
                  value: '開啟',
                  icon: Radio,
                  external: true,
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    style={{
                      display: 'flex',
                      minHeight: 58,
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: '1px solid var(--theme-elevation-200, #dedede)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon aria-hidden size={18} strokeWidth={1.7} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 650 }}>{item.label}</span>
                    <span
                      style={{
                        color: 'var(--theme-elevation-550, #6a6a6a)',
                        fontSize: 12,
                      }}
                    >
                      {item.value}
                    </span>
                  </a>
                )
              })}
            </div>
          </aside>
        </div>
      </main>
    </DefaultTemplate>
  )
}

export default BlogStudioView
