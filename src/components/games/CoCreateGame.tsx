'use client'

/**
 * 好友共創穿搭 — 接通 backend (PR-Z)
 * ──────────────────────────────────
 * 簡化版：用戶投稿，標籤為「合作邀請」；其他用戶可在原作品 caption 留下擴充提案。
 * 完整版的 multi-room 邏輯（建房 + 邀請碼 + 共同編輯）走 createRoom() — 仍由
 * SocialGameShell 內 createRoom hook 提供，admin 可後台手動建房。
 *
 * Backend：socialGameActions.createStyleRoom + joinStyleRoom + submitStyleWork
 */
import { Users } from 'lucide-react'
import SocialGameShell from './SocialGameShell'

interface Props {
  settings: Record<string, unknown>
}

export function CoCreateGame({ settings }: Props) {
  const creatorPoints = (settings?.creatorPoints as number) ?? 80
  const collaboratorPoints = (settings?.collaboratorPoints as number) ?? 40
  const maxCollabs = (settings?.maxCollaborators as number) ?? 4

  return (
    <SocialGameShell
      gameType="co_create"
      submitMode="submit"
      submitLabel="發起共創"
      submitHint={`封測階段：投稿穿搭+標籤「徵共創」即可；多人 room 建立由 admin 後台或 API 觸發（最多 ${maxCollabs} 人 / 房）`}
      showVote={true}
      voteLabel="想合作"
      emptyFeedText="目前還沒有人開房。發起第一個共創吧！"
      heroContent={
        <div className="bg-gradient-to-br from-fuchsia-50 to-pink-50 border border-fuchsia-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-500 text-white flex items-center justify-center">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-xl font-serif">好友共創穿搭</h2>
              <p className="text-xs text-muted-foreground">
                邀請好友一起搭配，共同創作造型！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl p-3 border border-fuchsia-200 text-center">
              <p className="text-[10px] text-muted-foreground">發起者</p>
              <p className="text-sm font-medium text-fuchsia-700">+{creatorPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-fuchsia-200 text-center">
              <p className="text-[10px] text-muted-foreground">每位共創者</p>
              <p className="text-sm font-medium text-fuchsia-700">+{collaboratorPoints} 點</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            成果由全房參與者共享獎勵；房間結算由 backend cron 處理。
          </p>
        </div>
      }
    />
  )
}

export default CoCreateGame
