'use client'

import { useRouter } from 'next/navigation'
import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'

/**
 * LivePreviewRefresh — admin「即時預覽」iframe 內儲存即刷新（2026-08-23）
 * ─────────────────────────────────────────────────────────────────────
 * 掛在 (frontend) layout：頁面被載進後台預覽 iframe 時，admin 按儲存
 * 會 postMessage 過來 → router.refresh() 重抓 RSC（各 collection/global
 * 的 afterChange hook 已先 revalidate 對應路徑，refresh 拿到的就是新資料）。
 * 不在 iframe 內時零作用、零開銷。/ 封面另有 useLivePreview 打字級同步。
 */
export function LivePreviewRefresh({ serverURL }: { serverURL: string }) {
  const router = useRouter()
  return <RefreshRouteOnSave serverURL={serverURL} refresh={() => router.refresh()} />
}
