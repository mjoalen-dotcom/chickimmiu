'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * CKMUSystemToolsNavGroup — 後台側欄最下方的「⑦ 系統工具」群組。
 *
 * 跟 CKMUDashboardNavGroup 同一套 markup pattern，但掛在 `afterNavLinks`
 * 而非 `beforeNavLinks`，所以視覺上會出現在 ⑦ 系統與安全 collections 後面。
 *
 * 為什麼不直接塞進 ⑦ 系統與安全 group：
 *   - Payload v3 sidebar group 是從 collections/globals 的 `admin.group` 自動聚合，
 *     沒有公開 API 讓自訂 view 加進現有 group
 *   - 用 collection stub 假冒 ⑦ 群組成員會在 DB 多一張無意義的表 + migration
 *   - afterNavLinks 是最低破壞性的方案：自己畫一個 group block，視覺與 Payload
 *     原生 group 一致（套用相同 nav-group / nav-group__toggle / nav-group__content
 *     class），sessionStorage 記住折疊狀態
 *
 * 目前條目：
 *   - GraphQL Playground (/api/graphql-playground) — 對外開新分頁，工程師最快上手
 *     的 API explorer，自帶 schema 自動補全 + 可寫 query / mutation 測試
 *   - REST API 文件 (/admin/api-docs) — 列出全部 collection / global 的 REST 端點 +
 *     auth 範例 + curl snippet（Phase E 提供）
 *
 * 對應 src/payload.config.ts admin.components.afterNavLinks。
 */

const KEY = 'ckmu_admin_system_tools_collapsed'

interface Item {
  href: string
  label: string
  id: string
  /** true → 對外連結，target=_blank */
  external?: boolean
}

const items: Item[] = [
  {
    href: '/admin/tools/blog-ai-draft',
    label: '✨ AI 部落格草稿產生器',
    id: 'nav-ckmu-blog-ai-draft',
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
  {
    href: '/api/graphql-playground',
    label: 'GraphQL Playground',
    id: 'nav-ckmu-graphql-playground',
    external: true,
  },
]

const CKMUSystemToolsNavGroup: React.FC = () => {
  // SSR 預設展開；client mount 後從 sessionStorage 還原折疊狀態
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === '1') setCollapsed(true)
    } catch {}
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        sessionStorage.setItem(KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  return (
    <div className={`nav-group ckmu-system-tools-group${collapsed ? ' nav-group--collapsed' : ''}`}>
      <button
        type="button"
        className={`nav-group__toggle${collapsed ? ' nav-group__toggle--collapsed' : ''}`}
        onClick={toggle}
        aria-expanded={!collapsed}
      >
        ⑦ 系統工具
      </button>
      {!collapsed && (
        <div className="nav-group__content">
          {items.map((it) =>
            it.external ? (
              <a
                key={it.id}
                className="nav__link"
                id={it.id}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="nav__link-label">{it.label}</span>
              </a>
            ) : (
              <Link key={it.id} className="nav__link" id={it.id} href={it.href}>
                <span className="nav__link-label">{it.label}</span>
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  )
}

export default CKMUSystemToolsNavGroup
