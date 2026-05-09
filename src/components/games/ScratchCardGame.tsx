'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props { settings: Record<string, unknown> }

/**
 * 刮刮樂 — 單張卡片 + 三連線判定
 * ─────────────────────────────────
 * 後端 `/api/games` POST { action:'play', gameType:'scratch_card' } 回
 * `{ prize, cells:[icon1,icon2,icon3], won }`：
 *   - won=true  → cells 三個一致（= prize 對應 icon）= BINGO 中獎
 *   - won=false → cells 兩同一異（差一點）或三全異（完全 miss），prize.type='none'
 *
 * UX：
 *   - 單張大卡片，底層三個 icon 並排，上層 canvas 金色刮層
 *   - 任意位置刮 → 整張畫布通用，刮到 55% 自動全揭曉
 *   - 中獎時三個 icon 同步 scale-up + 金色發光動畫
 *   - 未中時提示「差一點 — 再接再厲」
 *
 * 風險揭露：UI 顯示中獎機率（後續 Phase E 從 GameSettings 拉真實數字）。
 */

const POINTS_COST = 30
const REVEAL_THRESHOLD = 0.55

type DailyStatus = {
  played: number
  remaining: number
  canPlay: boolean
  freePlaysLeft: number
  requiresPoints: boolean
}
type PrizeResp = {
  prize: { prize: string; type: string; amount: number }
  cells?: string[]
  won?: boolean
  pointsSpent: number
}

const PRIZE_TYPE_LABELS: Record<string, string> = {
  points: '會員點數',
  credit: '購物金',
  coupon: '優惠券',
  badge: '專屬徽章',
  none: '銘謝惠顧',
}

export function ScratchCardGame({}: Props) {
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null)
  const [authError, setAuthError] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)

  const [result, setResult] = useState<PrizeResp | null>(null)
  const [progress, setProgress] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [committed, setCommitted] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/games', { credentials: 'include' })
      if (res.status === 401) { setAuthError(true); return }
      if (!res.ok) { setLoadError(`無法載入遊戲狀態（HTTP ${res.status}）`); return }
      const json = (await res.json()) as {
        success: boolean
        data?: { dailyStatus?: Record<string, DailyStatus> }
      }
      setAuthError(false)
      setLoadError(null)
      if (json.data?.dailyStatus?.scratch_card) setDailyStatus(json.data.dailyStatus.scratch_card)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '載入失敗')
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

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

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) { canvasRef.current = null; return }
    canvasRef.current = canvas
    if (canvas.width === 0) {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 金色刮層 + 漸層
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#D4A968')
    gradient.addColorStop(0.5, '#C19A5B')
    gradient.addColorStop(1, '#A8814A')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // CKMU 浮水印 — 對角排列
    ctx.fillStyle = 'rgba(255,255,255,0.13)'
    ctx.font = 'bold 11px serif'
    for (let y = 22; y < canvas.height; y += 28) {
      const offsetX = (Math.floor(y / 28) % 2) * 30
      for (let x = -20 + offsetX; x < canvas.width; x += 70) {
        ctx.fillText('CHIC KIM & MIU', x, y)
      }
    }

    // 中央提示
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = 'bold 18px "Noto Serif TC", serif'
    ctx.fillText('用手指刮開', canvas.width / 2, canvas.height / 2 - 6)
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText('三個圖案相符即中獎', canvas.width / 2, canvas.height / 2 + 18)
  }, [])

  const checkProgress = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || revealed) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let transparent = 0
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] < 128) transparent++
    }
    const total = Math.ceil(data.length / 16)
    const p = transparent / total
    setProgress(p)

    if (p >= REVEAL_THRESHOLD && committed) {
      setRevealed(true)
      // 一鼓作氣清掉整張畫布，露出全部結果
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      fetchStatus()
    }
  }, [revealed, committed, fetchStatus])

  const scratchAt = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || revealed || !committed) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    let cx: number, cy: number
    if ('touches' in e) {
      cx = e.touches[0].clientX
      cy = e.touches[0].clientY
    } else {
      cx = e.clientX
      cy = e.clientY
    }
    const x = (cx - rect.left) * scaleX
    const y = (cy - rect.top) * scaleY
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 24 * scaleX, 0, Math.PI * 2)
    ctx.fill()
    checkProgress()
  }, [revealed, committed, checkProgress])

  const handleStart = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (revealed) return
    if (!committed) {
      const ok = await commitPlay()
      if (!ok) return
    }
    drawingRef.current = true
  }, [revealed, committed, commitPlay])

  const handleEnd = useCallback(() => {
    drawingRef.current = false
    checkProgress()
  }, [checkProgress])

  const remaining = dailyStatus?.remaining ?? 0
  const freePlaysLeft = dailyStatus?.freePlaysLeft ?? 0
  const requiresPoints = dailyStatus?.requiresPoints ?? false
  const canScratch = dailyStatus?.canPlay ?? false

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

  const cells = result?.cells ?? ['🎁', '🎁', '🎁']
  const won = Boolean(result?.won)
  const prize = result?.prize

  return (
    <div className="max-w-md mx-auto text-center px-4">
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
          <li>• 用手指或滑鼠刮開金色區域</li>
          <li>• 刮到 <span className="text-gold-600 font-medium">55%</span> 自動全揭曉</li>
          <li>• 三個圖案相符即中獎，獎品自動入帳</li>
          <li>• <a href="/games/terms" className="underline text-gold-600">查看中獎機率與遊戲規範</a></li>
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

      {/* 單張大卡片 — 底層 3 icon + 上層 canvas 刮層 */}
      <div className="relative w-full aspect-[3/2] rounded-3xl border-4 border-gold-500 bg-white overflow-hidden shadow-2xl mb-4">
        {/* 底層內容 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-cream-50 via-white to-cream-100 p-5">
          <p className="text-[10px] tracking-[0.4em] text-gold-600 mb-1">SCRATCH &amp; WIN</p>
          <p className="text-[9px] text-muted-foreground mb-3">CHIC KIM &amp; MIU 限定</p>

          <div className="grid grid-cols-3 gap-2 w-full max-w-[280px]">
            {cells.map((icon, i) => (
              <motion.div
                key={`${i}-${icon}`}
                initial={{ scale: 1 }}
                animate={revealed && won ? { scale: [1, 1.15, 1.08], rotate: [0, -5, 5, 0] } : {}}
                transition={{ duration: 0.6, delay: i * 0.15, repeat: revealed && won ? Infinity : 0, repeatDelay: 1.5 }}
                className={`aspect-square rounded-2xl flex items-center justify-center text-4xl md:text-5xl border-2 transition-all duration-700 ${
                  revealed && won
                    ? 'bg-gradient-to-br from-amber-200 via-gold-300 to-amber-400 border-gold-500 shadow-lg ring-2 ring-gold-300'
                    : revealed
                      ? 'bg-cream-100 border-cream-200'
                      : 'bg-white/80 border-cream-200'
                }`}
              >
                {icon}
              </motion.div>
            ))}
          </div>

          <AnimatePresence>
            {revealed && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-sm font-medium"
              >
                {won ? (
                  <span className="text-gold-600">🎉 三連線中獎！</span>
                ) : (
                  <span className="text-muted-foreground">差一點 — 再接再厲</span>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* 上層 canvas 刮層 */}
        {!revealed && canScratch && (
          <canvas
            ref={initCanvas}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onMouseMove={scratchAt}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            onTouchMove={scratchAt}
          />
        )}
      </div>

      {/* 進度條 */}
      {committed && !revealed && (
        <div className="mb-4">
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full"
              animate={{ width: `${Math.min((progress / REVEAL_THRESHOLD) * 100, 100)}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            刮開進度 {Math.round((progress / REVEAL_THRESHOLD) * 100)}%
          </p>
        </div>
      )}

      {committing && (
        <p className="text-xs text-muted-foreground mb-3">正在建立遊戲紀錄…</p>
      )}

      {playError && (
        <p className="text-sm text-rose-600 mb-3">{playError}</p>
      )}

      {/* 結果 */}
      {revealed && prize && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-5 rounded-2xl border ${
            won
              ? 'bg-gold-500/10 border-gold-500/30'
              : 'bg-cream-100 border-cream-200'
          }`}
        >
          <p className="font-serif text-xl mb-2">
            {won ? '🎉' : '🍂'} {prize.prize}
          </p>
          {won && (
            <p className="text-xs text-muted-foreground">
              {prize.type === 'points' && `已加入點數（+${prize.amount}）`}
              {prize.type === 'credit' && `已加入購物金（+NT$${prize.amount}）`}
              {prize.type === 'coupon' && '已進寶物箱，可於「我的寶物箱」查詢'}
              {prize.type === 'badge' && '已取得徽章'}
            </p>
          )}
          {!won && (
            <p className="text-xs text-muted-foreground">
              {PRIZE_TYPE_LABELS.none} — 中獎機率公示請見遊戲規範頁
            </p>
          )}
          {result?.pointsSpent && result.pointsSpent > 0 && (
            <p className="text-xs text-amber-600 mt-1">（扣 {result.pointsSpent} 點）</p>
          )}
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
