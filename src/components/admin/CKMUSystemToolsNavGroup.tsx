'use client'

import React, { useEffect } from 'react'

/**
 * CKMUSystemToolsNavGroup — 把「AI 部落格草稿產生器」「REST API 文件」
 * 兩個自訂 view 注入 Payload 原生「⑦ 系統與安全」group 的 nav 列表。
 *
 * 為什麼用 DOM 注入而不再開一個獨立 group：
 *   - 使用者體驗：「系統與安全」「系統工具」分兩個一前一後的群組視覺很碎；
 *     工具 / 系統設定 / 安全 collections 都屬於同一個營運面向，合併成單一群組
 *     更符合心智模型。
 *   - Payload v3 sidebar group 由 collections/globals 的 `admin.group` 自動聚合，
 *     沒有公開 API 讓自訂 view 直接掛進現有 group。所以走 DOM 注入：找到
 *     `⑦ 系統與安全` 的 `.nav-group__content` 然後把工具連結 append 進去。
 *   - 用 collection stub 假冒群組成員會在 DB 多一張無意義的表 + migration
 *     成本太高；DOM 注入是最低破壞性的方案。
 *
 * 失效模式：Payload 重新渲染 sidebar 時注入會掉，所以掛 MutationObserver
 * 監看 DOM 變動，每次都重做（會檢查是否已注入避免重複）。
 *
 * 目前條目（GraphQL Playground 已下架，2026-05-11）：
 *   - AI 部落格草稿產生器 (/admin/tools/blog-ai-draft)
 *   - 一鍵刪除未上架商品 (/admin/tools/bulk-delete-products)
 *   - REST API 文件 (/admin/api-docs)
 *
 * 對應 src/payload.config.ts admin.components.afterNavLinks。
 */

interface Item {
  href: string
  label: string
  id: string
}

const TARGET_GROUP_LABEL = '⑦ 系統與安全'
const INJECTED_ATTR = 'data-ckmu-systools-injected'

const items: Item[] = [
  {
    href: '/admin/tools/blog-ai-draft',
    label: '✨ AI 部落格草稿產生器',
    id: 'nav-ckmu-blog-ai-draft',
  },
  {
    href: '/admin/tools/bulk-delete-products',
    label: '🗑️ 一鍵刪除未上架商品',
    id: 'nav-ckmu-bulk-delete-products',
  },
  {
    href: '/admin/tools/whitehat-marketing',
    label: '白帽自動化行銷中台',
    id: 'nav-ckmu-whitehat-marketing',
  },
  {
    href: '/admin/api-docs',
    label: 'REST API 文件',
    id: 'nav-ckmu-api-docs',
  },
]

function findGroupContent(): Element | null {
  // Payload v3 sidebar 結構：每個 group 用 .nav-group / .nav-group__toggle
  // / .nav-group__content 三層 class。找到 toggle 文字含 TARGET_GROUP_LABEL
  // 的 group 然後抓它的 content 區塊。
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

function injectItems() {
  const content = findGroupContent()
  if (!content) return
  // 已經注入過就跳過（用 attribute 標記）
  if (content.querySelector(`[${INJECTED_ATTR}]`)) return

  for (const item of items) {
    const a = document.createElement('a')
    a.href = item.href
    a.id = item.id
    a.className = 'nav__link'
    a.setAttribute(INJECTED_ATTR, '1')
    const span = document.createElement('span')
    span.className = 'nav__link-label'
    span.textContent = item.label
    a.appendChild(span)
    content.appendChild(a)
  }
}

const CKMUSystemToolsNavGroup: React.FC = () => {
  useEffect(() => {
    injectItems()
    // Payload 換頁 / 重渲染後 nav 會被替換掉；用 MutationObserver
    // 確保每次 DOM 變動都重新嘗試注入。
    const observer = new MutationObserver(() => {
      injectItems()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}

export default CKMUSystemToolsNavGroup
