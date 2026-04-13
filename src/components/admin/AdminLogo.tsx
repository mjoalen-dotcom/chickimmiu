'use client'

import React from 'react'

/**
 * Payload CMS v3 - CHIC KIM & MIU
 * Text-only logo in admin panel navigation
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
