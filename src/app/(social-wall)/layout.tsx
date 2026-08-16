import type { Metadata } from 'next'

import './social-wall.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://wall.ckmu.co'),
  title: {
    default: '牆聚 WallGather｜繁中社群牆',
    template: '%s｜牆聚 WallGather',
  },
  description: '把 Instagram 專業帳號內容整理成可嵌入網站的繁中社群牆，支援版型設計、訂閱方案與網域授權。',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SocialWallLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className="sw-body">{children}</body>
    </html>
  )
}
