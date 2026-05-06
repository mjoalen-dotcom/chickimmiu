import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import LinkIntegrityClient from '@/components/admin/LinkIntegrityClient'

/**
 * /admin/diagnostics/link-integrity — Wave 1 PR-ζ
 *
 * 這條是 Next.js App Router 真實 route，不是 Payload admin view（後者
 * 透過 admin.components.views 註冊在 payload.config.ts，會 conflict 到
 * Wave 1 PR-α/β）。權衡是少了 Payload sidebar / chrome，但 admin 自己
 * 從 ⓪ 數據儀表 sidebar link 進來即可。
 *
 * Auth gate：必須是已登入的 admin user，否則 redirect 到 /admin/login。
 */
export const dynamic = 'force-dynamic'

export default async function LinkIntegrityPage() {
  const payload = await getPayload({ config })
  const h = await headers()
  const { user } = await payload.auth({ headers: h as unknown as Headers })

  const role = (user as { role?: string } | null)?.role
  if (!user || role !== 'admin') {
    redirect('/admin/login')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/admin" style={{ color: '#0070f3', fontSize: 13 }}>← 回後台</a>
      </div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>連結完整性診斷</h1>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
        封測公開營運前確認商品與分類連結沒有斷掉。每次點「開始掃描」會重新跑全表檢查，
        在 1,000+ 商品的資料集大約 5–15 秒。檢查不會修改任何資料；
        「重新計算分類商品數」按鈕才會寫入。
      </p>
      <LinkIntegrityClient />
    </div>
  )
}
