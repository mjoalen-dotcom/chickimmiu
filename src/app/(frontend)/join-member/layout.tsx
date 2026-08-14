import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '加入會員',
  description: '設定密碼即可把訪客訂單升級為會員帳號。',
  robots: { index: false, follow: false },
}

export default function JoinMemberLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
