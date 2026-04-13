import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '會員登入',
  description: '登入您的 CHIC KIM & MIU 帳號，享受會員專屬折扣、點數累積與個人化推薦。',
  robots: { index: false, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
