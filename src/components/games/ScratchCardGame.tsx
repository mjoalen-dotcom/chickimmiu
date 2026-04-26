'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props { settings: Record<string, unknown> }

/**
 * 刮刮樂 — 3 格刮版
 * ───────────────────
 * 後端 `/api/games` POST { action:'play', gameType:'scratch_card' } 回單一獎項，
 * UI 用 3 個獨立 canvas cell 視覺化「三格相符」的傳統刮刮樂體驗。
 *
 * 流程：
 *   - Mount → GET /api/games 取 dailyStatus.scratch_card + prizeTable
 *   - 第一次刮任一格時 → POST /api/games 建 record + 扣點 + 發獎
 *   - 後端確認後 3 格皆 unlock 開放刮，獎項 icon 在 3 格 reveal 同一個（相符）
 *   - 任一格刮滿 45% 即自動揭曉該格；3 格皆揭曉 → 顯示完整結果 + 入帳訊息
 *
 * 錯誤態：未登入 / 點數不足 / 今日上限 → 不允許刮、顯示訊息。
 */

const POINTS_COST = 30
const REVEAL_THRESHOLD = 0.45
const CELL_COUNT = 3

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
  const [revealedCells, setRevealedCells] = useState<boolean[]>(() =>
    Array(CELL_COUNT).fill(false),
  )
  const [progressPerCell, setProgressPerCell] = useState<number[]>(() =>
    Array(CELL_COUNT).fill(0),
  )
  const [committing, setCommitting] = useState(false)
  const [committed, setCommitted] = useState(false)

  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>(Array(CELL_COUNT).fill(null))
  const drawingCellRef = useRef<number | null>(null)
  const prizeTable = useRef<PrizeEntry[]>([])

  const allRevealed = revealedCells.every(Boolean)

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

  // 第一次刮任一格時 commit play
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
        fetchStatus()
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

  const initCanvas = useCallback((index: number, canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      canvasRefs.current[index] = null
      return
    }
    canvasRefs.current[index] = canvas

    const dpr = 1
    if (canvas.width === 0) {
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#C19A5B'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = `bold ${10 * dpr}px serif`
    for (let y = 18 * dpr; y < canvas.height; y += 22 * dpr) {
      for (let x = 0; x < canvas.width; x += 50 * dpr) {
        ctx.fillText('CKMU', x, y)
      }
    }

    ctx.font = `bold ${12 * dpr}px serif`
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.textAlign = 'center'
    ctx.fillText('刮開', canvas.width / 2, canvas.height / 2)
  }, [])

  const checkProgress = useCallback((cellIndex: number) => {
    const canvas = canvasRefs.current[cellIndex]
    if (!canvas) return
    if (revealedCells[cellIndex]) return
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

    setProgressPerCell((prev) => {
      const next = [...prev]
      next[cellIndex] = progress
      return next
    })

    if (progress >= REVEAL_THRESHOLD && committed) {
      setRevealedCells((prev) => {
        if (prev[cellIndex]) return prev
        const next = [...prev]
        next[cellIndex] = true
        // 全 reveal 時重新拉一次狀態（剩餘次數會更新）
        if (next.every(Boolean)) fetchStatus()
        return next
      })
    }
  }, [revealedCells, committed, fetchStatus])

  const scratchAt = useCallback((cellIndex: number, e: React.MouseEvent | React.TouchEvent) => {
    if (drawingCellRef.current !== cellIndex) return
    if (revealedCells[cellIndex]) return
    if (!committed) return
    const canvas = canvasRefs.current[cellIndex]
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
    ctx.arc(x, y, 18 * scaleX, 0, Math.PI * 2)
    ctx.fill()

    checkProgress(cellIndex)
  }, [revealedCells, committed, checkProgress])

  const handleStart = useCallback(async (cellIndex: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (revealedCells[cellIndex]) return
    if (!committed) {
      const ok = await commitPlay()
      if (!ok) return
    }
    drawingCellRef.current = cellIndex
  }, [revealedCells, committed, commitPlay])

  const handleEnd = useCallback((cellIndex: number) => {
    if (drawingCellRef.current === cellIndex) {
      drawingCellRef.current = null
    }
    checkProgress(cellIndex)
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
  const prizeIcon = result ? (PRIZE_ICONS[result.prize.type] || '🎁') : '🎁'

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
          <li>• 刮開三格金色區域揭曉獎項</li>
          <li>• 每格刮滿 <span className="text-gold-600 font-medium">45%</span> 自動揭曉</li>
          <li>• 三格圖案相符即代表中獎，獎項已自動入帳</li>
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

      {/* 3-cell scratch row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Array.from({ length: CELL_COUNT }).map((_, i) => {
          const cellRevealed = revealedCells[i]
          return (
            <div
              key={i}
              className="relative aspect-square bg-white rounded-2xl border-2 border-gold-400 overflow-hidden shadow-sm"
            >
              {/* Prize reveal layer */}
              <div className="absolute inset-0 flex items-center justify-center p-2">
                {!committed ? (
                  <div className="text-center text-muted-foreground">
                    <p className="text-xl">🎁</p>
                  </div>
                ) : (
                  <div
                    className={`w-full h-full rounded-xl flex items-center justify-center text-center transition-all duration-500 ${
                      cellRevealed
                        ? 'bg-gradient-to-br from-gold-400 to-amber-500 text-white scale-105'
                        : 'bg-cream-100'
                    }`}
                  >
                    <p className="text-3xl">{prizeIcon}</p>
                  </div>
                )}
              </div>

              {/* Canvas scratch layer */}
              {!cellRevealed && canScratch && (
                <canvas
                  ref={(el) => initCanvas(i, el)}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                  onMouseDown={(e) => handleStart(i, e)}
                  onMouseUp={() => handleEnd(i)}
                  onMouseLeave={() => handleEnd(i)}
                  onMouseMove={(e) => scratchAt(i, e)}
                  onTouchStart={(e) => handleStart(i, e)}
                  onTouchEnd={() => handleEnd(i)}
                  onTouchMove={(e) => scratchAt(i, e)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Aggregate progress bar */}
      {committed && !allRevealed && (
        <div className="mb-4">
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full"
              animate={{
                width: `${Math.min(
                  (progressPerCell.reduce((a, b) => a + b, 0) / CELL_COUNT) * 100 / REVEAL_THRESHOLD,
                  100,
                )}%`,
              }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            已揭曉 {revealedCells.filter(Boolean).length} / {CELL_COUNT} 格
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
      {allRevealed && result && (
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
