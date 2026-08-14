'use client'

import React, { useEffect } from 'react'

/**
 * KimBlogNavGroup — 把金老佛爺部落格的自訂 view 連結注入 Payload 原生
 * 「Ⓚ 兩站部落格」group（該 group 由 BlogPosts / BlogCategories 的
 * admin.group 自動聚合產生，位置由 payload.config.ts collections[] 陣列
 * 排最前決定 = 緊接 ⓪ 數據儀表之後）。
 *
 * 注入後群組內最終順序：
 *   部落格工作台（prepend）→ 部落格文章 → 兩站分類（原生連結）→
 *   購物網站分類 / Kim 分類 → 相簿 → 自動文章工具 → 兩站前台（append）
 *
 * 為什麼 DOM 注入：同 CKMUSystemToolsNavGroup — Payload v3 group 由
 * collections/globals 的 admin.group 自動聚合，沒有公開 API 讓自訂 view
 * 掛進現有 group；另開手刻 group 視覺會裂成兩塊。失效模式一樣：Payload
 * 重渲染 sidebar 時注入會掉，掛 MutationObserver 每次 DOM 變動重做
 * （有 attribute 標記防重複）。
 *
 * 對應 src/payload.config.ts admin.components.afterNavLinks。
 */

interface Item {
  href: string
  label: string
  id: string
  external?: boolean
}

const TARGET_GROUP_LABEL = 'Ⓚ 兩站部落格'
const INJECTED_ATTR = 'data-ckmu-kimblog-injected'

// prepend：群組第一項 — 工作台是部落格營運入口
const prependItems: Item[] = [
  {
    href: '/admin/blog-studio',
    label: '部落格工作台',
    id: 'nav-kimblog-studio',
  },
]

// append：排在原生 collection 連結（文章 / 分類）之後
const appendItems: Item[] = [
  {
    href: '/admin/collections/blog-categories?where[site][equals]=store&sort=displayOrder',
    label: '購物網站文章分類',
    id: 'nav-blog-categories-store',
  },
  {
    href: '/admin/collections/blog-categories?where[site][equals]=kim&sort=displayOrder',
    label: '金老佛爺文章分類',
    id: 'nav-blog-categories-kim',
  },
  {
    href: '/admin/blog-studio/albums',
    label: '相簿',
    id: 'nav-kimblog-albums',
  },
  {
    href: '/admin/tools/blog-ai-draft',
    label: '📝 自動文章工具',
    id: 'nav-kimblog-ai-draft',
  },
  {
    href: 'https://blog.kimlafayette.com/blog/',
    label: '查看 Kim 部落格 ↗',
    id: 'nav-kimblog-view-site',
    external: true,
  },
  {
    href: 'https://pre.chickimmiu.com/blog',
    label: '查看購物網站部落格 ↗',
    id: 'nav-storeblog-view-site',
    external: true,
  },
]

function findGroupContent(): Element | null {
  const toggles = document.querySelectorAll('.nav-group__toggle')
  for (const t of Array.from(toggles)) {
    const text = (t.textContent || '').trim()
    if (text === TARGET_GROUP_LABEL) {
      const group = t.closest('.nav-group')
      if (group) return group.querySelector('.nav-group__content')
    }
  }
  return null
}

function buildLink(item: Item): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = item.href
  a.id = item.id
  a.className = 'nav__link'
  a.setAttribute(INJECTED_ATTR, '1')
  if (item.external) {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  }
  const span = document.createElement('span')
  span.className = 'nav__link-label'
  span.textContent = item.label
  a.appendChild(span)
  return a
}

function injectItems() {
  const content = findGroupContent()
  if (!content) return
  if (content.querySelector(`[${INJECTED_ATTR}]`)) return

  for (const item of [...prependItems].reverse()) {
    content.insertBefore(buildLink(item), content.firstChild)
  }
  for (const item of appendItems) {
    content.appendChild(buildLink(item))
  }
}

const KimBlogNavGroup: React.FC = () => {
  useEffect(() => {
    injectItems()
    const observer = new MutationObserver(() => {
      injectItems()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}

export default KimBlogNavGroup
