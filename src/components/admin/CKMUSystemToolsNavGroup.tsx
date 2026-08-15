'use client'

import React, { useEffect } from 'react'

/**
 * CKMUSystemToolsNavGroup — 把系統工具自訂 view 注入 Payload 原生
 * 「⑥ 內容與頁面」group 的 nav 列表。
 *
 * 2026-08-15 步驟03分組整併：原「⑦ 系統與安全」獨立群組（僅 Currencies／
 * LoginAttempts 兩個 collection + GlobalSettings／PricingFormulaSettings 兩個
 * global）已拆散合併：Currencies→①訂單與物流、LoginAttempts→③會員與CRM、
 * PricingFormulaSettings→②商品管理、GlobalSettings→⑥內容與頁面，達成
 * DoD ≤6組目標（詳見 docs/admin-ui/AUDIT-20260814.md）。本工具列表原本就是
 * DOM 注入、不依附特定 collection，遂一併把注入目標改到 ⑥（GlobalSettings
 * 落腳處，語意上最接近「全站設定與工具」）。這批連結是偶爾用的管理工具、
 * 非每日固定動線，落在較大群組底部的動線成本可接受（對照：部落格工具連結
 * 因故意保留獨立群組不合併，見 KimBlogNavGroup.tsx 說明）。
 *
 * 為什麼用 DOM 注入而不再開一個獨立 group：
 *   - Payload v3 sidebar group 由 collections/globals 的 `admin.group` 自動聚合，
 *     沒有公開 API 讓自訂 view 直接掛進現有 group。所以走 DOM 注入：找到
 *     目標 group 的 `.nav-group__content` 然後把工具連結 append 進去。
 *   - 用 collection stub 假冒群組成員會在 DB 多一張無意義的表 + migration
 *     成本太高；DOM 注入是最低破壞性的方案。
 *
 * 失效模式：Payload 重新渲染 sidebar 時注入會掉，所以掛 MutationObserver
 * 監看 DOM 變動，每次都重做（會檢查是否已注入避免重複）。
 *
 * 目前條目（GraphQL Playground 已下架 2026-05-11；AI 部落格草稿產生器
 * 已移到「Ⓚ 兩站部落格」group，見 KimBlogNavGroup.tsx）：
 *   - 一鍵刪除未上架商品 (/admin/tools/bulk-delete-products)
 *   - 白帽自動化行銷中台 (/admin/tools/whitehat-marketing)
 *   - Email 模板預覽 / 測試寄送 (/admin/tools/email-templates)
 *   - REST API 文件 (/admin/api-docs)
 *
 * 對應 src/payload.config.ts admin.components.afterNavLinks。
 */

interface Item {
  href: string
  label: string
  id: string
}

const TARGET_GROUP_LABEL = '⑥ 內容與頁面'
const INJECTED_ATTR = 'data-ckmu-systools-injected'

const items: Item[] = [
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
    href: '/admin/tools/email-templates',
    label: '✉️ Email 模板預覽 / 測試',
    id: 'nav-ckmu-email-templates',
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
