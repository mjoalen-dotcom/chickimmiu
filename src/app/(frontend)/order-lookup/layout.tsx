import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '訂單查詢',
  description: '輸入訂單編號與聯絡信箱，查詢訂單狀態與出貨進度。',
  robots: { index: false, follow: true },
}

export default function OrderLookupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
