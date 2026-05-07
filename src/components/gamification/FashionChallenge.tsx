'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Sparkles, Clock, Check, Share2, RotateCcw, Crown } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onComplete?: () => void
}

type Phase =
  | 'checking'    // fetch daily status
  | 'auth'        // not logged in
  | 'limit'       // daily cap reached
  | 'error'       // general error
  | 'ready'       // show start button
  | 'starting'    // API call to create session
  | 'playing'     // in-game
  | 'submitting'  // scoring API call
  | 'done'        // show result

type DailyStatus = { remaining: number; canPlay: boolean }

type SessionItem = {
  id: string
  name: string
  category: string
  image: string
  style: string[]
  colorFamily: string
}

type Session = {
  challengeId: string
  theme: string
  items: SessionItem[]
  timeLimit: number
}

type Result = {
  score: number
  rank: 'S' | 'A' | 'B' | 'C'
  pointsReward: number
  breakdown: {
    styleCoherence: number
    themeMatch: number
    categoryCompleteness: number
    colorHarmony: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

const COLOR_BG: Record<string, string> = {
  neutral: '#F9F5EC',
  warm: '#F6D7CD',
  cool: '#B8C9E2',
  earth: '#D4AF77',
  pastel: '#FBEDE8',
  bold: '#C19A5B',
}

const CATEGORY_LABELS: Record<string, string> = {
  top: '上衣',
  bottom: '下身',
  outer: '外套',
  accessories: '配件',
  shoes: '鞋子',
}

const CATEGORY_ICONS: Record<string, string> = {
  top: '👚',
  bottom: '👗',
  outer: '🧥',
  accessories: '💍',
  shoes: '👟',
}

function rankDisplay(rank: 'S' | 'A' | 'B' | 'C') {
  switch (rank) {
    case 'S': return { color: '#C19A5B', bg: 'bg-gold-500/10' }
    case 'A': return { color: '#16a34a', bg: 'bg-green-500/10' }
    case 'B': return { color: '#2563eb', bg: 'bg-blue-500/10' }
    default: return { color: '#6b7280', bg: 'bg-gray-500/10' }
  }
}

// ─── Main Component ───────────────────────────────────────────────

export function FashionChallenge({ open, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [timer, setTimer] = useState(60)
  const [result, setResult] = useState<Result | null>(null)
  const [animScore, setAnimScore] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittingRef = useRef(false)

  // Stable refs for use inside setInterval callback
  const selectedIdsRef = useRef<Set<string>>(new Set())
  const sessionRef = useRef<Session | null>(null)
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])
  useEffect(() => { sessionRef.current = session }, [session])

  // ── submit result to API ──────────────────────────────────────────
  const doSubmit = useCallback(async (ses: Session | null, selIds: Set<string>) => {
    if (!ses || submittingRef.current) return
    submittingRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('submitting')
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play',
          gameType: 'fashion_challenge',
          subAction: 'submit',
          challengeId: ses.challengeId,
          selectedItems: Array.from(selIds),
        }),
      })
      const json = await res.json() as { success: boolean; error?: string; data?: Result }
      if (!res.ok || !json.success || !json.data) {
        setErrorMsg(json.error ?? `提交失敗（${res.status}）`)
        setPhase('error')
        return
      }
      setResult(json.data)
      setPhase('done')
      onComplete?.()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '網路錯誤')
      setPhase('error')
    }
  }, [onComplete])

  // Keep doSubmit accessible inside the interval without re-creating the timer
  const doSubmitRef = useRef(doSubmit)
  useEffect(() => { doSubmitRef.current = doSubmit }, [doSubmit])

  // ── fetch daily status ────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setPhase('checking')
    try {
      const res = await fetch('/api/games', { credentials: 'include' })
      if (res.status === 401) { setPhase('auth'); return }
      if (!res.ok) { setErrorMsg(`載入失敗（${res.status}）`); setPhase('error'); return }
      const json = await res.json() as {
        success: boolean
        data?: { dailyStatus?: Record<string, DailyStatus> }
      }
      const ds = json.data?.dailyStatus?.fashion_challenge
      if (ds) { setDailyStatus(ds); setPhase(ds.canPlay ? 'ready' : 'limit') }
      else setPhase('ready')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '載入失敗')
      setPhase('error')
    }
  }, [])

  // ── reset on open ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    submittingRef.current = false
    setSession(null)
    setSelectedIds(new Set())
    setTimer(60)
    setResult(null)
    setErrorMsg(null)
    setAnimScore(0)
    fetchStatus()
  }, [open, fetchStatus])

  // ── timer (only active in 'playing') ─────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          doSubmitRef.current(sessionRef.current, selectedIdsRef.current)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  // ── score count-up animation ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done' || !result) return
    let current = 0
    const step = Math.max(1, Math.floor(result.score / 30))
    const interval = setInterval(() => {
      current += step
      if (current >= result.score) { current = result.score; clearInterval(interval) }
      setAnimScore(current)
    }, 40)
    return () => clearInterval(interval)
  }, [phase, result])

  // ── start challenge ───────────────────────────────────────────────
  const handleStart = async () => {
    setPhase('starting')
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play', gameType: 'fashion_challenge' }),
      })
      const json = await res.json() as { success: boolean; error?: string; data?: Session }
      if (!res.ok || !json.success || !json.data) {
        setErrorMsg(json.error ?? `開始失敗（${res.status}）`)
        setPhase('error')
        return
      }
      setSession(json.data)
      setTimer(json.data.timeLimit || 60)
      setSelectedIds(new Set())
      submittingRef.current = false
      setPhase('playing')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '網路錯誤')
      setPhase('error')
    }
  }

  const handleSubmit = () => doSubmit(sessionRef.current, selectedIdsRef.current)

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 5) next.add(id)
      return next
    })
  }

  const handleShare = () => {
    if (!result || !session) return
    const text = `【CHIC KIM & MIU 璀璨穿搭挑戰】\n主題：${session.theme}\n我的評分：${result.score}/100（${result.rank} 級）✨\n快來挑戰看看你能得幾分！`
    if (navigator.share) navigator.share({ title: '璀璨穿搭挑戰', text }).catch(() => {})
    else navigator.clipboard.writeText(text).catch(() => {})
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl p-5 md:p-8 max-w-lg w-full shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200 z-20"
          aria-label="關閉"
        >
          <X size={16} />
        </button>

        {/* ── Loading / Starting ── */}
        {(phase === 'checking' || phase === 'starting') && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Sparkles size={32} className="text-gold-500" />
            </motion.div>
            <p className="text-sm text-muted-foreground">
              {phase === 'starting' ? '準備挑戰中⋯' : '載入中⋯'}
            </p>
          </div>
        )}

        {/* ── Auth ── */}
        {phase === 'auth' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
            <p className="text-sm">請先登入以開始遊戲</p>
            <a
              href="/login?redirect=/account/points"
              className="px-6 py-2.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
            >
              前往登入
            </a>
          </div>
        )}

        {/* ── Daily Limit ── */}
        {phase === 'limit' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
            <p className="text-4xl">✨</p>
            <p className="text-sm font-medium">今日挑戰次數已用完</p>
            <p className="text-xs text-muted-foreground">明天再來挑戰吧！</p>
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
            <p className="text-sm text-rose-600">{errorMsg ?? '發生錯誤'}</p>
            <button
              onClick={fetchStatus}
              className="px-5 py-2 border border-cream-200 rounded-full text-sm hover:bg-cream-50"
            >
              重試
            </button>
          </div>
        )}

        {/* ── Ready ── */}
        {phase === 'ready' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-6 text-center">
            <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <Sparkles size={40} className="text-gold-500" />
            </motion.div>

            <div>
              <p className="text-xs tracking-[0.3em] text-gold-500 mb-1">FASHION CHALLENGE</p>
              <h2 className="text-xl font-serif">璀璨穿搭挑戰</h2>
            </div>

            <div className="bg-cream-50 rounded-2xl p-5 w-full text-left space-y-2 text-sm text-muted-foreground">
              <p>• 遊戲開始時系統隨機分配挑戰主題</p>
              <p>• 60 秒內選擇最多 5 件單品</p>
              <p>• AI 即時評分，最高 S 級時尚達人！</p>
            </div>

            {dailyStatus && (
              <p className="text-xs text-muted-foreground">
                今日剩餘 <span className="text-gold-600 font-bold">{dailyStatus.remaining}</span> 次
              </p>
            )}

            <button
              onClick={handleStart}
              className="px-8 py-3.5 bg-gradient-to-r from-gold-500 to-amber-600 text-white rounded-full text-sm font-medium tracking-wider hover:shadow-lg hover:scale-105 transition-all"
            >
              ✨ 開始挑戰
            </button>
          </div>
        )}

        {/* ── Playing ── */}
        {phase === 'playing' && session && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className={timer <= 10 ? 'text-red-500' : 'text-gold-500'} />
                <span className={`text-sm font-mono font-bold ${timer <= 10 ? 'text-red-500' : ''}`}>
                  {timer}s
                </span>
              </div>
              <p className="text-xs text-gold-500 font-medium truncate max-w-[160px]">{session.theme}</p>
              <span className="text-xs text-muted-foreground">{selectedIds.size}/5 已選</span>
            </div>

            {/* Timer bar */}
            <div className="w-full h-1 bg-cream-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${timer <= 10 ? 'bg-red-400' : 'bg-gold-500'}`}
                animate={{ width: `${(timer / (session.timeLimit || 60)) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {session.items.map((item) => {
                const sel = selectedIds.has(item.id)
                const bg = COLOR_BG[item.colorFamily] ?? '#F9F5EC'
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleItem(item.id)}
                    className={`relative rounded-xl p-2 text-left transition-all ${
                      sel ? 'ring-2 ring-gold-500 bg-gold-500/5' : 'bg-cream-50 hover:bg-cream-100'
                    }`}
                  >
                    {sel && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center z-10"
                      >
                        <Check size={12} className="text-white" />
                      </motion.div>
                    )}

                    <div
                      className="w-full aspect-square rounded-lg mb-1.5 overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: bg }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>

                    <p className="text-[10px] md:text-xs font-medium leading-tight line-clamp-2">{item.name}</p>
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-cream-200 text-muted-foreground">
                      {CATEGORY_ICONS[item.category] ?? '👕'} {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {item.style.slice(0, 2).map((s) => (
                        <span key={s} className="text-[8px] px-1 py-px rounded-full bg-gold-500/10 text-gold-600">{s}</span>
                      ))}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            <button
              onClick={handleSubmit}
              disabled={selectedIds.size < 2}
              className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              完成穿搭（{selectedIds.size} 件）
            </button>
          </motion.div>
        )}

        {/* ── Submitting ── */}
        {phase === 'submitting' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Sparkles size={32} className="text-gold-500" />
            </motion.div>
            <p className="text-sm text-muted-foreground">AI 評分中⋯</p>
          </div>
        )}

        {/* ── Done ── */}
        {phase === 'done' && result && session && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="text-center">
              <p className="text-xs tracking-[0.3em] text-gold-500">CHALLENGE RESULT</p>
              <h2 className="text-xl font-serif">穿搭評分</h2>
              <p className="text-xs text-muted-foreground mt-1">主題：{session.theme}</p>
            </div>

            {/* Rank + animated score */}
            <div className="flex flex-col items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className={`w-20 h-20 rounded-full ${rankDisplay(result.rank).bg} flex items-center justify-center`}
              >
                <span className="text-3xl font-serif font-bold" style={{ color: rankDisplay(result.rank).color }}>
                  {result.rank}
                </span>
              </motion.div>
              <p className="text-3xl font-serif font-bold">
                {animScore}<span className="text-lg text-muted-foreground">/100</span>
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5 bg-cream-50 rounded-2xl p-4">
              {[
                { label: '風格協調', score: result.breakdown.styleCoherence, max: 30 },
                { label: '主題契合', score: result.breakdown.themeMatch, max: 30 },
                { label: '搭配完整度', score: result.breakdown.categoryCompleteness, max: 20 },
                { label: '色彩和諧', score: result.breakdown.colorHarmony, max: 20 },
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
                  <span className="text-xs font-medium w-10 text-right">{item.score}/{item.max}</span>
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
                獲得 <span className="text-gold-600 font-bold">{result.pointsReward} 點</span>！
              </p>
            </motion.div>

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                onClick={handleShare}
                className="w-full py-3.5 bg-[#06C755] text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Share2 size={14} />
                分享穿搭成果
              </button>
              <button
                onClick={fetchStatus}
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
