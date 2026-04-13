import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '註冊會員',
  description: '加入 CHIC KIM & MIU 會員，立即享有新會員優惠、獨家折扣與點數回饋。',
  robots: { index: false, follow: true },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
