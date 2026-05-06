'use client'

/**
 * 穿搭許願池 — 接通 backend (PR-Z)
 * ─────────────────────────────────
 * 邏輯：用戶花點數懸賞發起願望（許願 = 純文字 + tags + bountyPoints）；
 * 其他用戶可投稿穿搭照回應；提交者選定中獎作品時 backend 結算 bountyPoints。
 *
 * Backend：socialGameActions.createStyleWish + grantStyleWish + pickWinningGrant
 * UI 層：透過 SocialGameShell 統一外殼；submitMode='wish' 顯示許願表單。
 */
import { Stars, Coins, Lightbulb } from 'lucide-react'
import SocialGameShell from './SocialGameShell'

interface Props {
  settings: Record<string, unknown>
}

export function WishPoolGame({ settings }: Props) {
  const wisherPoints = (settings?.wisherPoints as number) ?? 0
  const fulfillerPoints = (settings?.fulfillerPoints as number) ?? 50

  return (
    <SocialGameShell
      gameType="wish_pool"
      submitMode="wish"
      submitHint="提交願望時會預扣懸賞點數，作品被選中後會分發給對應投稿者"
      showVote={true}
      voteLabel="幫挑"
      emptyFeedText="目前還沒有願望。提出第一個吧！"
      heroContent={
        <div className="bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center text-2xl">
              🌟
            </div>
            <div>
              <h2 className="text-xl font-serif">穿搭許願池</h2>
              <p className="text-xs text-muted-foreground">
                許下穿搭願望，由達人幫你圓夢！
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 border border-cream-200">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Coins size={11} className="text-gold-500" />
                懸賞獎勵
              </p>
              <p className="text-sm font-medium text-foreground/80">
                +{fulfillerPoints} 點 / 件{wisherPoints > 0 ? `（許願者另回饋 +${wisherPoints} 點）` : ''}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-cream-200">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Lightbulb size={11} className="text-amber-500" />
                規則
              </p>
              <p className="text-sm text-foreground/80">14 天內若無人投稿自動退點</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
            <p className="text-xs text-amber-700 flex items-start gap-1.5">
              <Stars size={12} className="mt-0.5 shrink-0" />
              <span>
                許願後請在底下「最新作品」區看到別人的回應，從中選定中獎者後 backend 會自動發送懸賞點數。
              </span>
            </p>
          </div>
        </div>
      }
    />
  )
}

export default WishPoolGame
