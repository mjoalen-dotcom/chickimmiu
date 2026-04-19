import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Admin sidebar icon (sidebar 收合時顯示)。
 * - 從 GlobalSettings.site.favicon 讀取目前前台 favicon
 * - 若未上傳 / DB 不可用，fallback 到原本 SVG CKMU icon
 * - 注意：瀏覽器分頁的真正 favicon 由 <link rel="icon"> 控制，那是另一條路徑
 */
export default async function AdminIcon() {
  let iconUrl: string | null = null
  let iconAlt = 'CHIC KIM & MIU'

  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'global-settings', depth: 1 })
    const site = (settings as { site?: { favicon?: { url?: string; alt?: string } | null } }).site
    if (site?.favicon && typeof site.favicon === 'object' && site.favicon.url) {
      iconUrl = site.favicon.url
      if (site.favicon.alt) iconAlt = site.favicon.alt
    }
  } catch {
    // DB 未連線：靜默 fallback
  }

  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt={iconAlt}
        width={24}
        height={24}
        style={{ objectFit: 'contain', display: 'block' }}
      />
    )
  }

  // Fallback：原本 SVG CKMU icon
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
