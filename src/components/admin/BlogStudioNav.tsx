'use client'

import {
  ExternalLink,
  FilePenLine,
  FileText,
  Images,
  LayoutDashboard,
  Sparkles,
  Store,
  Tags,
} from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import React from 'react'

const items = [
  {
    href: '/admin/blog-studio',
    label: '金老佛爺總覽',
    icon: LayoutDashboard,
    match: (pathname: string) => pathname === '/admin/blog-studio',
  },
  {
    href: '/admin/collections/blog-posts?where[publishToKimLafayette][equals]=true',
    label: 'Kim 文章',
    icon: FileText,
    articleScope: 'kim',
    match: (pathname: string) =>
      pathname.startsWith('/admin/collections/blog-posts') && !pathname.endsWith('/create'),
  },
  {
    href: '/admin/collections/blog-posts?where[publishToKimLafayette][not_equals]=true',
    label: '購物網站文章',
    icon: Store,
    articleScope: 'store',
    match: (pathname: string) =>
      pathname.startsWith('/admin/collections/blog-posts') && !pathname.endsWith('/create'),
  },
  {
    href: '/admin/collections/blog-posts/create',
    label: '寫文章',
    icon: FilePenLine,
    match: (pathname: string) => pathname === '/admin/collections/blog-posts/create',
  },
  {
    href: '/admin/blog-studio/albums',
    label: 'Kim 相簿',
    icon: Images,
    match: (pathname: string) => pathname.startsWith('/admin/blog-studio/albums'),
  },
  {
    href: '/admin/collections/blog-categories?where[site][equals]=kim&sort=displayOrder',
    label: 'Kim 分類',
    icon: Tags,
    categoryScope: 'kim',
    match: (pathname: string) => pathname.startsWith('/admin/collections/blog-categories'),
  },
  {
    href: '/admin/collections/blog-categories?where[site][equals]=store&sort=displayOrder',
    label: '購物網站分類',
    icon: Tags,
    categoryScope: 'store',
    match: (pathname: string) => pathname.startsWith('/admin/collections/blog-categories'),
  },
  {
    href: '/admin/tools/blog-ai-draft',
    label: '自動文章',
    icon: Sparkles,
    match: (pathname: string) => pathname.startsWith('/admin/tools/blog-ai-draft'),
  },
  {
    href: 'https://blog.kimlafayette.com/blog/',
    label: 'Kim 前台',
    icon: ExternalLink,
    external: true,
    match: () => false,
  },
  {
    href: 'https://pre.chickimmiu.com/blog',
    label: '購物站前台',
    icon: ExternalLink,
    external: true,
    match: () => false,
  },
]

export default function BlogStudioNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentArticleScope = searchParams.get('where[publishToKimLafayette][equals]') === 'true'
    ? 'kim'
    : searchParams.get('where[publishToKimLafayette][not_equals]') === 'true'
      ? 'store'
      : null
  const currentCategoryScope = searchParams.get('where[site][equals]')

  return (
    <div
      className="blog-studio-nav"
      style={{
        marginBottom: 24,
        borderTop: '2px solid var(--theme-text, #202124)',
        borderBottom: '1px solid var(--theme-elevation-200, #dedede)',
        background: 'var(--theme-elevation-0, #fff)',
      }}
    >
      <div
        style={{
          display: 'flex',
          minHeight: 44,
          alignItems: 'center',
          gap: 6,
          padding: '8px 0',
          overflowX: 'auto',
        }}
      >
        <strong
          style={{
            flex: '0 0 auto',
            marginRight: 10,
            color: 'var(--theme-text, #202124)',
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          兩站部落格
        </strong>
        {items.map((item) => {
          const Icon = item.icon
          const active =
            item.match(pathname) &&
            (!item.articleScope || item.articleScope === currentArticleScope) &&
            (!item.categoryScope || item.categoryScope === currentCategoryScope)

          return (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'inline-flex',
                flex: '0 0 auto',
                minHeight: 34,
                alignItems: 'center',
                gap: 6,
                padding: '6px 9px',
                borderRadius: 5,
                background: active ? 'var(--theme-elevation-100, #f0f0f0)' : 'transparent',
                color: active ? 'var(--theme-text, #202124)' : 'var(--theme-elevation-650, #555)',
                fontSize: 12,
                fontWeight: active ? 700 : 550,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon aria-hidden size={15} strokeWidth={1.8} />
              {item.label}
            </a>
          )
        })}
      </div>
    </div>
  )
}
