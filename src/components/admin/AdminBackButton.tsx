'use client'

/**
 * AdminBackButton
 * ───────────────
 * 後台「編輯類頁面」sidebar 頂端的「← 返回上一頁」按鈕。
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
 * 為什麼放 beforeNavLinks 並改成 inline：
 *   - 這個 slot 跟著 admin shell 生命週期，跨頁切換不重新 mount
 *     （與 NavScrollPersist 同一個 pattern）。
 *   - 早期版本用 position:fixed top:14 right:16 結果直接覆蓋 Payload edit
 *     view 右上角的 document control bar（Save / Publish / More menu /
 *     Preview 按鈕），讓使用者點不到那些功能。
 *   - 現在改成 sidebar 內 inline block，自然 flow 進 nav 頂端，不再撞到
 *     右上 actions。視覺上跟 sidebar nav item 同調，spacing 16/12 抓齊
 *     Payload 預設的 nav padding。
 */

import React, { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const COLLECTION_DOC = /^\/admin\/collections\/([^/]+)\/[^/]+/
const GLOBAL_DOC = /^\/admin\/globals\/[^/]+/

// 注意：這個 wrapper 用 padding 而不是 margin，避免跟 Payload nav scroll
// container 的 first-child 邊界算出怪間距。
const wrapperStyle: React.CSSProperties = {
  padding: '12px 16px 8px',
}

const baseButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: 'var(--theme-elevation-50, #fafafa)',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  color: 'var(--theme-elevation-800, #222)',
  textAlign: 'left',
  transition: 'background-color 120ms ease, border-color 120ms ease',
}

const arrowStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1,
  color: 'var(--theme-elevation-600, #666)',
}

const AdminBackButton: React.FC = () => {
  const pathname = usePathname() || ''
  const router = useRouter()
  const [hover, setHover] = useState(false)

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
    <div style={wrapperStyle}>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...baseButtonStyle,
          background: hover
            ? 'var(--theme-elevation-100, #f4f4f5)'
            : baseButtonStyle.background,
          borderColor: hover
            ? 'var(--theme-elevation-300, #a1a1aa)'
            : 'var(--theme-elevation-200, #d4d4d8)',
        }}
        aria-label="返回上一頁"
      >
        <span aria-hidden="true" style={arrowStyle}>
          ←
        </span>
        <span>返回上一頁</span>
      </button>
    </div>
  )
}

export default AdminBackButton
