import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Admin top-nav logo.
 * - 從 GlobalSettings.site.logo 讀取目前前台 logo，async server component
 * - 若未上傳 / DB 不可用，fallback 到原本文字 wordmark
 * - depth:1 把 upload relation 展成 Media 完整 doc（拿 url）
 */
export default async function AdminLogo() {
  let logoUrl: string | null = null
  let logoAlt = 'CHIC KIM & MIU'

  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'global-settings', depth: 1 })
    const site = (settings as { site?: { logo?: { url?: string; alt?: string } | null } }).site
    if (site?.logo && typeof site.logo === 'object' && site.logo.url) {
      logoUrl = site.logo.url
      if (site.logo.alt) logoAlt = site.logo.alt
    }
  } catch {
    // DB 未連線 / 建置期 / CI：靜默 fallback 不要炸 admin 載入
  }

  if (logoUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={logoAlt}
          style={{
            height: 36,
            maxWidth: 200,
            width: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    )
  }

  // Fallback：原本文字版 CKMU wordmark
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
