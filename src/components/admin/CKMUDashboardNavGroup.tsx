'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * CKMUDashboardNavGroup — 後台側欄最上方的「⓪ 數據儀表」群組。
 *
 * 取代原本散落在 beforeNavLinks 的 3 個 floating link
 * (HelpNavLink / MemberAnalyticsNavLink / RepeatPurchaseNavLink)。
 *
 * Payload v3 sidebar 的群組順序由 `collections: []` 陣列決定 — 所以
 * 自訂 view（不是 collection）沒有原生的 group 機制。本元件用同一份
 * 「nav-group / nav-group__toggle / nav-group__content」class 結構
 * 手刻 markup，視覺上跟 Payload 原生 group 一致；折疊狀態由元件
 * 自己 state + sessionStorage 管，不依賴 Payload 的內部 store。
 *
 * 4 個項目：
 *   - 營運總覽 (/admin)
 *   - 會員分群分析 (/admin/member-analytics)
 *   - 回購分析 (/admin/repeat-purchase)
 *   - 使用說明 (/admin/help)
 */

const KEY = 'ckmu_admin_dashboard_group_collapsed'

const items: { href: string; label: string; id: string }[] = [
  { href: '/admin', label: '營運總覽', id: 'nav-ckmu-overview' },
  { href: '/admin/member-analytics', label: '會員分群分析', id: 'nav-ckmu-member-analytics' },
  { href: '/admin/repeat-purchase', label: '回購分析', id: 'nav-ckmu-repeat-purchase' },
  { href: '/admin/help', label: '使用說明', id: 'nav-ckmu-help' },
]

const CKMUDashboardNavGroup: React.FC = () => {
  // SSR 預設展開；client mount 後從 sessionStorage 還原
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
    <div className={`nav-group ckmu-dashboard-group${collapsed ? ' nav-group--collapsed' : ''}`}>
      <button
        type="button"
        className={`nav-group__toggle${collapsed ? ' nav-group__toggle--collapsed' : ''}`}
        onClick={toggle}
        aria-expanded={!collapsed}
      >
        ⓪ 數據儀表
      </button>
      {!collapsed && (
        <div className="nav-group__content">
          {items.map((it) => (
            <Link key={it.id} className="nav__link" id={it.id} href={it.href}>
              <span className="nav__link-label">{it.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default CKMUDashboardNavGroup
