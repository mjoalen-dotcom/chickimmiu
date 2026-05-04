'use client'

/**
 * 團體穿搭房 — 接通 backend (PR-Z)
 * ────────────────────────────────
 * 簡化版：用戶投稿即視為「開房」邀請，標籤帶 #team；其他用戶可加入投稿。
 * 完整 multi-room 邏輯（建房 + 邀請碼 + 投票結算）由 createRoom hook + backend 處理。
 *
 * Backend：socialGameActions.createStyleRoom + joinStyleRoom + submitStyleWork
 */
import { Home, Users, Trophy } from 'lucide-react'
import SocialGameShell from './SocialGameShell'

interface Props {
  settings: Record<string, unknown>
}

export function TeamStyleGame({ settings }: Props) {
  const hostPoints = (settings?.hostPoints as number) ?? 100
  const memberPoints = (settings?.memberPoints as number) ?? 30
  const bestOutfitPoints = (settings?.bestOutfitPoints as number) ?? 200
  const maxRoomSize = (settings?.maxRoomSize as number) ?? 5

  return (
    <SocialGameShell
      gameType="team_style"
      submitMode="submit"
      submitLabel="開團 / 投稿"
      submitHint={`封測階段：投稿即作為團體房邀請（最多 ${maxRoomSize} 人），其他人在 feed 投稿同主題接龍`}
      showVote={true}
      showCrown={true}
      voteLabel="投這套"
      emptyFeedText="目前還沒有團體房。當第一個房主！"
      heroContent={
        <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center">
              <Home size={22} />
            </div>
            <div>
              <h2 className="text-xl font-serif">團體穿搭房</h2>
              <p className="text-xs text-muted-foreground">
                開房邀請好友，穿搭競賽贏大獎！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-3 border border-orange-200 text-center">
              <Home size={14} className="text-orange-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">房主</p>
              <p className="text-sm font-medium text-orange-700">+{hostPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-orange-200 text-center">
              <Users size={14} className="text-orange-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">每位成員</p>
              <p className="text-sm font-medium text-orange-700">+{memberPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-orange-200 text-center">
              <Trophy size={14} className="text-orange-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">最佳穿搭</p>
              <p className="text-sm font-medium text-orange-700">+{bestOutfitPoints} 點</p>
            </div>
          </div>
        </div>
      }
    />
  )
}

export default TeamStyleGame
