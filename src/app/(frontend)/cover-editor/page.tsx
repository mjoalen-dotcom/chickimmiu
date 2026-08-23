import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { CoverEditorClient } from './CoverEditorClient'

export const metadata: Metadata = {
  title: '歡迎頁畫布編輯',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * /cover-editor — 歡迎頁畫布級編輯器（2026-08-23 Alan 需求）
 * ────────────────────────────────────────────────────────
 * 在「真實版面」上直接點著改：換素材、增刪列、排序、切版型、疊字，
 * 儲存即發布（寫回 homepage-settings.coverPage，afterChange hook 自動
 * 失效 / 快取）。僅限後台人員（users collection）；會員/訪客導去 /admin 登入。
 */
export default async function CoverEditorPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList }).catch(() => ({ user: null }))

  if (!user || user.collection !== 'users') {
    redirect('/admin')
  }

  return <CoverEditorClient />
}
