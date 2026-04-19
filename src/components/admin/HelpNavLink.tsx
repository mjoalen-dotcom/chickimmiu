import React from 'react'
import Link from 'next/link'

/**
 * HelpNavLink — 後台左側導覽上方的「使用說明」連結。
 * 對應 payload.config.ts admin.components.views.help → /admin/help
 *
 * 樣式：透明背景 + 次要文字色，hover 才淡 highlight，避免在 dark sidebar
 * 被誤認成「當前頁面 active」狀態。
 */
const HelpNavLink: React.FC = () => {
  return (
    <div style={{ padding: '0 16px', marginBottom: 8 }}>
      <Link
        href="/admin/help"
        className="ckmu-help-nav-link"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'transparent',
          border: '1px solid transparent',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--theme-elevation-600, #888)',
          textDecoration: 'none',
          transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
        }}
      >
        <span style={{ opacity: 0.85 }}>📖</span>
        <span>使用說明</span>
      </Link>
    </div>
  )
}

export default HelpNavLink
