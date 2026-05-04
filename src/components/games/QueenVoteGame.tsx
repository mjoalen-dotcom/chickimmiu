'use client'

/**
 * 女王投票大賽 — 接通 backend (PR-Z)
 * ──────────────────────────────────
 * 邏輯：每人限投 N 票（settings.dailyVoteLimit）；最高票者每期結算為「女王」。
 *
 * Backend：socialGameActions.submitStyleWork + castStyleVote
 */
import { Crown, Heart, Star } from 'lucide-react'
import SocialGameShell from './SocialGameShell'

interface Props {
  settings: Record<string, unknown>
}

export function QueenVoteGame({ settings }: Props) {
  const queenPoints = (settings?.queenPoints as number) ?? 1000
  const runnerUpPoints = (settings?.runnerUpPoints as number) ?? 500
  const voterPoints = (settings?.voterPoints as number) ?? 5
  const periodDays = (settings?.periodDays as number) ?? 7

  return (
    <SocialGameShell
      gameType="queen_vote"
      submitMode="submit"
      submitLabel="挑戰女王寶座"
      submitHint={`每期 ${periodDays} 天；得票最高者為「女王」獲 ${queenPoints} 點`}
      showVote={true}
      showCrown={true}
      voteLabel="投票"
      emptyFeedText="本期還沒有挑戰者，第一個來搶女王位置！"
      heroContent={
        <div className="bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 border border-pink-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center text-2xl">
              👑
            </div>
            <div>
              <h2 className="text-xl font-serif">女王投票大賽</h2>
              <p className="text-xs text-muted-foreground">
                上傳最美穿搭，爭奪時尚女王寶座！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-3 border border-pink-200 text-center">
              <Crown size={16} className="text-pink-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">女王</p>
              <p className="text-sm font-medium text-pink-700">+{queenPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-pink-200 text-center">
              <Star size={16} className="text-rose-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">亞軍</p>
              <p className="text-sm font-medium text-rose-600">+{runnerUpPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-pink-200 text-center">
              <Heart size={16} className="text-pink-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">投票</p>
              <p className="text-sm font-medium text-pink-600">+{voterPoints} 點 / 票</p>
            </div>
          </div>
        </div>
      }
    />
  )
}

export default QueenVoteGame
