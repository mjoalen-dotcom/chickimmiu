'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Sparkles, Share2 } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

/**
 * 穿搭挑戰 — 接通後端版本
 * ───────────────────────
 * 原本是純 client stub（本地寫 ITEMS dict + 本地 style 分數），完全沒打 API。
 *
 * 接通後：
 *   - 按「開始挑戰」→ POST /api/games { action:'play', gameType:'fashion_challenge' }
 *     → 後端 startChallenge 抽主題 + 14 個 FashionItem，建 mini_game_records 草稿（status='active'）
 *   - Client 按分類渲染後端回的 items（top/bottom/outer/accessories/shoes 固定 5 類）
 *   - 倒數結束或手動提交 → POST { action:'play', gameType:'fashion_challenge',
 *     subAction:'submit', challengeId, selectedItems } → 後端 scoreOutfit + 入分
 *   - 回傳 { score, rank, pointsReward, breakdown } → 顯示
 *
 * 備註：這個遊戲的獎勵是「points」直接入帳，不走 UserRewards（寶物箱）。
 */

type Category = 'top' | 'bottom' | 'outer' | 'accessories' | 'shoes'

interface FashionItem {
  id: string
  name: string
  category: Category
  image: string
  style: string[]
  colorFamily: string
}

interface ChallengeSession {
  challengeId: string
  theme: string
  items: FashionItem[]
  timeLimit: number
  createdAt: string
}

interface ChallengeResult {
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

type Phase = 'intro' | 'playing' | 'scoring' | 'result' | 'error'

const CATEGORY_LABELS: Record<Category, string> = {
  top: '上衣',
  bottom: '下身',
  outer: '外套',
  accessories: '配飾',
  shoes: '鞋子',
}

const CATEGORY_ORDER: Category[] = ['top', 'bottom', 'outer', 'accessories', 'shoes']

const POINTS_COST = 20

type DailyStatus = {
  played: number
  remaining: number
  canPlay: boolean
  freePlaysLeft: number
  requiresPoints: boolean
}

export function FashionChallengeGame({ settings }: Props) {
  void settings // 後端決定 timeLimit / reward，settings 不再使用

  const [phase, setPhase] = useState<Phase>('intro')
  const [session, setSession] = useState<ChallengeSession | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selections, setSelections] = useState<Partial<Record<Category, string>>>({})
  const [activeCat, setActiveCat] = useState<Category>('top')
  const [result, setResult] = useState<ChallengeResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null)
  const [authError, setAuthError] = useState(false)
  const [starting, setStarting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Mount → fetch status
  useEffect(() => {
    let cancelled = false
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/games', { credentials: 'include' })
        if (cancelled) return
        if (res.status === 401) {
          setAuthError(true)
          return
        }
        if (!res.ok) return
        const json = (await res.json()) as {
          data?: { dailyStatus?: Record<string, DailyStatus> }
        }
        if (json.data?.dailyStatus?.fashion_challenge) {
          setDailyStatus(json.data.dailyStatus.fashion_challenge)
        }
      } catch {
        // silent — intro 仍可顯示
      }
    }
    fetchStatus()
    return () => {
      cancelled = true
    }
  }, [])

  // Items grouped by category — derived from session
  const itemsByCategory: Record<Category, FashionItem[]> = {
    top: [],
    bottom: [],
    outer: [],
    accessories: [],
    shoes: [],
  }
  if (session) {
    for (const item of session.items) {
      if (itemsByCategory[item.category]) itemsByCategory[item.category].push(item)
    }
  }

  const finishGame = useCallback(
    async (sessionToSubmit: ChallengeSession, picked: Partial<Record<Category, string>>) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase('scoring')

      const selectedItems = Object.values(picked).filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      )

      try {
        const res = await fetch('/api/games', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'play',
            gameType: 'fashion_challenge',
            subAction: 'submit',
            challengeId: sessionToSubmit.challengeId,
            selectedItems,
          }),
        })
        const json = (await res.json()) as {
          success: boolean
          error?: string
          data?: ChallengeResult
        }
        if (!res.ok || !json.success || !json.data) {
          setErrorMsg(json.error || `提交失敗 (HTTP ${res.status})`)
          setPhase('error')
          return
        }
        setResult(json.data)
        setPhase('result')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : '網路錯誤')
        setPhase('error')
      }
    },
    [],
  )

  // Timer tick
  useEffect(() => {
    if (phase !== 'playing' || !session) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          // Capture current selections via functional update pattern
          // 用 ref 讀最新 selections 避免閉包
          setSelections((curSel) => {
            finishGame(session, curSel)
            return curSel
          })
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, session, finishGame])

  const startGame = useCallback(async () => {
    if (starting) return
    setErrorMsg(null)
    setStarting(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play',
          gameType: 'fashion_challenge',
        }),
      })
      const json = (await res.json()) as {
        success: boolean
        error?: string
        data?: ChallengeSession
      }
      if (!res.ok || !json.success || !json.data) {
        setErrorMsg(json.error || `無法開始挑戰 (HTTP ${res.status})`)
        setStarting(false)
        return
      }
      setSession(json.data)
      setTimeLeft(json.data.timeLimit || 60)
      setSelections({})
      setActiveCat('top')
      setResult(null)
      setPhase('playing')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '網路錯誤')
    } finally {
      setStarting(false)
    }
  }, [starting])

  const selectItem = useCallback(
    (cat: Category, id: string) => {
      setSelections((prev) => ({ ...prev, [cat]: id }))
      const idx = CATEGORY_ORDER.indexOf(cat)
      if (idx < CATEGORY_ORDER.length - 1) {
        setActiveCat(CATEGORY_ORDER[idx + 1])
      }
    },
    [],
  )

  const submitEarly = useCallback(() => {
    if (!session) return
    finishGame(session, selections)
  }, [session, selections, finishGame])

  const shareResult = useCallback(() => {
    if (!result) return
    if (navigator.share) {
      navigator.share({
        title: `我在 CKMU 穿搭挑戰獲得 ${result.rank} 級！${result.score} 分`,
        url: window.location.href,
      })
    }
  }, [result])

  // ── 未登入 ──
  if (authError) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-lg mb-4">請先登入以開始挑戰</p>
        <a
          href="/login?redirect=/games/fashion-challenge"
          className="inline-block px-6 py-2.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
        >
          前往登入
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Intro ── */}
      {phase === 'intro' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
          <p className="text-5xl mb-4">✨</p>
          <h2 className="text-2xl font-serif mb-3">璀璨穿搭挑戰</h2>
          <p className="text-sm text-muted-foreground mb-2">在限時內完成主題穿搭</p>
          <p className="text-sm text-muted-foreground mb-6">AI 即時評分，S 級穿搭贏取最高獎勵！</p>
          <div className="bg-cream-100 rounded-xl p-4 mb-6 text-left text-xs space-y-1 text-muted-foreground">
            <p>1. 從 5 個分類中各選一件單品</p>
            <p>2. 注重整體搭配的協調性與時尚感</p>
            <p>3. 選越多、搭越好，分數越高</p>
            <p>4. 可提前交卷，但記得快速選擇！</p>
          </div>
          {dailyStatus && (
            <p className="text-xs text-muted-foreground mb-4">
              剩餘 <span className="text-gold-600 font-bold">{dailyStatus.remaining}</span> 次
              {dailyStatus.freePlaysLeft > 0
                ? `（免費 ${dailyStatus.freePlaysLeft}）`
                : `（每次消耗 ${POINTS_COST} 點）`}
            </p>
          )}
          {errorMsg && <p className="text-sm text-rose-600 mb-3">{errorMsg}</p>}
          <button
            onClick={startGame}
            disabled={starting || dailyStatus?.canPlay === false}
            className="px-10 py-3 bg-gradient-to-r from-gold-500 to-amber-600 text-white rounded-full text-lg font-serif hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting
              ? '準備中...'
              : dailyStatus?.canPlay === false
                ? '今日次數已用完'
                : '開始挑戰'}
          </button>
        </motion.div>
      )}

      {/* ── Playing ── */}
      {phase === 'playing' && session && (
        <div>
          {/* Theme banner */}
          <div className="mb-4 text-center">
            <p className="text-xs text-gold-500 tracking-widest mb-1">本場主題</p>
            <p className="text-xl font-serif">{session.theme}</p>
          </div>

          {/* Timer bar */}
          <div className="flex items-center gap-3 mb-6">
            <Timer size={18} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gold-600'} />
            <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${timeLeft <= 10 ? 'bg-red-500' : 'bg-gold-500'}`}
                animate={{ width: `${(timeLeft / session.timeLimit) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className={`text-sm font-mono font-medium ${timeLeft <= 10 ? 'text-red-500' : ''}`}>
              {timeLeft}s
            </span>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 mb-6">
            {CATEGORY_ORDER.map((cat) => (
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
                {selections[cat] ? '✓' : ''} {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Items */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <AnimatePresence mode="popLayout">
              {(itemsByCategory[activeCat] || []).map((item) => (
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
                  <span className="text-2xl block mb-1">👗</span>
                  <p className="text-xs font-medium">{item.name}</p>
                </motion.button>
              ))}
              {(itemsByCategory[activeCat] || []).length === 0 && (
                <p className="col-span-2 text-center text-xs text-muted-foreground py-4">
                  本場此分類沒有單品
                </p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <button
            onClick={submitEarly}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            提交穿搭（{Object.keys(selections).length}/{CATEGORY_ORDER.length}）
          </button>
        </div>
      )}

      {/* ── Scoring ── */}
      {phase === 'scoring' && (
        <div className="text-center py-16">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkles size={48} className="text-gold-500 mx-auto" />
          </motion.div>
          <p className="mt-4 font-serif text-lg">AI 正在評分中...</p>
        </div>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className="text-center py-12">
          <p className="text-lg mb-3">⚠️ {errorMsg || '發生錯誤'}</p>
          <button
            onClick={() => {
              setPhase('intro')
              setErrorMsg(null)
            }}
            className="px-6 py-2.5 bg-foreground text-cream-50 rounded-full text-sm"
          >
            返回
          </button>
        </div>
      )}

      {/* ── Result ── */}
      {phase === 'result' && result && session && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div
            className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 ${
              result.rank === 'S'
                ? 'bg-gradient-to-br from-gold-400 to-amber-500'
                : result.rank === 'A'
                  ? 'bg-gradient-to-br from-violet-400 to-purple-500'
                  : result.rank === 'B'
                    ? 'bg-gradient-to-br from-blue-400 to-indigo-500'
                    : 'bg-gradient-to-br from-gray-300 to-gray-400'
            }`}
          >
            <div className="text-center text-white">
              <p className="text-4xl font-serif font-bold">{result.rank}</p>
              <p className="text-sm">{result.score} 分</p>
            </div>
          </div>

          <h2 className="text-2xl font-serif mb-2">
            {result.rank === 'S'
              ? '👑 時尚天后！'
              : result.rank === 'A'
                ? '🌟 穿搭達人！'
                : result.rank === 'B'
                  ? '✨ 不錯的搭配！'
                  : '💪 繼續加油！'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            主題：{session.theme} · 獲得 {result.pointsReward} 點
          </p>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6 text-left">
            <h4 className="text-sm font-medium mb-3">評分明細</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>風格一致性</span>
                <span className="text-gold-600 font-medium">{result.breakdown.styleCoherence} / 30</span>
              </div>
              <div className="flex justify-between">
                <span>主題吻合度</span>
                <span className="text-gold-600 font-medium">{result.breakdown.themeMatch} / 30</span>
              </div>
              <div className="flex justify-between">
                <span>分類完整度</span>
                <span className="text-gold-600 font-medium">{result.breakdown.categoryCompleteness} / 20</span>
              </div>
              <div className="flex justify-between">
                <span>配色和諧度</span>
                <span className="text-gold-600 font-medium">{result.breakdown.colorHarmony} / 20</span>
              </div>
            </div>
          </div>

          {/* Selections recap */}
          <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6 text-left">
            <h4 className="text-sm font-medium mb-3">你的穿搭</h4>
            <div className="space-y-2">
              {CATEGORY_ORDER.map((cat) => {
                const id = selections[cat]
                const item = session.items.find((i) => i.id === id)
                return (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                    <span>{item ? item.name : '未選擇'}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPhase('intro')
                setSession(null)
                setSelections({})
                setResult(null)
              }}
              className="flex-1 py-3 bg-foreground text-cream-50 rounded-xl text-sm"
            >
              再挑戰一次
            </button>
            <button
              onClick={shareResult}
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
