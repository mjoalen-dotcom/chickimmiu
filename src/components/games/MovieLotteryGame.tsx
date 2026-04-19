'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Ticket, Film, Copy, Check } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

/**
 * 電影票抽獎 — 接通後端版本
 * ──────────────────────────
 * 流程：
 *   - Mount → GET /api/games 取 dailyStatus.movie_lottery（扣點前後對齊）
 *   - 點「抽獎」→ POST /api/games { action:'play', gameType:'movie_lottery' }
 *     → 後端 drawMovieTicket：扣點 + 擲 winRate + 中獎時減票 + 建 record
 *   - 中獎 prizeType='coupon' 觸發 MiniGameRecords afterChange → UserRewards 自動建倉
 *     → 使用者可在 /account/treasure 看到兌換碼
 *   - 未中獎仍扣點、計入 dailyLimit
 *
 * 錯誤態：未登入 / 點數不足 / 今日上限 / 本期無票 → 鎖 button + 顯示訊息
 */

type DailyStatus = {
  played: number
  remaining: number
  canPlay: boolean
  freePlaysLeft: number
  requiresPoints: boolean
}

type DrawResp = {
  won: boolean
  ticketType: string
  couponCode?: string
  pointsSpent: number
  remainingTickets: number
}

export function MovieLotteryGame({ settings }: Props) {
  const pointsCost = Number(settings.pointsCostPerPlay ?? 100)
  const ticketType = (settings.ticketType as string) || '威秀影城 2D 一般廳'
  const initialRemaining = Number(settings.remainingTickets ?? 0)

  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null)
  const [remainingTickets, setRemainingTickets] = useState(initialRemaining)
  const [authError, setAuthError] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)

  const [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<DrawResp | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/games', { credentials: 'include' })
      if (res.status === 401) {
        setAuthError(true)
        return
      }
      if (!res.ok) {
        setLoadError(`無法載入狀態（HTTP ${res.status}）`)
        return
      }
      const json = (await res.json()) as {
        success: boolean
        data?: { dailyStatus?: Record<string, DailyStatus> }
      }
      if (json.success && json.data?.dailyStatus?.movie_lottery) {
        setDailyStatus(json.data.dailyStatus.movie_lottery)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '載入失敗')
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const handleDraw = async () => {
    if (drawing) return
    if (!dailyStatus?.canPlay) return
    if (remainingTickets <= 0) return

    setDrawing(true)
    setPlayError(null)
    setResult(null)
    setCopied(false)

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play', gameType: 'movie_lottery' }),
      })
      const json = (await res.json()) as {
        success: boolean
        data?: DrawResp
        error?: string
      }

      // 動畫 2.5s 後才揭曉（即使 API 秒回）
      await new Promise((r) => setTimeout(r, 2500))

      if (!res.ok || !json.success || !json.data) {
        setPlayError(json.error || '抽獎失敗')
        setDrawing(false)
        // 重拉狀態 — 可能點數/次數被扣
        void fetchStatus()
        return
      }

      setResult(json.data)
      setRemainingTickets(json.data.remainingTickets)
      setDrawing(false)
      void fetchStatus()
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : '網路錯誤')
      setDrawing(false)
    }
  }

  const handleCopy = async () => {
    if (!result?.couponCode) return
    try {
      await navigator.clipboard.writeText(result.couponCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — ignore
    }
  }

  // ── 未登入 ──
  if (authError) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-sm text-muted-foreground mb-6">請先登入才能參加抽獎</p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 bg-foreground text-cream-50 rounded-full text-sm tracking-wide"
        >
          前往登入
        </Link>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  const outOfTickets = remainingTickets <= 0
  const outOfPlays = dailyStatus ? !dailyStatus.canPlay : false
  const btnDisabled = drawing || outOfTickets || outOfPlays

  return (
    <div className="max-w-md mx-auto text-center">
      {/* Info */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">電影票類型</span>
          <span className="font-medium">{ticketType}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">本期剩餘票數</span>
          <span className={`font-medium ${outOfTickets ? 'text-red-500' : 'text-gold-600'}`}>
            {remainingTickets} 張
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">每次消耗</span>
          <span className="font-medium">{pointsCost} 點</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">今日剩餘次數</span>
          <span className="font-medium">
            {dailyStatus ? `${dailyStatus.remaining} 次` : '—'}
          </span>
        </div>
      </div>

      {/* Lottery animation area */}
      <div className="relative w-64 h-64 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {drawing ? (
              <motion.div
                key="drawing"
                animate={{ rotateY: [0, 180, 360, 540, 720] }}
                transition={{ duration: 2.5, ease: 'easeInOut' }}
              >
                <Ticket size={64} className="text-white" />
              </motion.div>
            ) : result?.won ? (
              <motion.div
                key="win"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                className="text-center text-white"
              >
                <p className="text-5xl mb-2">🎬</p>
                <p className="text-lg font-serif">中獎！</p>
              </motion.div>
            ) : result && !result.won ? (
              <motion.div
                key="lose"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center text-white/80"
              >
                <p className="text-4xl mb-2">😢</p>
                <p className="text-sm">差一點點</p>
              </motion.div>
            ) : (
              <motion.div key="idle" className="text-center text-white">
                <Film size={48} className="mx-auto mb-2" />
                <p className="text-sm">點擊下方抽獎</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Draw button */}
      <button
        onClick={handleDraw}
        disabled={btnDisabled}
        className="px-10 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-full text-lg font-serif tracking-wider hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {drawing
          ? '抽獎中...'
          : outOfTickets
            ? '本期已抽完'
            : outOfPlays
              ? '今日次數已用完'
              : `抽獎 (-${pointsCost} 點)`}
      </button>

      {/* Win result */}
      {result?.won && result.couponCode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-gold-500/10 border border-gold-500/30 rounded-2xl p-5 text-left"
        >
          <p className="text-sm text-gold-700 font-medium mb-2">🎉 恭喜中獎！{result.ticketType}</p>
          <p className="text-xs text-muted-foreground mb-3">
            兌換碼已自動存入寶物箱，也可先複製起來保存：
          </p>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gold-500/20 px-3 py-2">
            <code className="flex-1 font-mono text-sm tracking-wider">{result.couponCode}</code>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs text-gold-700 hover:text-gold-800"
            >
              {copied ? (
                <>
                  <Check size={12} /> 已複製
                </>
              ) : (
                <>
                  <Copy size={12} /> 複製
                </>
              )}
            </button>
          </div>
          <Link
            href="/account/treasure"
            className="inline-block mt-3 text-xs text-gold-700 underline"
          >
            前往寶物箱查看 →
          </Link>
        </motion.div>
      )}

      {/* Lose message */}
      {result && !result.won && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-sm text-muted-foreground"
        >
          再試一次吧，幸運之神就在下一次！（扣 {result.pointsSpent} 點）
        </motion.p>
      )}

      {/* Error */}
      {playError && (
        <p className="mt-4 text-sm text-red-500">{playError}</p>
      )}
    </div>
  )
}
