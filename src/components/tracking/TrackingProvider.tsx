'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackPageView, parseAndStoreUTM } from '@/lib/tracking'

/**
 * 追蹤 Provider — 處理頁面瀏覽追蹤 + UTM 解析
 * 放在 (frontend)/layout.tsx 的 Providers 內
 */
export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 首次載入時解析並儲存 UTM
  useEffect(() => {
    parseAndStoreUTM()
  }, [])

  // 路由變化時追蹤 PageView
  useEffect(() => {
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    trackPageView(url)
  }, [pathname, searchParams])

  return <>{children}</>
}
