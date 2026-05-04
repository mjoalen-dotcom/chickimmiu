'use client'

/**
 * 每週風格挑戰賽 — 接通 backend (PR-Z)
 * ────────────────────────────────────
 * 邏輯：admin 設定當週主題（GameSettings.weeklyChallenge.currentTheme），
 * 用戶投稿，其他用戶可按讚 / 評分；週末由 cron 結算前 3 名（cron 屬另案）。
 *
 * Backend：socialGameActions.submitStyleWork + castStyleVote
 */
import { Trophy, Calendar, Sparkles } from 'lucide-react'
import SocialGameShell from './SocialGameShell'

interface Props {
  settings: Record<string, unknown>
}

export function WeeklyChallengeGame({ settings }: Props) {
  const theme = (settings?.currentTheme as string) || '本週主題：自由穿搭'
  const themeDesc = (settings?.themeDescription as string) || '展示你最想分享的造型'
  const top1Points = (settings?.top1Points as number) ?? 500
  const participantPoints = (settings?.participantPoints as number) ?? 50

  return (
    <SocialGameShell
      gameType="weekly_challenge"
      submitMode="submit"
      submitLabel="投稿本週挑戰"
      submitHint={`本週每人限投 1 件；參與即得 ${participantPoints} 點，前 3 名另獲獎勵`}
      showVote={true}
      showCrown={true}
      voteLabel="按讚"
      emptyFeedText="本週還沒有人投稿，當第一個展示作品的吧！"
      heroContent={
        <div className="bg-gradient-to-br from-yellow-50 to-amber-100 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-amber-700 mb-1">
                <Calendar size={11} className="inline mr-1" />
                本週主題
              </p>
              <h2 className="text-xl font-serif">{theme}</h2>
              <p className="text-xs text-muted-foreground mt-1">{themeDesc}</p>
            </div>
            <div className="text-3xl">🏆</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-3 border border-amber-200 text-center">
              <Trophy size={14} className="text-amber-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">冠軍</p>
              <p className="text-sm font-medium text-amber-700">+{top1Points} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-amber-200 text-center">
              <Sparkles size={14} className="text-amber-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">前 3 名</p>
              <p className="text-sm font-medium text-amber-600">特別獎</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-amber-200 text-center">
              <p className="text-base mb-1">🎁</p>
              <p className="text-[10px] text-muted-foreground">參與</p>
              <p className="text-sm font-medium text-amber-600">+{participantPoints} 點</p>
            </div>
          </div>
        </div>
      }
    />
  )
}

export default WeeklyChallengeGame
