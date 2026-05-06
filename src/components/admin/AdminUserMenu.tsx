'use client'

import { useAuth } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * AdminUserMenu — 後台 header 右上角顯示登入帳號 email + 下拉選單。
 *
 * 背景：Payload v3 預設 AppHeader 只在右上角放一個 25×25 的 gravatar 連結到
 * /admin/account，**沒有**任何文字標明使用者登入帳號。實際使用者反映「沒顯
 * 示登入帳號」就是因為 gravatar 太小且無 email 文字。
 *
 * 由於 `.app-header__actions` 接點是 view-level（透過 useActions context
 * 動態註冊，不接受 admin.components.actions config），且 `.app-header__account`
 * 是 `<a>`（HTML 不允許 nested interactive content，無法直接放 dropdown
 * button），這裡用 React portal 注入到 `.app-header__actions` 那個 div，
 * 作出「[gravatar] mjoalen@gmail.com ▾」 + dropdown（帳號設定 / 登出）。
 *
 * 掛在 admin.components.beforeNavLinks 隨 admin shell 生命週期。
 *
 * 配套 CSS 在 src/app/(payload)/custom.scss `.ckmu-user-menu` 區塊，
 * 同時隱藏 Payload 預設的 `.app-header__account` 小頭像避免重複。
 */
const AdminUserMenu: React.FC = () => {
  const { user } = useAuth()
  const [container, setContainer] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Portal target: .app-header__actions div renders client-side after AppHeader
  // mounts. Poll briefly until we find it.
  useEffect(() => {
    const find = () => document.querySelector('.app-header__actions')
    const el = find()
    if (el) {
      setContainer(el)
      return
    }
    const id = setInterval(() => {
      const e = find()
      if (e) {
        setContainer(e)
        clearInterval(id)
      }
    }, 100)
    const timeout = setTimeout(() => clearInterval(id), 5000)
    return () => {
      clearInterval(id)
      clearTimeout(timeout)
    }
  }, [])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!container || !user) return null

  const email = (user as { email?: string }).email || ''
  const displayName = (user as { name?: string }).name || email.split('@')[0] || '帳號'

  return createPortal(
    <div className="ckmu-user-menu" ref={wrapRef}>
      <button
        type="button"
        className="ckmu-user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={email}
      >
        <span className="ckmu-user-menu__avatar" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="ckmu-user-menu__email">{email}</span>
        <svg
          className="ckmu-user-menu__chevron"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="ckmu-user-menu__dropdown" role="menu">
          <div className="ckmu-user-menu__header">
            <div className="ckmu-user-menu__header-name">{displayName}</div>
            <div className="ckmu-user-menu__header-email">{email}</div>
          </div>
          <a
            href="/admin/account"
            className="ckmu-user-menu__item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            帳號設定
          </a>
          <a
            href="/admin/logout"
            className="ckmu-user-menu__item ckmu-user-menu__item--danger"
            role="menuitem"
          >
            登出
          </a>
        </div>
      )}
    </div>,
    container,
  )
}

export default AdminUserMenu
