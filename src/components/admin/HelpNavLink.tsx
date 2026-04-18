import React from 'react'
import Link from 'next/link'

/**
 * HelpNavLink — 後台左側導覽上方的「使用說明」連結。
 * 對應 payload.config.ts admin.components.views.help → /admin/help
 */
const HelpNavLink: React.FC = () => {
  return (
    <div style={{ padding: '0 16px', marginBottom: 8 }}>
      <Link
        href="/admin/help"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'var(--theme-elevation-50, #fafafa)',
          border: '1px solid var(--theme-elevation-150, #e4e4e7)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--theme-elevation-800, #222)',
          textDecoration: 'none',
        }}
      >
        <span>📖</span>
        <span>使用說明</span>
      </Link>
    </div>
  )
}

export default HelpNavLink
