'use client'

import React from 'react'

/**
 * Payload CMS v3 自訂後台 Icon (favicon / 小圖示)
 * 顯示在瀏覽器分頁和後台收合導航時
 */
export default function AdminIcon() {
  return (
    <svg viewBox="0 0 200 200" width="24" height="24" style={{ color: '#C19A5B' }}>
      <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="12"/>
      <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="3"/>
      <path d="M 62,100 A 45,45 0 1,1 100,145" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"/>
      <g transform="translate(78, 72)">
        <rect x="0" y="0" width="22" height="22" rx="3" fill="currentColor"/>
        <rect x="25" y="0" width="22" height="22" rx="3" fill="currentColor"/>
        <rect x="0" y="25" width="22" height="22" rx="3" fill="currentColor"/>
        <rect x="25" y="25" width="22" height="22" rx="3" fill="currentColor"/>
        <text x="11" y="16" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#1a1f36" fontSize="13">K</text>
        <text x="36" y="16" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#1a1f36" fontSize="13">M</text>
        <text x="11" y="41" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#1a1f36" fontSize="13">M</text>
        <text x="36" y="41" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#1a1f36" fontSize="13">U</text>
      </g>
    </svg>
  )
}
