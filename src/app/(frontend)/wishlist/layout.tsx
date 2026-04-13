import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '收藏清單',
  description: '瀏覽您收藏的 CHIC KIM & MIU 精選商品，隨時加入購物車完成購買。',
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
