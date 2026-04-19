'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

/**
 * 轉盤小遊戲 — 接通後端版本
 * ────────────────────────
 * 原本是純 client stub：hardcoded `useState(3)` 的次數、前端 `Math.random()` 決獎、
 * 沒打 /api/games，導致：
 *   (a) 進出頁面次數 reset（沒持久化）
 *   (b) 點數沒扣 / 獎品沒入帳（沒 record）
 *   (c) 寶物箱沒建（MiniGameRecords 沒建 → afterChange hook 沒觸發）
 *
 * 本版：
 *   - 掛載時 GET /api/games 取得真實 dailyStatus + prizeTable（從後端 GAME_CONFIGS
 *     同步過來，wheel 的 8 片扇區改用後端獎項名）
 *   - 按轉盤 POST /api/games { action:'play', gameType:'spin_wheel' } — 後端 drawPrize
 *     決結果 + 扣點 + 建 record；client 只用回傳結果找對應扇區 index 做動畫
 *   - 動畫結束後重抓 dailyStatus
 *   - 錯誤態：未登入 / 點數不足 / 今日已達上限 → 顯示對應訊息，禁止按鈕
 */

interface Props { settings: Record<string, unknown> }

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

const POINTS_COST = 50
// 比對後端 GAME_CONFIGS.spin_wheel.prizeTable 順序（當 /api/games 尚未回傳時 fallback 用）
const FALLBACK_PRIZES: PrizeEntry[] = [
  { prize: '10 點數', type: 'points', amount: 10 },
  { prize: '20 點數', type: 'points', amount: 20 },
  { prize: '50 點數', type: 'points', amount: 50 },
  { prize: '100 點數', type: 'points', amount: 100 },
  { prize: 'NT$10 購物金', type: 'credit', amount: 10 },
  { prize: 'NT$50 購物金', type: 'credit', amount: 50 },
  { prize: '95 折優惠券', type: 'coupon', amount: 5 },
  { prize: '9 折優惠券', type: 'coupon', amount: 10 },
]

const SLICE_COLORS = [
  { bg: '#C19A5B', fg: '#fff' },
  { bg: '#F8F1E9', fg: '#8a6a3a' },
  { bg: '#E8A87C', fg: '#fff' },
  { bg: '#D4A574', fg: '#fff' },
  { bg: '#F8F1E9', fg: '#8a6a3a' },
  { bg: '#B8860B', fg: '#fff' },
  { bg: '#C19A5B', fg: '#fff' },
  { bg: '#F8F1E9', fg: '#8a6a3a' },
]

export function SpinWheelGame({ settings }: Props) {
  void settings

  const [prizes, setPrizes] = useState<PrizeEntry[]>(FALLBACK_PRIZES)
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null)
  const [authError, setAuthError] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)

  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ prize: string; type: string; amount: number; pointsSpent: number } | null>(null)
  const [rotation, setRotation] = useState(0)

  const sliceAngle = prizes.length > 0 ? 360 / prizes.length : 45

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
      const spinCfg = json.data?.configs?.spin_wheel
      if (spinCfg?.prizeTable && spinCfg.prizeTable.length >= 3) {
        setPrizes(spinCfg.prizeTable)
      }
      if (json.data?.dailyStatus?.spin_wheel) {
        setDailyStatus(json.data.dailyStatus.spin_wheel)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '載入失敗')
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleSpin = useCallback(async () => {
    if (spinning) return
    if (!dailyStatus?.canPlay) return
    setPlayError(null)
    setResult(null)

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play', gameType: 'spin_wheel' }),
      })
      const json = (await res.json()) as {
        success: boolean
        error?: string
        data?: PrizeResp
      }
      if (!res.ok || !json.success || !json.data) {
        setPlayError(json.error || `遊戲失敗 (HTTP ${res.status})`)
        // 次數上限 / 點數不足 → 重抓狀態讓 UI 對齊
        fetchStatus()
        return
      }

      const resp = json.data
      const idx = prizes.findIndex(
        (p) => p.type === resp.prize.type && p.amount === resp.prize.amount,
      )
      // 後端獎項在 client table 找不到時（理論上不該發生）→ 隨機 slice
      const winIndex = idx >= 0 ? idx : Math.floor(Math.random() * prizes.length)

      setSpinning(true)
      const sliceMidAngle = winIndex * sliceAngle + sliceAngle / 2
      const stopAngle = ((360 - sliceMidAngle) % 360 + 360) % 360
      const spins = 5 + Math.floor(Math.random() * 3)
      setRotation((prev) => {
        const base = Math.ceil(prev / 360) * 360
        return base + spins * 360 + stopAngle
      })

      setTimeout(() => {
        setSpinning(false)
        setResult({
          prize: resp.prize.prize,
          type: resp.prize.type,
          amount: resp.prize.amount,
          pointsSpent: resp.pointsSpent,
        })
        fetchStatus() // 重抓 remaining + 最新 points
      }, 4500)
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : '網路錯誤，請稍後再試')
    }
  }, [spinning, dailyStatus, prizes, sliceAngle, fetchStatus])

  // ── 頭部狀態列 ──
  const remaining = dailyStatus?.remaining ?? 0
  const freePlaysLeft = dailyStatus?.freePlaysLeft ?? 0
  const requiresPoints = dailyStatus?.requiresPoints ?? false

  const disabled = spinning || !dailyStatus?.canPlay || authError

  // ── 未登入 ──
  if (authError) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-lg mb-4">請先登入以開始遊戲</p>
        <a
          href="/login?redirect=/games/spin-wheel"
          className="inline-block px-6 py-2.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
        >
          前往登入
        </a>
      </div>
    )
  }

  // ── 載入錯誤 ──
  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
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

  return (
    <div className="max-w-md mx-auto text-center">
      <div className="flex flex-col items-center gap-1 mb-6">
        <p className="text-sm text-muted-foreground">
          剩餘次數：<span className="text-gold-600 font-bold text-base">{remaining}</span>
          <span className="text-xs text-muted-foreground ml-2">
            ({freePlaysLeft > 0 ? `免費 ${freePlaysLeft}` : `每次消耗 ${POINTS_COST} 點`})
          </span>
        </p>
        {requiresPoints && freePlaysLeft === 0 && remaining > 0 && (
          <p className="text-xs text-amber-600">
            免費次數用完，每次消耗 {POINTS_COST} 點
          </p>
        )}
      </div>

      <div className="relative w-[300px] h-[300px] mx-auto mb-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
          <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-red-500 drop-shadow-md" />
        </div>

        <div className="absolute inset-0 rounded-full border-[6px] border-gold-400 shadow-xl" />

        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 4.5, ease: [0.2, 0.8, 0.3, 1] }}
          className="w-full h-full"
          style={{ transformOrigin: 'center center' }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-sm">
            {prizes.map((prize, i) => {
              const startDeg = i * sliceAngle
              const endDeg = (i + 1) * sliceAngle
              const startRad = ((startDeg - 90) * Math.PI) / 180
              const endRad = ((endDeg - 90) * Math.PI) / 180
              const x1 = 100 + 97 * Math.cos(startRad)
              const y1 = 100 + 97 * Math.sin(startRad)
              const x2 = 100 + 97 * Math.cos(endRad)
              const y2 = 100 + 97 * Math.sin(endRad)
              const largeArc = sliceAngle > 180 ? 1 : 0

              const midDeg = startDeg + sliceAngle / 2
              const midRad = ((midDeg - 90) * Math.PI) / 180
              const textR = 62
              const textX = 100 + textR * Math.cos(midRad)
              const textY = 100 + textR * Math.sin(midRad)

              const color = SLICE_COLORS[i % SLICE_COLORS.length]

              return (
                <g key={i}>
                  <path
                    d={`M100,100 L${x1},${y1} A97,97 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={color.bg}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill={color.fg}
                    fontSize="6.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midDeg}, ${textX}, ${textY})`}
                  >
                    {prize.prize}
                  </text>
                </g>
              )
            })}
            <circle cx="100" cy="100" r="20" fill="#2C2C2C" stroke="#C19A5B" strokeWidth="2" />
            <text
              x="100"
              y="100"
              fill="#C19A5B"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ letterSpacing: '0.5px' }}
            >
              CKMU
            </text>
          </svg>
        </motion.div>
      </div>

      <button
        onClick={handleSpin}
        disabled={disabled}
        className="px-10 py-3.5 bg-gradient-to-r from-gold-500 to-amber-600 text-white rounded-full text-lg font-serif tracking-wider hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {spinning
          ? '✨ 轉動中...'
          : !dailyStatus
            ? '載入中...'
            : !dailyStatus.canPlay
              ? '今日次數已用完'
              : requiresPoints && freePlaysLeft === 0
                ? `🎡 消耗 ${POINTS_COST} 點開始`
                : '🎡 開始轉盤'}
      </button>

      {playError && (
        <p className="mt-3 text-sm text-rose-600">{playError}</p>
      )}

      {result && !spinning && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mt-6 p-5 bg-gold-500/10 rounded-2xl border border-gold-500/20"
        >
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-serif text-xl font-bold">{result.prize}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {result.type === 'points' && `已加入點數（+${result.amount}）`}
            {result.type === 'credit' && `已加入購物金（+NT$${result.amount}）`}
            {result.type === 'coupon' && '已進寶物箱，可於「我的寶物箱」查詢'}
            {result.type === 'badge' && '已取得徽章'}
            {result.pointsSpent > 0 && (
              <span className="block mt-1 text-amber-600">
                （扣 {result.pointsSpent} 點）
              </span>
            )}
          </p>
        </motion.div>
      )}
    </div>
  )
}
