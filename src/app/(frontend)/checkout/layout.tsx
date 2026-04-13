import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '結帳',
  description: '填寫收件資訊並完成付款，支援信用卡、LINE Pay、超商取貨付款等多元支付方式。',
  robots: { index: false, follow: false },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
