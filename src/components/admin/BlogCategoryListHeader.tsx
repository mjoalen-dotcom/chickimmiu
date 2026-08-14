'use client'

import { Tags } from 'lucide-react'
import React from 'react'

import BlogStudioNav from './BlogStudioNav'

const categoryLinks = [
  {
    href: '/admin/collections/blog-categories?where[site][equals]=store&sort=displayOrder',
    label: '購物網站分類',
    description: 'pre.chickimmiu.com／未勾選金老佛爺的文章',
  },
  {
    href: '/admin/collections/blog-categories?where[site][equals]=kim&sort=displayOrder',
    label: '金老佛爺分類',
    description: 'blog.kimlafayette.com／已勾選金老佛爺的文章',
  },
]

export default function BlogCategoryListHeader() {
  return (
    <>
      <BlogStudioNav />
      <section
        aria-labelledby="two-site-blog-categories-title"
        style={{
          margin: '0 0 24px',
          padding: '18px 0',
          borderTop: '1px solid var(--theme-elevation-200, #ddd)',
          borderBottom: '1px solid var(--theme-elevation-200, #ddd)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Tags aria-hidden size={19} strokeWidth={1.8} />
          <h2 id="two-site-blog-categories-title" style={{ margin: 0, fontSize: 21 }}>
            兩個網站的部落格文章分類
          </h2>
        </div>
        <p
          style={{
            maxWidth: 760,
            margin: '8px 0 14px',
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          分類依網站獨立管理；名稱、網址與 SEO 可各自設定，文章會用「文章網站＋分類值」配對，不改寫既有文章內容。
        </p>
        <nav aria-label="兩站分類篩選" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {categoryLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                minWidth: 230,
                padding: '10px 12px',
                border: '1px solid var(--theme-elevation-250, #d1d5db)',
                borderRadius: 6,
                color: 'var(--theme-text, #1f2937)',
                textDecoration: 'none',
              }}
            >
              <strong style={{ display: 'block', fontSize: 13 }}>{item.label}</strong>
              <span style={{ display: 'block', marginTop: 3, fontSize: 11, opacity: 0.72 }}>
                {item.description}
              </span>
            </a>
          ))}
        </nav>
      </section>
    </>
  )
}
