import React from 'react'
import Link from 'next/link'

/**
 * RepeatPurchaseNavLink — 後台左側導覽上方的「90 天回購分析」連結。
 * 對應 payload.config.ts admin.components.views.repeatPurchase → /admin/repeat-purchase
 *
 * 樣式沿用 HelpNavLink / MemberAnalyticsNavLink 的次要文字色樣式，避免搶過 active 狀態。
 */
const RepeatPurchaseNavLink: React.FC = () => {
  return (
    <div style={{ padding: '0 16px', marginBottom: 8 }}>
      <Link
        href="/admin/repeat-purchase"
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
        <span style={{ opacity: 0.85 }}>🔁</span>
        <span>90 天回購分析</span>
      </Link>
    </div>
  )
}

export default RepeatPurchaseNavLink
