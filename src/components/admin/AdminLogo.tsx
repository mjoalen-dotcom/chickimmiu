import React from 'react'

/**
 * Admin top-nav / login 頁 logo。
 * 使用者指定 /admin/login 不要圖片，只保留文字 wordmark，
 * 因此這裡直接回文字版，不再讀 GlobalSettings.site.logo。
 */
export default function AdminLogo() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
      }}
    >
      <div style={{ lineHeight: 1.15 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: '#C19A5B',
            letterSpacing: '0.10em',
            fontFamily: "'Georgia', 'Playfair Display', serif",
            whiteSpace: 'nowrap',
          }}
        >
          CHIC KIM &amp; MIU
        </div>
        <div
          style={{
            fontSize: 9,
            color: 'rgba(255, 255, 255, 0.5)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          Management System
        </div>
      </div>
    </div>
  )
}
