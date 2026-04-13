'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Crown, Clock, Upload, Trophy, Star, Flame } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

interface Contestant {
  id: number
  user: string
  avatar: string
  outfit: string
  desc: string
  votes: number
}

const DEMO_CONTESTANTS: Contestant[] = [
  { id: 1, user: '小*', avatar: '🌸', outfit: '👗✨👠💎', desc: '法式優雅晚禮服', votes: 328 },
  { id: 2, user: '美*', avatar: '💫', outfit: '🧥👖🕶️👜', desc: '都市知性 OL 風', votes: 295 },
  { id: 3, user: '璀*', avatar: '🌙', outfit: '👘🌺👡📿', desc: '波西米亞度假風', votes: 267 },
  { id: 4, user: '星*', avatar: '⭐', outfit: '👚👗🎀👟', desc: '甜美學院風', votes: 241 },
  { id: 5, user: '雲*', avatar: '🌿', outfit: '🥻💍👠🧣', desc: '復古名媛風', votes: 218 },
  { id: 6, user: '月*', avatar: '🌜', outfit: '👕🩳👟🎒', desc: '街頭運動混搭', votes: 189 },
  { id: 7, user: '花*', avatar: '🌷', outfit: '👗🧥👒💐', desc: '田園浪漫風', votes: 156 },
  { id: 8, user: '夢*', avatar: '💭', outfit: '🧥👖🥾🕶️', desc: '帥氣中性風', votes: 134 },
]

const RANK_BADGE: Record<number, { emoji: string; color: string }> = {
  1: { emoji: '👑', color: 'from-yellow-400 to-amber-500' },
  2: { emoji: '🥈', color: 'from-gray-300 to-gray-400' },
  3: { emoji: '🥉', color: 'from-orange-300 to-orange-400' },
}

export function QueenVoteGame({ settings }: Props) {
  const [tab, setTab] = useState<'vote' | 'ranking' | 'submit'>('vote')
  const [contestants, setContestants] = useState(DEMO_CONTESTANTS)
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set())
  const [heartAnimations, setHeartAnimations] = useState<Record<number, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')

  const votePoints = (settings.votePoints as number) || 2
  const period = (settings.period as string) || '第 12 期'

  useEffect(() => {
    const endDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    const tick = () => {
      const diff = endDate.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('已結束'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${d}天 ${h}時 ${m}分`)
    }
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleVote = (id: number) => {
    if (votedIds.has(id)) return
    setVotedIds((prev) => new Set(prev).add(id))
    setHeartAnimations((prev) => ({ ...prev, [id]: true }))
    setTimeout(() => setHeartAnimations((prev) => ({ ...prev, [id]: false })), 1000)
    setContestants((prev) =>
      prev.map((c) => (c.id === id ? { ...c, votes: c.votes + 1 } : c))
        .sort((a, b) => b.votes - a.votes)
    )
  }

  const sorted = [...contestants].sort((a, b) => b.votes - a.votes)

  return (
    <div className="max-w-lg mx-auto">
      {/* Period Header */}
      <div className="bg-gradient-to-r from-pink-400 to-rose-500 rounded-2xl p-4 mb-4 text-white text-center">
        <Crown size={24} className="mx-auto mb-1" />
        <h3 className="font-serif text-lg">{period} 女王投票大賽</h3>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-sm opacity-90">
          <Clock size={12} />
          <span>{timeLeft}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'vote' as const, label: '❤️ 投票' },
          { key: 'ranking' as const, label: '👑 排行榜' },
          { key: 'submit' as const, label: '📸 參賽' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
              tab === t.key ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Vote Tab */}
      {tab === 'vote' && (
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((contestant, i) => {
            const rank = i + 1
            return (
              <motion.div
                key={contestant.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-cream-200 overflow-hidden relative"
              >
                {/* Outfit Display */}
                <div className="aspect-square bg-cream-50 flex items-center justify-center text-3xl relative">
                  {contestant.outfit}
                  {rank <= 3 && (
                    <span className="absolute top-2 left-2 text-xl">{RANK_BADGE[rank].emoji}</span>
                  )}
                  {rank === 1 && (
                    <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-yellow-400 to-amber-500" />
                  )}

                  {/* Heart Animation */}
                  <AnimatePresence>
                    {heartAnimations[contestant.id] && (
                      <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2, opacity: 0, y: -40 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <Heart size={40} className="text-pink-500" fill="currentColor" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">{contestant.avatar}</span>
                    <span className="text-sm font-medium">{contestant.user}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2 truncate">{contestant.desc}</p>

                  <button
                    onClick={() => handleVote(contestant.id)}
                    disabled={votedIds.has(contestant.id)}
                    className={`w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs transition-all ${
                      votedIds.has(contestant.id)
                        ? 'bg-pink-50 text-pink-500'
                        : 'bg-cream-50 text-muted-foreground hover:bg-pink-50 hover:text-pink-500'
                    }`}
                  >
                    <Heart size={12} fill={votedIds.has(contestant.id) ? 'currentColor' : 'none'} />
                    {contestant.votes} 票
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Ranking Tab */}
      {tab === 'ranking' && (
        <div className="space-y-4">
          {/* Top 3 */}
          <div className="flex items-end justify-center gap-4 pb-4">
            {[sorted[1], sorted[0], sorted[2]].filter(Boolean).map((c, i) => {
              const rank = i === 0 ? 2 : i === 1 ? 1 : 3
              const heights = ['h-24', 'h-32', 'h-20']
              return (
                <motion.div
                  key={c.id}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: (i === 1 ? 0 : i === 0 ? 0.2 : 0.4) }}
                  className="flex flex-col items-center"
                >
                  <span className="text-2xl mb-1">{RANK_BADGE[rank]?.emoji}</span>
                  <span className="text-lg mb-1">{c.avatar}</span>
                  <p className="text-xs font-medium">{c.user}</p>
                  <div className={`w-20 ${heights[i]} rounded-t-xl bg-gradient-to-b ${RANK_BADGE[rank]?.color || 'from-cream-200 to-cream-300'} flex flex-col items-center justify-center`}>
                    <span className="text-white text-lg font-bold">{c.votes}</span>
                    <span className="text-white text-[8px] opacity-80">票</span>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Full List */}
          <div className="space-y-2">
            {sorted.map((c, i) => {
              const rank = i + 1
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border ${
                    rank === 1 ? 'border-gold-300 bg-gold-500/5' : 'border-cream-200'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    rank <= 3
                      ? `bg-gradient-to-br ${RANK_BADGE[rank]?.color || ''} text-white`
                      : 'bg-cream-100 text-muted-foreground'
                  }`}>
                    {rank}
                  </span>
                  <span className="text-lg">{c.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.user}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-pink-500">{c.votes}</p>
                    <p className="text-[8px] text-muted-foreground">票</p>
                  </div>
                  {rank === 1 && (
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <Flame size={16} className="text-amber-500" />
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Submit Tab */}
      {tab === 'submit' && (
        <div className="text-center">
          {submitted ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-10">
              <p className="text-5xl mb-4">👑</p>
              <p className="text-lg font-serif mb-2">已報名參賽！</p>
              <p className="text-sm text-muted-foreground">快分享給朋友幫你投票吧！</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center bg-cream-50 cursor-pointer hover:border-gold-400 transition-colors">
                <Upload size={32} className="text-cream-300 mb-3" />
                <p className="text-sm text-muted-foreground">上傳你的穿搭照</p>
                <p className="text-[10px] text-muted-foreground mt-1">成為下一位穿搭女王 👑</p>
              </div>
              <input
                type="text"
                placeholder="描述你的穿搭風格..."
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
              <button
                onClick={() => setSubmitted(true)}
                className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide"
              >
                👑 報名參賽
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground mt-6">
        每票 +{votePoints} 點 · 冠軍獲得 200 點 + 限定徽章 👑
      </p>
    </div>
  )
}
