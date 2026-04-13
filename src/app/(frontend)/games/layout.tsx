import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '好運遊戲',
  description: '參加 CHIC KIM & MIU 互動小遊戲，每日簽到、轉盤抽獎、刮刮卡，贏取點數與專屬優惠券！',
}

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
