import type { Metadata } from 'next'
import Link from 'next/link'

import { EmbedDemoMount } from '@/components/social-wall/EmbedDemoMount'

export const metadata: Metadata = {
  title: '嵌入元件完整示範',
  robots: { index: false, follow: false },
}

export default function SocialWallEmbedDemoPage() {
  return (
    <main className="sw-embed-demo">
      <div className="sw-embed-demo__bar">
        <div><span className="sw-status-dot" /><strong>嵌入鏈路測試</strong><small>embed.js → 網域授權 → 短效 token → iframe</small></div>
        <Link href="/social-wall/dashboard">返回工作台</Link>
      </div>
      <article>
        <header>
          <span>WALLGATHER DEMO</span>
          <h1>這一區由一行嵌入碼載入</h1>
          <p>下方不是直接放入 React 元件，而是模擬外部網站安裝後的完整載入流程。</p>
        </header>
        <EmbedDemoMount />
      </article>
    </main>
  )
}
