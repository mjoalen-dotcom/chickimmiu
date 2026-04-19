'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props { settings: Record<string, unknown> }

/**
 * 刮刮樂 — 接通後端版本
 * ────────────────────
 * 原本是 3-格相符 match-game 的純 client stub（`PRIZE_POOL` 本地隨機）。
 * 後端 `/api/games` POST { action:'play', gameType:'scratch_card' } 回傳**單一獎項**，
 * 所以 UI 也同步簡化成「刮開揭曉一張獎」。
 *
 * 流程：
 *   - Mount → GET /api/games 取 dailyStatus.scratch_card + prizeTable
 *   - 第一次下滑刮時 → POST /api/games 建 record + 扣點 + 發獎
 *   - 回傳獎項存 state；canvas 繼續讓 user 刮
 *   - 刮開 45% 自動揭曉 → 顯示結果 + 入帳訊息 + 剩餘次數
 *
 * 錯誤態：未登入 / 點數不足 / 今日上限 → 不允許刮、顯示訊息。
 */

const POINTS_COST = 30

type PrizeEntry = { prize: string; type: string; amount: number }
type DailyStatus = {
  played: number
  remaining: number
  canPlay: boolean
  freePlaysLeft: number
  requiresPoints: boolean
}
type PrizeResp = {
  prize: { prize: string; type: string; amount: number }
  pointsSpent: number
}

const PRIZE_ICONS: Record<string, string> = {
  points: '🎯',
  credit: '💰',
  coupon: '🏷️',
  badge: '🏅',
}

export function ScratchCardGame({}: Props) {
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null)
  const [authError, setAuthError] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)

  const [result, setResult] = useState<PrizeResp | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [scratchProgress, setScratchProgress] = useState(0)
  const [committing, setCommitting] = useState(false)
  const [committed, setCommitted] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const totalPixels = useRef(0)
  // 最新 prizeTable 不直接用在 UI render（爬 rarity 不重要），只為 future-proof；目前僅用 result
  const prizeTable = useRef<PrizeEntry[]>([])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/games', { credentials: 'include' })
      if (res.status === 401) {
        setAuthError(true)
        return
      }
      if (!res.ok) {
        setLoadError(`無法載入遊戲狀態（HTTP ${res.status}）`)
        return
      }
      const json = (await res.json()) as {
        success: boolean
        data?: {
          configs?: Record<string, { prizeTable?: PrizeEntry[] }>
          dailyStatus?: Record<string, DailyStatus>
        }
      }
      setAuthError(false)
      setLoadError(null)
      const cfg = json.data?.configs?.scratch_card
      if (cfg?.prizeTable) prizeTable.current = cfg.prizeTable
      if (json.data?.dailyStatus?.scratch_card) setDailyStatus(json.data.dailyStatus.scratch_card)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '載入失敗')
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // 第一次刮時 commit play
  const commitPlay = useCallback(async () => {
    if (committed || committing) return false
    if (!dailyStatus?.canPlay) return false
    setCommitting(true)
    setPlayError(null)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play', gameType: 'scratch_card' }),
      })
      const json = (await res.json()) as {
        success: boolean
        error?: string
        data?: PrizeResp
      }
      if (!res.ok || !json.success || !json.data) {
        setPlayError(json.error || `遊戲失敗 (HTTP ${res.status})`)
        fetchStatus() // 可能 limit 或 points 改變
        setCommitting(false)
        return false
      }
      setResult(json.data)
      setCommitted(true)
      setCommitting(false)
      return true
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : '網路錯誤')
      setCommitting(false)
      return false
    }
  }, [committed, committing, dailyStatus, fetchStatus])

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    canvasRef.current = canvas

    const dpr = 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#C19A5B'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = `bold ${14 * dpr}px serif`
    for (let y = 20 * dpr; y < canvas.height; y += 30 * dpr) {
      for (let x = 0; x < canvas.width; x += 80 * dpr) {
        ctx.fillText('CKMU', x, y)
      }
    }

    ctx.font = `bold ${16 * dpr}px serif`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.textAlign = 'center'
    ctx.fillText('用手指刮開這裡 ↓', canvas.width / 2, canvas.height / 2 - 8)
    ctx.font = `${10 * dpr}px serif`
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('刮滿 45% 自動揭曉', canvas.width / 2, canvas.height / 2 + 12)

    totalPixels.current = canvas.width * canvas.height
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || revealed) return
    if (canvas.width === 0) initCanvas(canvas)
  }, [initCanvas, revealed])

  const checkProgress = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || revealed) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    let transparent = 0
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] < 128) transparent++
    }
    const sampledTotal = Math.ceil(data.length / 16)
    const progress = transparent / sampledTotal
    setScratchProgress(progress)

    if (progress >= 0.45 && committed) {
      setRevealed(true)
      fetchStatus()
    }
  }, [revealed, committed, fetchStatus])

  const scratch = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || revealed) return
    if (!committed) return // 尚未 commit 時不實際刮（應該也走不到這裡）
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX: number, clientY: number
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 25 * scaleX, 0, Math.PI * 2)
    ctx.fill()

    checkProgress()
  }, [revealed, committed, checkProgress])

  const handleStart = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (revealed) return
    // 第一次按下時先 commit play，backend 成功才開始刮
    if (!committed) {
      const ok = await commitPlay()
      if (!ok) return
    }
    isDrawing.current = true
  }, [revealed, committed, commitPlay])

  const handleEnd = useCallback(() => {
    isDrawing.current = false
    checkProgress()
  }, [checkProgress])

  const remaining = dailyStatus?.remaining ?? 0
  const freePlaysLeft = dailyStatus?.freePlaysLeft ?? 0
  const requiresPoints = dailyStatus?.requiresPoints ?? false

  // ── 未登入 ──
  if (authError) {
    return (
      <div className="max-w-sm mx-auto text-center py-12">
        <p className="text-lg mb-4">請先登入以開始遊戲</p>
        <a
          href="/login?redirect=/games/scratch-card"
          className="inline-block px-6 py-2.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
        >
          前往登入
        </a>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-sm mx-auto text-center py-12">
        <p className="text-sm text-rose-600 mb-4">{loadError}</p>
        <button
          onClick={fetchStatus}
          className="px-5 py-2 border border-cream-200 rounded-full text-sm hover:bg-cream-50"
        >
          重試
        </button>
      </div>
    )
  }

  const canScratch = dailyStatus?.canPlay ?? false

  return (
    <div className="max-w-sm mx-auto text-center">
      {/* Header */}
      <div className="mb-6 p-4 bg-cream-100 rounded-xl border border-cream-200 text-left">
        <div className="flex items-start justify-between mb-2 gap-3">
          <p className="text-sm font-bold text-gold-600">🎰 刮刮樂</p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            剩餘 <span className="text-gold-600 font-bold">{remaining}</span>
            {freePlaysLeft > 0 ? `（免費 ${freePlaysLeft}）` : `（每次 ${POINTS_COST} 點）`}
          </p>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• 用手指／滑鼠刮開金色區域</li>
          <li>• 刮滿 <span className="text-gold-600 font-medium">45%</span> 自動揭曉</li>
          <li>• 獎項依系統機率抽出，已自動入帳</li>
        </ul>
        {requiresPoints && freePlaysLeft === 0 && remaining > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ 今日免費次數用完，每次消耗 {POINTS_COST} 點
          </p>
        )}
        {!canScratch && (
          <p className="text-xs text-rose-600 mt-2">今日刮刮樂次數已用完</p>
        )}
      </div>

      {/* Scratch area */}
      <div className="relative w-full aspect-[3/2] bg-white rounded-2xl border-2 border-gold-400 overflow-hidden mb-6 shadow-lg">
        {/* Prize reveal layer */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {!committed && !revealed ? (
            <div className="text-center text-muted-foreground">
              <p className="text-3xl mb-2">🎁</p>
              <p className="text-xs">開始刮揭曉獎項</p>
            </div>
          ) : result ? (
            <div
              className={`flex-1 h-full rounded-xl flex items-center justify-center text-center transition-all duration-500 ${
                revealed
                  ? 'bg-gradient-to-br from-gold-400 to-amber-500 text-white scale-105 shadow-lg'
                  : 'bg-cream-100 border border-cream-200'
              }`}
            >
              <div>
                <p className="text-4xl mb-2">{PRIZE_ICONS[result.prize.type] || '🎁'}</p>
                <p className="text-lg font-bold">{result.prize.prize}</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <p className="text-2xl">⏳</p>
              <p className="text-xs mt-2">處理中...</p>
            </div>
          )}
        </div>

        {/* Canvas scratch layer */}
        {!revealed && canScratch && (
          <canvas
            ref={initCanvas}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onMouseMove={scratch}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            onTouchMove={scratch}
          />
        )}
      </div>

      {/* Progress bar */}
      {!revealed && committed && (
        <div className="mb-4">
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full"
              animate={{ width: `${Math.min(scratchProgress * 100 / 0.45, 100)}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            刮開進度：{Math.min(Math.round(scratchProgress * 100 / 0.45), 100)}%
          </p>
        </div>
      )}

      {committing && (
        <p className="text-xs text-muted-foreground mb-3">正在建立遊戲紀錄…</p>
      )}

      {playError && (
        <p className="text-sm text-rose-600 mb-3">{playError}</p>
      )}

      {/* Result */}
      {revealed && result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-2xl border bg-gold-500/10 border-gold-500/30"
        >
          <p className="font-serif text-xl mb-2">🎉 {result.prize.prize}</p>
          <p className="text-xs text-muted-foreground">
            {result.prize.type === 'points' && `已加入點數（+${result.prize.amount}）`}
            {result.prize.type === 'credit' && `已加入購物金（+NT$${result.prize.amount}）`}
            {result.prize.type === 'coupon' && '已進寶物箱，可於「我的寶物箱」查詢'}
            {result.prize.type === 'badge' && '已取得徽章'}
            {result.pointsSpent > 0 && (
              <span className="block mt-1 text-amber-600">（扣 {result.pointsSpent} 點）</span>
            )}
          </p>
          <button
            onClick={() => window.location.reload()}
            disabled={remaining <= 0}
            className="mt-4 px-6 py-2 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {remaining <= 0 ? '今日已用完' : '再刮一張'}
          </button>
        </motion.div>
      )}
    </div>
  )
}
