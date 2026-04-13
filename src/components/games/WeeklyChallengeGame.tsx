'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Heart, Clock, Trophy, Star, Camera } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

const DEMO_THEME = {
  title: '春日約會穿搭 🌸',
  description: '展現你的浪漫春日風格，無論是野餐、逛街還是咖啡廳約會！',
  week: 15,
  endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
}

const DEMO_ENTRIES = [
  { id: 1, user: '小*', emoji: '👗🌸👡💄', desc: '碎花洋裝配草編涼鞋', votes: 186, rank: 1 },
  { id: 2, user: '美*', emoji: '👚👖🧥👜', desc: '針織衫配高腰褲', votes: 152, rank: 2 },
  { id: 3, user: '璀*', emoji: '🥻✨👠💎', desc: '絲質裙裝搭珠寶', votes: 134, rank: 3 },
  { id: 4, user: '星*', emoji: '👕👗🎀👟', desc: '甜美運動混搭風', votes: 98, rank: 4 },
  { id: 5, user: '雲*', emoji: '🧥👖🧣🥾', desc: '文青知性春裝', votes: 87, rank: 5 },
  { id: 6, user: '月*', emoji: '👘🌺👒💐', desc: '日系花卉穿搭', votes: 76, rank: 6 },
]

const RANK_STYLES: Record<number, string> = {
  1: 'from-yellow-400 to-amber-500',
  2: 'from-gray-300 to-gray-400',
  3: 'from-orange-300 to-orange-400',
}

const RANK_EMOJI: Record<number, string> = { 1: '👑', 2: '🥈', 3: '🥉' }

export function WeeklyChallengeGame({ settings }: Props) {
  const [tab, setTab] = useState<'gallery' | 'submit' | 'winners'>('gallery')
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set())
  const [entries, setEntries] = useState(DEMO_ENTRIES)
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')

  const votePoints = (settings.votePoints as number) || 2
  const submitPoints = (settings.submitPoints as number) || 10

  useEffect(() => {
    const tick = () => {
      const diff = DEMO_THEME.endDate.getTime() - Date.now()
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
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, votes: e.votes + 1 } : e))
        .sort((a, b) => b.votes - a.votes)
        .map((e, i) => ({ ...e, rank: i + 1 }))
    )
  }

  const top3 = entries.slice(0, 3)

  return (
    <div className="max-w-lg mx-auto">
      {/* Theme Header */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-4 text-center">
        <p className="text-[10px] text-muted-foreground mb-1">第 {DEMO_THEME.week} 週挑戰</p>
        <h3 className="text-lg font-serif text-foreground mb-2">{DEMO_THEME.title}</h3>
        <p className="text-xs text-muted-foreground mb-3">{DEMO_THEME.description}</p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream-50 text-xs">
          <Clock size={12} className="text-gold-600" />
          <span className="text-gold-600 font-medium">{timeLeft}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'gallery' as const, label: '🖼️ 作品集' },
          { key: 'submit' as const, label: '📸 參賽' },
          { key: 'winners' as const, label: '🏆 排行榜' },
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

      {/* Gallery */}
      {tab === 'gallery' && (
        <div className="grid grid-cols-2 gap-3">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-cream-200 overflow-hidden"
            >
              <div className="aspect-square bg-cream-50 flex items-center justify-center text-4xl relative">
                {entry.emoji}
                {entry.rank <= 3 && (
                  <span className="absolute top-2 left-2 text-lg">{RANK_EMOJI[entry.rank]}</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium truncate">{entry.user}</p>
                <p className="text-[10px] text-muted-foreground truncate mb-2">{entry.desc}</p>
                <button
                  onClick={() => handleVote(entry.id)}
                  disabled={votedIds.has(entry.id)}
                  className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all ${
                    votedIds.has(entry.id)
                      ? 'bg-pink-50 text-pink-500'
                      : 'bg-cream-50 text-muted-foreground hover:bg-pink-50 hover:text-pink-500'
                  }`}
                >
                  <Heart size={12} fill={votedIds.has(entry.id) ? 'currentColor' : 'none'} />
                  {entry.votes}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Submit */}
      {tab === 'submit' && (
        <div className="text-center">
          {submitted ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-10">
              <p className="text-5xl mb-4">🎉</p>
              <p className="text-lg font-serif mb-2">參賽成功！</p>
              <p className="text-sm text-muted-foreground">獲得 {submitPoints} 點，快分享給朋友拉票吧！</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center bg-cream-50 cursor-pointer hover:border-gold-400 transition-colors">
                <Camera size={32} className="text-cream-300 mb-3" />
                <p className="text-sm text-muted-foreground">上傳穿搭照片</p>
                <p className="text-[10px] text-muted-foreground mt-1">或拖曳照片到此處</p>
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
                提交參賽作品
              </button>
              <p className="text-[10px] text-muted-foreground">參賽即獲得 {submitPoints} 點 ✨</p>
            </div>
          )}
        </div>
      )}

      {/* Winners / Leaderboard */}
      {tab === 'winners' && (
        <div className="space-y-4">
          {/* Top 3 Podium */}
          <div className="flex items-end justify-center gap-3 mb-6">
            {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry, i) => {
              const heights = ['h-20', 'h-28', 'h-16']
              const order = [1, 0, 2]
              return (
                <motion.div
                  key={entry.id}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: order[i] * 0.2 }}
                  className="flex flex-col items-center"
                >
                  <span className="text-2xl mb-1">{RANK_EMOJI[entry.rank]}</span>
                  <span className="text-xl mb-1">{entry.emoji.slice(0, 2)}</span>
                  <p className="text-xs font-medium mb-1">{entry.user}</p>
                  <div
                    className={`w-20 ${heights[i]} rounded-t-xl bg-gradient-to-b ${
                      RANK_STYLES[entry.rank] || 'from-cream-200 to-cream-300'
                    } flex items-center justify-center`}
                  >
                    <span className="text-white text-sm font-bold">{entry.votes}</span>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Full ranking */}
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl border border-cream-200 px-4 py-3 flex items-center gap-3"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  entry.rank <= 3
                    ? `bg-gradient-to-br ${RANK_STYLES[entry.rank] || ''} text-white`
                    : 'bg-cream-100 text-muted-foreground'
                }`}>
                  {entry.rank}
                </span>
                <span className="text-lg">{entry.emoji.slice(0, 2)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{entry.user}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{entry.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-pink-500">
                  <Heart size={10} fill="currentColor" />
                  {entry.votes}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground mt-6">
        投票 +{votePoints} 點 · 參賽 +{submitPoints} 點 · 冠軍額外 +100 點 🏆
      </p>
    </div>
  )
}
