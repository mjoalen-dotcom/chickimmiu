import type { Metadata } from 'next'
import { GameTermsGate } from '@/components/games/GameTermsGate'

export const metadata: Metadata = {
  title: '好運遊戲',
  description: '參加 CHIC KIM & MIU 互動小遊戲，每日簽到、轉盤抽獎、刮刮卡，贏取點數與專屬優惠券！',
}

/**
 * /games layout
 * 包 GameTermsGate — 已登入但未同意最新版規範的會員會被全屏 modal 擋下，
 * 強制簽署同意書才能玩遊戲。同意紀錄連同 IP/版本號寫入 users.gameTermsAcceptance。
 */
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <GameTermsGate>{children}</GameTermsGate>
}
