'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2, Info } from 'lucide-react'
import type { GameDef } from '@/lib/games/gameConfig'

import { DailyCheckinGame } from './DailyCheckinGame'
import { SpinWheelGame } from './SpinWheelGame'
import { ScratchCardGame } from './ScratchCardGame'
import { MovieLotteryGame } from './MovieLotteryGame'
import { FashionChallengeGame } from './FashionChallengeGame'
import { CardBattleGame } from './CardBattleGame'
import { StylePKGame } from './StylePKGame'
import { StyleRelayGame } from './StyleRelayGame'
import { WeeklyChallengeGame } from './WeeklyChallengeGame'
import { CoCreateGame } from './CoCreateGame'
import { WishPoolGame } from './WishPoolGame'
import { BlindBoxGame } from './BlindBoxGame'
import { QueenVoteGame } from './QueenVoteGame'
import { TeamStyleGame } from './TeamStyleGame'

interface Props {
  game: GameDef & { settings: Record<string, unknown> }
}

const GAME_COMPONENTS: Record<string, React.ComponentType<{ settings: Record<string, unknown> }>> = {
  'daily-checkin': DailyCheckinGame,
  'spin-wheel': SpinWheelGame,
  'scratch-card': ScratchCardGame,
  'movie-lottery': MovieLotteryGame,
  'fashion-challenge': FashionChallengeGame,
  'card-battle': CardBattleGame,
  'style-pk': StylePKGame,
  'style-relay': StyleRelayGame,
  'weekly-challenge': WeeklyChallengeGame,
  'co-create': CoCreateGame,
  'wish-pool': WishPoolGame,
  'blind-box': BlindBoxGame,
  'queen-vote': QueenVoteGame,
  'team-style': TeamStyleGame,
}

export function GamePageClient({ game }: Props) {
  const [showRules, setShowRules] = useState(false)
  const GameComponent = GAME_COMPONENTS[game.id]

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `CHIC KIM & MIU - ${game.name}`,
        text: game.description,
        url: window.location.href,
      })
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('連結已複製！分享給好友一起玩 🎮')
    }
  }

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* ── Header ── */}
      <div className={`bg-gradient-to-br ${game.color} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="container relative z-10 py-8 md:py-12">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/games"
              className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={16} />
              返回遊戲大廳
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRules(!showRules)}
                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                aria-label="遊戲規則"
              >
                <Info size={16} />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                aria-label="分享"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>

          <div className="text-center text-white">
            <span className="text-5xl mb-4 block drop-shadow-lg">{game.icon}</span>
            <h1 className="text-2xl md:text-3xl font-serif mb-2">{game.name}</h1>
            <p className="text-sm text-white/80 max-w-md mx-auto">{game.description}</p>
          </div>
        </div>
      </div>

      {/* Rules panel */}
      {showRules && (
        <div className="bg-gold-500/5 border-b border-gold-500/20">
          <div className="container py-4">
            <h3 className="text-sm font-medium mb-2">遊戲規則</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {game.description}
              <br />
              獎勵點數將自動加入您的帳戶，每日遊戲點數上限為 500 點。
            </p>
          </div>
        </div>
      )}

      {/* ── Game Content ── */}
      <div className="container py-8 md:py-12">
        {GameComponent ? (
          <GameComponent settings={game.settings} />
        ) : (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">{game.icon}</p>
            <p className="text-lg font-serif mb-2">{game.name}</p>
            <p className="text-sm text-muted-foreground">此遊戲正在開發中，敬請期待！</p>
          </div>
        )}
      </div>
    </main>
  )
}
