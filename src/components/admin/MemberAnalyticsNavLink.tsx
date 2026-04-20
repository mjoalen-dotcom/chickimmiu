import React from 'react'
import Link from 'next/link'

/**
 * MemberAnalyticsNavLink — 後台左側導覽上方的「會員分群分析」連結。
 * 對應 payload.config.ts admin.components.views.memberAnalytics → /admin/member-analytics
 *
 * 樣式沿用 HelpNavLink 的「次要文字色 + hover 淡高亮」樣式，避免被誤認 active。
 */
const MemberAnalyticsNavLink: React.FC = () => {
  return (
    <div style={{ padding: '0 16px', marginBottom: 8 }}>
      <Link
        href="/admin/member-analytics"
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
        <span style={{ opacity: 0.85 }}>📊</span>
        <span>會員分群分析</span>
      </Link>
    </div>
  )
}

export default MemberAnalyticsNavLink
