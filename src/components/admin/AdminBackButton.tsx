'use client'

/**
 * AdminBackButton
 * ───────────────
 * 後台所有「編輯類頁面」右上角浮動的「← 返回上一頁」按鈕。
 *
 * 觸發條件（URL pattern）：
 *   - /admin/collections/{slug}/{id}        — collection 編輯頁
 *   - /admin/collections/{slug}/create      — collection 新建頁
 *   - /admin/globals/{slug}                 — global 編輯頁
 * 其他頁（dashboard、list、custom view）不顯示。
 *
 * 行為：
 *   - 點擊：先嘗試 router.back()；若 history 沒有上一頁，回退到對應 list 頁
 *     （collection 回 /admin/collections/{slug}，global 回 /admin）。
 *
 * 為什麼放 beforeNavLinks：
 *   - 這個 slot 跟著 admin shell 生命週期，跨頁切換不重新 mount
 *     （與 NavScrollPersist 同一個 pattern）。
 *   - 按鈕本身用 position:fixed，不影響 sidebar 排版。
 *   - 不在 admin 路徑時不會 render（usePathname 沒匹配）。
 */

import React, { useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const COLLECTION_DOC = /^\/admin\/collections\/([^/]+)\/[^/]+/
const GLOBAL_DOC = /^\/admin\/globals\/[^/]+/

const buttonStyle: React.CSSProperties = {
  position: 'fixed',
  top: 14,
  right: 16,
  zIndex: 100,
  padding: '8px 14px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: 'var(--theme-elevation-0, #fff)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--theme-elevation-800, #222)',
}

const AdminBackButton: React.FC = () => {
  const pathname = usePathname() || ''
  const router = useRouter()

  const fallback = useMemo(() => {
    const m = pathname.match(COLLECTION_DOC)
    if (m) return `/admin/collections/${m[1]}`
    if (GLOBAL_DOC.test(pathname)) return '/admin'
    return null
  }, [pathname])

  const handleClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    if (fallback) router.push(fallback)
  }, [router, fallback])

  if (!fallback) return null

  return (
    <button type="button" onClick={handleClick} style={buttonStyle} aria-label="返回上一頁">
      <span aria-hidden="true">←</span>
      <span>返回上一頁</span>
    </button>
  )
}

export default AdminBackButton
