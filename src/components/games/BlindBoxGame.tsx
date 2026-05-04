'use client'

/**
 * 穿搭盲盒互贈 — 接通 backend (PR-Z)
 * ──────────────────────────────────
 * 簡化版：用戶投稿穿搭盲盒（圖片 + 給某人的訊息）；接收者按讚/評分後 backend 給點。
 * 多人 room 邏輯（指定送某人）由後台或進階 API 觸發。
 *
 * Backend：socialGameActions.createStyleRoom + submitStyleWork
 */
import { Gift } from 'lucide-react'
import SocialGameShell from './SocialGameShell'

interface Props {
  settings: Record<string, unknown>
}

export function BlindBoxGame({ settings }: Props) {
  const senderPoints = (settings?.senderPoints as number) ?? 30
  const receiverPoints = (settings?.receiverPoints as number) ?? 50
  const cost = (settings?.pointsCost as number) ?? 0

  return (
    <SocialGameShell
      gameType="blind_box"
      submitMode="submit"
      submitLabel="封一個盲盒"
      submitHint={`贈出穿搭盲盒，收到的人開箱按讚回饋你 +${senderPoints} 點${cost > 0 ? `；本遊戲消耗 ${cost} 點` : ''}`}
      showVote={true}
      voteLabel="開箱"
      emptyFeedText="目前還沒有盲盒。封第一個吧！"
      heroContent={
        <div className="bg-gradient-to-br from-lime-50 to-green-50 border border-lime-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-lime-500 text-white flex items-center justify-center">
              <Gift size={22} />
            </div>
            <div>
              <h2 className="text-xl font-serif">穿搭盲盒互贈</h2>
              <p className="text-xs text-muted-foreground">
                隨機搭配盲盒送給好友，拆箱驚喜！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl p-3 border border-lime-200 text-center">
              <p className="text-base mb-1">📤</p>
              <p className="text-[10px] text-muted-foreground">送出者</p>
              <p className="text-sm font-medium text-lime-700">+{senderPoints} 點</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-lime-200 text-center">
              <p className="text-base mb-1">🎁</p>
              <p className="text-[10px] text-muted-foreground">收到者</p>
              <p className="text-sm font-medium text-lime-700">+{receiverPoints} 點</p>
            </div>
          </div>
        </div>
      }
    />
  )
}

export default BlindBoxGame
