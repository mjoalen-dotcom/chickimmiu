'use client'

/**
 * ARCHIVED (2026-04-17) — 無任何 import。
 *
 * Modal 版 demo（open/onClose props、fixed inset backdrop），早於
 * `components/games/FashionChallengeGame.tsx` 全頁版。`/games/fashion-challenge`
 * 路由經 `/games/[slug]` → `GamePageClient` 的 GAME_COMPONENTS map 指向
 * `FashionChallengeGame`，本檔不在 call graph 內。
 *
 * 保留理由：本檔含完整流程（challenge list → outfit builder → AI scoring UI
 * → share card），比 `FashionChallengeGame` 更接近「沉浸式 modal 體驗」原型。
 * 若 Phase 5.8 決定把 fashion challenge 改成 modal 限時挑戰，可復用本檔；
 * 否則整份刪。
 *
 * 維護紀律：在還沒決定前請不要新增 `import` 指向本檔。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Clock, Check, Share2, RotateCcw, Shirt, Crown } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────
interface FashionChallengeProps {
  open: boolean
  onClose: () => void
}

type GameState = 'intro' | 'playing' | 'scoring'

type Category = '上衣' | '下身' | '外套' | '配件' | '鞋子'
type ColorFamily = 'warm' | 'cool' | 'neutral'

interface FashionItem {
  id: number
  name: string
  category: Category
  styleTags: string[]
  colorFamily: ColorFamily
  bgColor: string   // placeholder bg color
}

interface ScoreBreakdown {
  styleHarmony: number    // 風格協調 /30
  themeMatch: number      // 主題契合 /30
  completeness: number    // 搭配完整度 /20
  colorHarmony: number    // 色彩和諧 /20
}

// ─── Data ─────────────────────────────────────────────────────────
const FASHION_ITEMS: FashionItem[] = [
  // 上衣
  { id: 1,  name: '蝴蝶結針織上衣', category: '上衣', styleTags: ['韓系', '優雅'],   colorFamily: 'warm',    bgColor: '#F6D7CD' },
  { id: 2,  name: '法式碎花襯衫',   category: '上衣', styleTags: ['法式', '浪漫'],   colorFamily: 'warm',    bgColor: '#FBEDE8' },
  { id: 3,  name: '簡約白T恤',     category: '上衣', styleTags: ['休閒', '基本款'],  colorFamily: 'neutral', bgColor: '#F9F5EC' },
  { id: 4,  name: '緞面吊帶背心',   category: '上衣', styleTags: ['性感', '優雅'],   colorFamily: 'cool',    bgColor: '#E2C89A' },
  // 下身
  { id: 5,  name: '高腰A字裙',     category: '下身', styleTags: ['韓系', '優雅'],   colorFamily: 'neutral', bgColor: '#EADCB8' },
  { id: 6,  name: '直筒牛仔褲',     category: '下身', styleTags: ['休閒', '街頭'],   colorFamily: 'cool',    bgColor: '#B8C9E2' },
  { id: 7,  name: '百褶長裙',       category: '下身', styleTags: ['優雅', '浪漫'],   colorFamily: 'warm',    bgColor: '#F2EAD6' },
  { id: 8,  name: '西裝短褲',       category: '下身', styleTags: ['俐落', '知性'],   colorFamily: 'neutral', bgColor: '#D4D4D4' },
  // 外套
  { id: 9,  name: '小香風外套',     category: '外套', styleTags: ['韓系', '優雅'],   colorFamily: 'warm',    bgColor: '#F6D7CD' },
  { id: 10, name: '針織開衫',       category: '外套', styleTags: ['休閒', '溫柔'],   colorFamily: 'warm',    bgColor: '#FBEDE8' },
  { id: 11, name: '風衣大衣',       category: '外套', styleTags: ['知性', '俐落'],   colorFamily: 'neutral', bgColor: '#D4AF77' },
  { id: 12, name: '牛仔夾克',       category: '外套', styleTags: ['休閒', '街頭'],   colorFamily: 'cool',    bgColor: '#B8C9E2' },
  // 配件
  { id: 13, name: '珍珠項鏈',       category: '配件', styleTags: ['優雅', '韓系'],   colorFamily: 'neutral', bgColor: '#F9F5EC' },
  { id: 14, name: '絲巾',          category: '配件', styleTags: ['法式', '浪漫'],   colorFamily: 'warm',    bgColor: '#EFBBAA' },
  { id: 15, name: '貝雷帽',         category: '配件', styleTags: ['法式', '文藝'],   colorFamily: 'neutral', bgColor: '#D4D4D4' },
  { id: 16, name: '皮革腰帶',       category: '配件', styleTags: ['俐落', '街頭'],   colorFamily: 'neutral', bgColor: '#A8824A' },
]

const THEMES = [
  { name: '韓系優雅約會穿搭',   matchTags: ['韓系', '優雅'] },
  { name: '休閒街頭週末散步',   matchTags: ['休閒', '街頭'] },
  { name: '法式浪漫下午茶',     matchTags: ['法式', '浪漫'] },
  { name: '知性俐落辦公室',     matchTags: ['知性', '俐落'] },
  { name: '溫柔甜美春日郊遊',   matchTags: ['溫柔', '浪漫', '優雅'] },
]

const CATEGORY_ICONS: Record<Category, string> = {
  '上衣': '👚',
  '下身': '👗',
  '外套': '🧥',
  '配件': '💍',
  '鞋子': '👟',
}

function getRankBadge(score: number): { rank: string; color: string; bg: string } {
  if (score >= 85) return { rank: 'S', color: '#C19A5B', bg: 'bg-gold-500/10' }
  if (score >= 70) return { rank: 'A', color: '#16a34a', bg: 'bg-green-500/10' }
  if (score >= 50) return { rank: 'B', color: '#2563eb', bg: 'bg-blue-500/10' }
  return { rank: 'C', color: '#6b7280', bg: 'bg-gray-500/10' }
}

function calculateScore(selectedItems: FashionItem[], themeMatchTags: string[]): ScoreBreakdown {
  if (selectedItems.length === 0) return { styleHarmony: 0, themeMatch: 0, completeness: 0, colorHarmony: 0 }

  // Style harmony: how many items share style tags
  const allTags = selectedItems.flatMap((item) => item.styleTags)
  const tagCounts: Record<string, number> = {}
  allTags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
  const maxTagFreq = Math.max(...Object.values(tagCounts))
  const styleHarmony = Math.min(30, Math.round((maxTagFreq / selectedItems.length) * 30))

  // Theme match: how many items have theme-matching tags
  const matchCount = selectedItems.filter((item) =>
    item.styleTags.some((tag) => themeMatchTags.includes(tag))
  ).length
  const themeMatch = Math.min(30, Math.round((matchCount / selectedItems.length) * 30))

  // Completeness: unique categories covered
  const categories = new Set(selectedItems.map((item) => item.category))
  const completeness = Math.min(20, Math.round((categories.size / 4) * 20))

  // Color harmony: items sharing same color family
  const colorCounts: Record<string, number> = {}
  selectedItems.forEach((item) => { colorCounts[item.colorFamily] = (colorCounts[item.colorFamily] || 0) + 1 })
  const dominantColorRatio = Math.max(...Object.values(colorCounts)) / selectedItems.length
  const colorHarmony = Math.min(20, Math.round(dominantColorRatio * 20))

  return { styleHarmony, themeMatch, completeness, colorHarmony }
}

// ─── Main Component ───────────────────────────────────────────────

export function FashionChallenge({ open, onClose }: FashionChallengeProps) {
  const [gameState, setGameState] = useState<GameState>('intro')
  const [countdown, setCountdown] = useState(3)
  const [timer, setTimer] = useState(60)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null)
  const [animatedScore, setAnimatedScore] = useState(0)
  const [theme] = useState(() => THEMES[Math.floor(Math.random() * THEMES.length)])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Intro countdown
  useEffect(() => {
    if (gameState !== 'intro' || !open) return
    if (countdown <= 0) {
      setGameState('playing')
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [gameState, countdown, open])

  // Game timer
  useEffect(() => {
    if (gameState !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState])

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (gameState === 'playing' && timer === 0) {
      handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, gameState])

  const toggleItem = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 5) {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const selectedItems = FASHION_ITEMS.filter((item) => selectedIds.has(item.id))
    const breakdown = calculateScore(selectedItems, theme.matchTags)
    setScoreBreakdown(breakdown)
    setGameState('scoring')
  }, [selectedIds, theme.matchTags])

  // Score count-up animation
  useEffect(() => {
    if (gameState !== 'scoring' || !scoreBreakdown) return
    const total = scoreBreakdown.styleHarmony + scoreBreakdown.themeMatch + scoreBreakdown.completeness + scoreBreakdown.colorHarmony
    let current = 0
    const step = Math.max(1, Math.floor(total / 30))
    const interval = setInterval(() => {
      current += step
      if (current >= total) {
        current = total
        clearInterval(interval)
      }
      setAnimatedScore(current)
    }, 40)
    return () => clearInterval(interval)
  }, [gameState, scoreBreakdown])

  const handlePlayAgain = useCallback(() => {
    setGameState('intro')
    setCountdown(3)
    setTimer(60)
    setSelectedIds(new Set())
    setScoreBreakdown(null)
    setAnimatedScore(0)
  }, [])

  const handleShare = useCallback(() => {
    if (!scoreBreakdown) return
    const total = scoreBreakdown.styleHarmony + scoreBreakdown.themeMatch + scoreBreakdown.completeness + scoreBreakdown.colorHarmony
    const { rank } = getRankBadge(total)
    const text = `【CHIC KIM & MIU 璀璨穿搭挑戰】\n主題：${theme.name}\n我的評分：${total}/100（${rank}級）✨\n快來挑戰看看你能得幾分！`
    if (navigator.share) {
      navigator.share({ title: '璀璨穿搭挑戰', text })
    } else {
      navigator.clipboard.writeText(text)
    }
  }, [scoreBreakdown, theme.name])

  if (!open) return null

  const totalScore = scoreBreakdown
    ? scoreBreakdown.styleHarmony + scoreBreakdown.themeMatch + scoreBreakdown.completeness + scoreBreakdown.colorHarmony
    : 0
  const rankInfo = getRankBadge(totalScore)
  const prize = totalScore >= 85 ? 50 : totalScore >= 70 ? 30 : totalScore >= 50 ? 15 : 5

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl p-5 md:p-8 max-w-lg w-full shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200 transition-colors z-20"
        >
          <X size={16} />
        </button>

        {/* ── Intro State ─────────────────────────────── */}
        {gameState === 'intro' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[300px] space-y-6"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles size={40} className="text-gold-500" />
            </motion.div>

            <div className="text-center space-y-2">
              <p className="text-xs tracking-[0.3em] text-gold-500">FASHION CHALLENGE</p>
              <h2 className="text-xl font-serif">璀璨穿搭挑戰</h2>
            </div>

            <div className="bg-cream-50 rounded-2xl p-5 text-center space-y-2 w-full">
              <p className="text-xs text-muted-foreground">今日挑戰主題</p>
              <p className="text-lg font-serif text-gold-600">{theme.name}</p>
            </div>

            <div className="text-center space-y-1 text-sm text-muted-foreground">
              <p>在 60 秒內選擇最多 5 件單品</p>
              <p>打造最符合主題的穿搭組合</p>
            </div>

            <AnimatePresence mode="wait">
              {countdown > 0 && (
                <motion.div
                  key={countdown}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  className="text-5xl font-serif text-gold-500"
                >
                  {countdown}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Playing State ───────────────────────────── */}
        {gameState === 'playing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className={timer <= 10 ? 'text-red-500' : 'text-gold-500'} />
                <span className={`text-sm font-mono font-bold ${timer <= 10 ? 'text-red-500' : 'text-foreground'}`}>
                  {timer}s
                </span>
              </div>
              <p className="text-xs text-gold-500 font-medium truncate max-w-[140px]">{theme.name}</p>
              <span className="text-xs text-muted-foreground">{selectedIds.size}/5 已選</span>
            </div>

            {/* Progress bar for timer */}
            <div className="w-full h-1 bg-cream-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${timer <= 10 ? 'bg-red-400' : 'bg-gold-500'}`}
                initial={{ width: '100%' }}
                animate={{ width: `${(timer / 60) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
              {FASHION_ITEMS.map((item) => {
                const isSelected = selectedIds.has(item.id)
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleItem(item.id)}
                    className={`relative rounded-xl p-2 text-left transition-all ${
                      isSelected
                        ? 'ring-2 ring-gold-500 bg-gold-500/5'
                        : 'bg-cream-50 hover:bg-cream-100'
                    }`}
                  >
                    {/* Selected checkmark */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center z-10"
                      >
                        <Check size={12} className="text-white" />
                      </motion.div>
                    )}

                    {/* Image placeholder */}
                    <div
                      className="w-full aspect-square rounded-lg mb-1.5 flex items-center justify-center"
                      style={{ backgroundColor: item.bgColor }}
                    >
                      <Shirt size={20} className="text-foreground/30" />
                    </div>

                    {/* Name */}
                    <p className="text-[10px] md:text-xs font-medium leading-tight line-clamp-2">{item.name}</p>

                    {/* Category badge */}
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-cream-200 text-muted-foreground">
                      {CATEGORY_ICONS[item.category]} {item.category}
                    </span>

                    {/* Style tags */}
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {item.styleTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[8px] px-1 py-px rounded-full bg-gold-500/10 text-gold-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={selectedIds.size < 2}
              className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              完成穿搭（{selectedIds.size} 件）
            </button>
          </motion.div>
        )}

        {/* ── Scoring State ───────────────────────────── */}
        {gameState === 'scoring' && scoreBreakdown && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="text-center space-y-1">
              <p className="text-xs tracking-[0.3em] text-gold-500">CHALLENGE RESULT</p>
              <h2 className="text-xl font-serif">穿搭評分</h2>
              <p className="text-xs text-muted-foreground">主題：{theme.name}</p>
            </div>

            {/* Score display */}
            <div className="flex flex-col items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className={`w-20 h-20 rounded-full ${rankInfo.bg} flex items-center justify-center`}
              >
                <span className="text-3xl font-serif font-bold" style={{ color: rankInfo.color }}>
                  {rankInfo.rank}
                </span>
              </motion.div>
              <p className="text-3xl font-serif font-bold text-foreground">{animatedScore}<span className="text-lg text-muted-foreground">/100</span></p>
            </div>

            {/* Score breakdown */}
            <div className="space-y-2.5 bg-cream-50 rounded-2xl p-4">
              {[
                { label: '風格協調', score: scoreBreakdown.styleHarmony, max: 30 },
                { label: '主題契合', score: scoreBreakdown.themeMatch, max: 30 },
                { label: '搭配完整度', score: scoreBreakdown.completeness, max: 20 },
                { label: '色彩和諧', score: scoreBreakdown.colorHarmony, max: 20 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right">{item.label}</span>
                  <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.score / item.max) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }}
                      className="h-full bg-gold-500 rounded-full"
                    />
                  </div>
                  <span className="text-xs font-medium w-12">{item.score}/{item.max}</span>
                </div>
              ))}
            </div>

            {/* Prize */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="flex items-center justify-center gap-2 p-3 bg-gold-500/10 rounded-xl"
            >
              <Crown size={16} className="text-gold-500" />
              <p className="text-sm font-medium">
                獲得 <span className="text-gold-600 font-bold">{prize} 點</span>！
              </p>
            </motion.div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleShare}
                className="w-full py-3.5 bg-[#06C755] text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Share2 size={14} />
                分享穿搭
              </button>
              <button
                onClick={handlePlayAgain}
                className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gold-600 transition-colors"
              >
                <RotateCcw size={14} />
                再次挑戰
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                返回
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
