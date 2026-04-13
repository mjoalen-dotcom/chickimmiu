'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, Heart, Share2 } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

// Demo PK matches
const DEMO_MATCHES = [
  {
    id: 1,
    left: { name: '小*', votes: 128, style: '法式優雅', emoji: '🌹' },
    right: { name: '美*', votes: 95, style: '街頭潮流', emoji: '🔥' },
    timeLeft: '3h 20m',
  },
  {
    id: 2,
    left: { name: '璀*', votes: 67, style: '韓系甜美', emoji: '🌸' },
    right: { name: '星*', votes: 72, style: '極簡風格', emoji: '✨' },
    timeLeft: '8h 45m',
  },
]

export function StylePKGame({ settings }: Props) {
  const [tab, setTab] = useState<'vote' | 'submit'>('vote')
  const [voted, setVoted] = useState<Record<number, 'left' | 'right'>>({})
  const [submitted, setSubmitted] = useState(false)

  const voterPoints = (settings.voterPoints as number) || 3
  const winnerPoints = (settings.winnerPoints as number) || 50

  const handleVote = (matchId: number, side: 'left' | 'right') => {
    setVoted((prev) => ({ ...prev, [matchId]: side }))
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Tab */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('vote')}
          className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
            tab === 'vote' ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
          }`}
        >
          🗳️ 投票
        </button>
        <button
          onClick={() => setTab('submit')}
          className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
            tab === 'submit' ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
          }`}
        >
          📸 投稿
        </button>
      </div>

      {/* ── Vote tab ── */}
      {tab === 'vote' && (
        <div className="space-y-6">
          {DEMO_MATCHES.map((match) => (
            <div key={match.id} className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
              <div className="px-4 py-2 bg-cream-50 border-b border-cream-200 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">PK #{match.id}</span>
                <span className="text-[10px] text-gold-600">剩餘 {match.timeLeft}</span>
              </div>
              <div className="flex">
                {/* Left */}
                <button
                  onClick={() => handleVote(match.id, 'left')}
                  disabled={Boolean(voted[match.id])}
                  className={`flex-1 p-6 text-center transition-all ${
                    voted[match.id] === 'left' ? 'bg-gold-500/10' : 'hover:bg-cream-50'
                  }`}
                >
                  <span className="text-4xl block mb-2">{match.left.emoji}</span>
                  <p className="text-sm font-medium">{match.left.name}</p>
                  <p className="text-[10px] text-muted-foreground mb-3">{match.left.style}</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-pink-500">
                    <Heart size={12} fill={voted[match.id] === 'left' ? 'currentColor' : 'none'} />
                    {match.left.votes + (voted[match.id] === 'left' ? 1 : 0)}
                  </div>
                </button>

                {/* VS */}
                <div className="flex items-center px-2">
                  <div className="w-10 h-10 rounded-full bg-foreground text-cream-50 flex items-center justify-center text-xs font-bold">
                    VS
                  </div>
                </div>

                {/* Right */}
                <button
                  onClick={() => handleVote(match.id, 'right')}
                  disabled={Boolean(voted[match.id])}
                  className={`flex-1 p-6 text-center transition-all ${
                    voted[match.id] === 'right' ? 'bg-gold-500/10' : 'hover:bg-cream-50'
                  }`}
                >
                  <span className="text-4xl block mb-2">{match.right.emoji}</span>
                  <p className="text-sm font-medium">{match.right.name}</p>
                  <p className="text-[10px] text-muted-foreground mb-3">{match.right.style}</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-pink-500">
                    <Heart size={12} fill={voted[match.id] === 'right' ? 'currentColor' : 'none'} />
                    {match.right.votes + (voted[match.id] === 'right' ? 1 : 0)}
                  </div>
                </button>
              </div>
              {voted[match.id] && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-4 py-2 bg-gold-500/5 text-center text-xs text-gold-600"
                >
                  投票成功！獲得 {voterPoints} 點 ✨
                </motion.div>
              )}
            </div>
          ))}

          <p className="text-center text-xs text-muted-foreground">
            每次投票獲得 {voterPoints} 點 · 勝出者獲得 {winnerPoints} 點
          </p>
        </div>
      )}

      {/* ── Submit tab ── */}
      {tab === 'submit' && (
        <div className="text-center">
          {submitted ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10">
              <p className="text-4xl mb-4">⚔️</p>
              <p className="text-lg font-serif mb-2">穿搭已提交！</p>
              <p className="text-sm text-muted-foreground mb-4">系統正在為你配對 PK 對手，請稍候...</p>
              <button
                onClick={() => { if (navigator.share) navigator.share({ title: '來 CKMU 穿搭PK', url: window.location.href }) }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gold-500/10 text-gold-600 rounded-full text-sm"
              >
                <Share2 size={14} />
                分享邀請好友PK
              </button>
            </motion.div>
          ) : (
            <div>
              <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center bg-cream-50 mb-4 cursor-pointer hover:border-gold-400 transition-colors">
                <Upload size={32} className="text-cream-300 mb-3" />
                <p className="text-sm text-muted-foreground">上傳你的穿搭照</p>
                <p className="text-[10px] text-muted-foreground mt-1">建議尺寸 1080x1440</p>
              </div>
              <input
                type="text"
                placeholder="描述你的穿搭風格..."
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
              <button
                onClick={() => setSubmitted(true)}
                className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide"
              >
                提交穿搭 PK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
