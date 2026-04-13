'use client'

import { SessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'

/**
 * 全域 Providers
 * 提供空 session 初始值，防止 SessionProvider 在無 OAuth 時報錯
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      session={null as unknown as undefined}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  )
}
