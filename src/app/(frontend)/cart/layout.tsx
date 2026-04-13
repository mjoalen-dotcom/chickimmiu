import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '購物車',
  description: '查看您的購物車商品，調整數量或前往結帳。滿 NT$1,000 享免運費。',
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
