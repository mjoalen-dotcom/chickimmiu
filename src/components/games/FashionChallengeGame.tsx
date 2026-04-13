'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Sparkles, Share2 } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

const CATEGORIES = ['上衣', '下身', '外套', '鞋子', '配飾']
const ITEMS: Record<string, Array<{ id: string; name: string; emoji: string; style: number }>> = {
  '上衣': [
    { id: 't1', name: '白色襯衫', emoji: '👔', style: 8 },
    { id: 't2', name: '黑色T恤', emoji: '🖤', style: 6 },
    { id: 't3', name: '蕾絲上衣', emoji: '🌸', style: 9 },
    { id: 't4', name: '針織背心', emoji: '🧶', style: 7 },
    { id: 't5', name: '西裝外套', emoji: '🤵', style: 9 },
  ],
  '下身': [
    { id: 'b1', name: '高腰牛仔褲', emoji: '👖', style: 7 },
    { id: 'b2', name: '百褶裙', emoji: '💃', style: 8 },
    { id: 'b3', name: '西裝褲', emoji: '👔', style: 8 },
    { id: 'b4', name: '短裙', emoji: '👗', style: 7 },
    { id: 'b5', name: '寬褲', emoji: '🦵', style: 6 },
  ],
  '外套': [
    { id: 'o1', name: '風衣', emoji: '🧥', style: 9 },
    { id: 'o2', name: '牛仔外套', emoji: '🧤', style: 7 },
    { id: 'o3', name: '皮衣', emoji: '🖤', style: 8 },
    { id: 'o4', name: '毛呢大衣', emoji: '🐑', style: 9 },
    { id: 'o5', name: '無（不穿外套）', emoji: '❌', style: 5 },
  ],
  '鞋子': [
    { id: 's1', name: '高跟鞋', emoji: '👠', style: 9 },
    { id: 's2', name: '白色球鞋', emoji: '👟', style: 7 },
    { id: 's3', name: '短靴', emoji: '🥾', style: 8 },
    { id: 's4', name: '涼鞋', emoji: '🩴', style: 6 },
    { id: 's5', name: '樂福鞋', emoji: '👞', style: 8 },
  ],
  '配飾': [
    { id: 'a1', name: '金色項鍊', emoji: '📿', style: 9 },
    { id: 'a2', name: '太陽眼鏡', emoji: '🕶️', style: 7 },
    { id: 'a3', name: '絲巾', emoji: '🧣', style: 8 },
    { id: 'a4', name: '手提包', emoji: '👜', style: 8 },
    { id: 'a5', name: '無配飾', emoji: '❌', style: 4 },
  ],
}

type Phase = 'intro' | 'playing' | 'scoring' | 'result'

export function FashionChallengeGame({ settings }: Props) {
  const timeLimit = (settings.timeLimitSeconds as number) || 60
  const [phase, setPhase] = useState<Phase>('intro')
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [activeCat, setActiveCat] = useState(CATEGORIES[0])
  const [score, setScore] = useState(0)
  const [rank, setRank] = useState('')
  const [points, setPoints] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const startGame = useCallback(() => {
    setPhase('playing')
    setTimeLeft(timeLimit)
    setSelections({})
    setActiveCat(CATEGORIES[0])
  }, [timeLimit])

  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          finishGame()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const finishGame = () => {
    setPhase('scoring')
    // AI scoring simulation
    const selected = Object.keys(selections).length
    const styleSum = Object.entries(selections).reduce((sum, [cat, id]) => {
      const item = ITEMS[cat]?.find((i) => i.id === id)
      return sum + (item?.style || 0)
    }, 0)
    const baseScore = (styleSum / (selected || 1)) * 10
    const coverage = (selected / CATEGORIES.length) * 20
    const totalScore = Math.min(Math.round(baseScore + coverage), 100)

    setTimeout(() => {
      let r: string, p: number
      if (totalScore >= 90) { r = 'S'; p = (settings.rankSPoints as number) || 50 }
      else if (totalScore >= 70) { r = 'A'; p = (settings.rankAPoints as number) || 30 }
      else if (totalScore >= 50) { r = 'B'; p = (settings.rankBPoints as number) || 15 }
      else { r = 'C'; p = (settings.rankCPoints as number) || 5 }
      setScore(totalScore)
      setRank(r)
      setPoints(p)
      setPhase('result')
    }, 2000)
  }

  const selectItem = (cat: string, id: string) => {
    setSelections((prev) => ({ ...prev, [cat]: id }))
    const idx = CATEGORIES.indexOf(cat)
    if (idx < CATEGORIES.length - 1) {
      setActiveCat(CATEGORIES[idx + 1])
    }
  }

  const submitEarly = () => {
    clearInterval(timerRef.current)
    finishGame()
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Intro ── */}
      {phase === 'intro' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
          <p className="text-5xl mb-4">✨</p>
          <h2 className="text-2xl font-serif mb-3">璀璨穿搭挑戰</h2>
          <p className="text-sm text-muted-foreground mb-2">在 {timeLimit} 秒內完成主題穿搭</p>
          <p className="text-sm text-muted-foreground mb-6">AI 即時評分，S 級穿搭贏取最高獎勵！</p>
          <div className="bg-cream-100 rounded-xl p-4 mb-6 text-left text-xs space-y-1 text-muted-foreground">
            <p>1. 從5個分類中各選一件單品</p>
            <p>2. 注重整體搭配的協調性與時尚感</p>
            <p>3. 選越多、搭越好，分數越高</p>
            <p>4. 可提前交卷，但記得快速選擇！</p>
          </div>
          <button
            onClick={startGame}
            className="px-10 py-3 bg-gradient-to-r from-gold-500 to-amber-600 text-white rounded-full text-lg font-serif hover:shadow-lg transition-all"
          >
            開始挑戰
          </button>
        </motion.div>
      )}

      {/* ── Playing ── */}
      {phase === 'playing' && (
        <div>
          {/* Timer bar */}
          <div className="flex items-center gap-3 mb-6">
            <Timer size={18} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gold-600'} />
            <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${timeLeft <= 10 ? 'bg-red-500' : 'bg-gold-500'}`}
                animate={{ width: `${(timeLeft / timeLimit) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className={`text-sm font-mono font-medium ${timeLeft <= 10 ? 'text-red-500' : ''}`}>
              {timeLeft}s
            </span>
          </div>

          {/* Selection progress */}
          <div className="flex gap-1 mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`flex-1 py-2 rounded-lg text-xs transition-all ${
                  activeCat === cat
                    ? 'bg-gold-500 text-white'
                    : selections[cat]
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-cream-100 text-muted-foreground'
                }`}
              >
                {selections[cat] ? '✓' : ''} {cat}
              </button>
            ))}
          </div>

          {/* Items */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <AnimatePresence mode="popLayout">
              {ITEMS[activeCat]?.map((item) => (
                <motion.button
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => selectItem(activeCat, item.id)}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    selections[activeCat] === item.id
                      ? 'bg-gold-500/10 border-gold-500 ring-2 ring-gold-400/30'
                      : 'bg-white border-cream-200 hover:border-gold-400'
                  }`}
                >
                  <span className="text-2xl block mb-1">{item.emoji}</span>
                  <p className="text-xs font-medium">{item.name}</p>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <button
            onClick={submitEarly}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide"
          >
            提交穿搭 ({Object.keys(selections).length}/{CATEGORIES.length})
          </button>
        </div>
      )}

      {/* ── Scoring ── */}
      {phase === 'scoring' && (
        <div className="text-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles size={48} className="text-gold-500 mx-auto" />
          </motion.div>
          <p className="mt-4 font-serif text-lg">AI 正在評分中...</p>
        </div>
      )}

      {/* ── Result ── */}
      {phase === 'result' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 ${
            rank === 'S' ? 'bg-gradient-to-br from-gold-400 to-amber-500' :
            rank === 'A' ? 'bg-gradient-to-br from-violet-400 to-purple-500' :
            rank === 'B' ? 'bg-gradient-to-br from-blue-400 to-indigo-500' :
            'bg-gradient-to-br from-gray-300 to-gray-400'
          }`}>
            <div className="text-center text-white">
              <p className="text-4xl font-serif font-bold">{rank}</p>
              <p className="text-sm">{score} 分</p>
            </div>
          </div>

          <h2 className="text-2xl font-serif mb-2">
            {rank === 'S' ? '👑 時尚天后！' : rank === 'A' ? '🌟 穿搭達人！' : rank === 'B' ? '✨ 不錯的搭配！' : '💪 繼續加油！'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">獲得 {points} 點獎勵</p>

          {/* Selected items recap */}
          <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6 text-left">
            <h4 className="text-sm font-medium mb-3">你的穿搭</h4>
            <div className="space-y-2">
              {CATEGORIES.map((cat) => {
                const item = ITEMS[cat]?.find((i) => i.id === selections[cat])
                return (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{cat}</span>
                    <span>{item ? `${item.emoji} ${item.name}` : '未選擇'}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setPhase('intro'); setSelections({}) }}
              className="flex-1 py-3 bg-foreground text-cream-50 rounded-xl text-sm"
            >
              再挑戰一次
            </button>
            <button
              onClick={() => { if (navigator.share) navigator.share({ title: `我在 CKMU 穿搭挑戰獲得 ${rank} 級！`, url: window.location.href }) }}
              className="flex items-center gap-2 px-5 py-3 bg-gold-500/10 text-gold-600 rounded-xl text-sm"
            >
              <Share2 size={14} />
              分享
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
