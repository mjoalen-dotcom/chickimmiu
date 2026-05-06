'use client'

/**
 * 穿搭接龍 — 接通 backend (PR-Z)
 * ──────────────────────────────
 * 邏輯：用戶從前一篇作品中挑一件元素延伸；submitMode='relay' 投稿時帶 parent。
 *
 * Backend：socialGameActions.submitStyleWork(parent: number)
 */
import { Link2, Sparkles } from 'lucide-react'
import SocialGameShell from './SocialGameShell'

interface Props {
  settings: Record<string, unknown>
}

export function StyleRelayGame({ settings }: Props) {
  const participantPoints = (settings?.participantPoints as number) ?? 30
  const bestPickPoints = (settings?.bestPickPoints as number) ?? 100
  const chainBonus = (settings?.chainLengthBonus as number) ?? 5

  return (
    <SocialGameShell
      gameType="style_relay"
      submitMode="relay"
      submitLabel="接龍投稿"
      submitHint="從下方作品中點擊一件當作 parent，再上傳你的延伸作品"
      showVote={true}
      voteLabel="挑這件"
      emptyFeedText="目前還沒有人開接龍。當第一個吧！"
      heroContent={
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center">
              <Link2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-serif">穿搭接龍</h2>
              <p className="text-xs text-muted-foreground">
                延續風格元素，接力創造穿搭故事！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-3 border border-cyan-200 text-center">
              <p className="text-base mb-1">📤</p>
              <p className="text-[10px] text-muted-foreground">投稿</p>
              <p className="text-sm font-medium text-cyan-700">+{participantPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-cyan-200 text-center">
              <Sparkles size={14} className="text-cyan-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">best pick</p>
              <p className="text-sm font-medium text-cyan-700">+{bestPickPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-cyan-200 text-center">
              <Link2 size={14} className="text-cyan-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">接得長</p>
              <p className="text-sm font-medium text-cyan-700">+{chainBonus} / 件</p>
            </div>
          </div>
        </div>
      }
    />
  )
}

export default StyleRelayGame
