'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, AlertCircle, Loader2 } from 'lucide-react'

interface ScratchCardProps {
  open: boolean
  onClose: () => void
  /** 刮完後回傳實際獲得點數（0 = 非點數獎或 daily_limit），供外層 refresh */
  onComplete?: (points: number) => void
}

type GameStatus = 'idle' | 'scratching' | 'submitting' | 'done' | 'limit' | 'error'

interface PrizeResult {
  prize: string
  type: string
  amount: number
}

export function ScratchCard({ open, onClose, onComplete }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const hasSubmitted = useRef(false)

  const [status, setStatus] = useState<GameStatus>('idle')
  const [result, setResult] = useState<PrizeResult | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Reset on open
  useEffect(() => {
    if (!open) return
    hasSubmitted.current = false
    setStatus('idle')
    setResult(null)
    setErrorMsg('')

    // Check daily status
    fetch('/api/games', { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { success: boolean; data?: { dailyStatus?: Record<string, { canPlay: boolean; remainingPlays: number }> } }) => {
        if (!body.success) return
        const sc = body.data?.dailyStatus?.scratch_card
        if (!sc) return
        if (!sc.canPlay) {
          setStatus('limit')
        } else {
          setRemaining(sc.remainingPlays)
        }
      })
      .catch(() => { /* non-fatal */ })
  }, [open])

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#D4B896'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#8B6F47'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('用手指或滑鼠刮開', canvas.width / 2, canvas.height / 2 - 8)
    ctx.font = '11px sans-serif'
    ctx.fillText('SCRATCH TO WIN', canvas.width / 2, canvas.height / 2 + 12)
  }, [])

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas || status !== 'idle' || hasSubmitted.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 22, 0, Math.PI * 2)
    ctx.fill()

    // Check revealed %
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++
    }
    const pct = transparent / (imageData.data.length / 4)
    if (pct > 0.5 && !hasSubmitted.current) {
      hasSubmitted.current = true
      submitPlay()
    }
  }

  async function submitPlay() {
    setStatus('submitting')
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'play', gameType: 'scratch_card' }),
      })
      const body = (await res.json()) as {
        success: boolean
        error?: string
        data?: { prize: PrizeResult }
      }
      if (!body.success) {
        if (body.error?.includes('上限')) {
          setStatus('limit')
        } else {
          setErrorMsg(body.error ?? '發生錯誤，請稍後再試')
          setStatus('error')
        }
        return
      }
      const prize = body.data?.prize ?? { prize: '謝謝參與', type: 'none', amount: 0 }
      setResult(prize)
      setStatus('done')
      onComplete?.(prize.type === 'points' ? prize.amount : 0)
    } catch {
      setErrorMsg('網路錯誤，請稍後再試')
      setStatus('error')
    }
  }

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  if (!open) return null

  const prizeLabel = result
    ? result.type === 'points'
      ? `${result.amount} 點`
      : result.type === 'store_credit'
      ? `NT$${result.amount} 購物金`
      : result.prize
    : ''

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={status === 'done' || status === 'limit' || status === 'error' ? onClose : undefined}
        aria-hidden="true"
      />

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        className="relative bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl z-10"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="text-center mb-5">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-1">SCRATCH & WIN</p>
          <h2 className="text-xl font-serif">今日刮刮樂</h2>
          {remaining !== null && status === 'idle' && (
            <p className="text-xs text-muted-foreground mt-1">今日剩餘 {remaining} 次</p>
          )}
        </div>

        {/* Daily limit */}
        {status === 'limit' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle size={36} className="text-amber-400" />
            <p className="text-sm font-medium">今日刮刮樂次數已用完</p>
            <p className="text-xs text-muted-foreground">明天再來挑戰吧！</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-full bg-foreground text-cream-50 text-sm hover:bg-foreground/90 transition-colors"
            >
              關閉
            </button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium">{errorMsg}</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-full bg-foreground text-cream-50 text-sm"
            >
              關閉
            </button>
          </div>
        )}

        {/* Scratch card (idle / submitting / done) */}
        {(status === 'idle' || status === 'submitting' || status === 'done') && (
          <>
            {/* Card area */}
            <div className="relative w-full rounded-2xl overflow-hidden border-2 border-gold-500/30 mb-5 aspect-[3/2]">
              {/* Prize underneath */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gold-500/10 to-cream-100">
                {status === 'submitting' ? (
                  <Loader2 size={32} className="text-gold-500 animate-spin" />
                ) : status === 'done' && result ? (
                  <>
                    <Sparkles size={28} className="text-gold-500 mb-2" />
                    <p className="text-2xl font-serif text-gold-600">{prizeLabel}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.type === 'points' ? '會員點數' : result.type === 'store_credit' ? '購物金' : '獎勵'}
                    </p>
                  </>
                ) : (
                  <>
                    <Sparkles size={28} className="text-gold-500/30 mb-2" />
                    <p className="text-sm text-gold-500/30">刮開查看獎勵</p>
                  </>
                )}
              </div>

              {/* Scratch overlay — hidden after done */}
              {status !== 'done' && (
                <canvas
                  ref={initCanvas}
                  width={300}
                  height={200}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                  style={{ opacity: status === 'submitting' ? 0 : 1, transition: 'opacity 0.3s' }}
                  onMouseDown={() => { isDrawing.current = true }}
                  onMouseUp={() => { isDrawing.current = false }}
                  onMouseLeave={() => { isDrawing.current = false }}
                  onMouseMove={(e) => { if (isDrawing.current) scratch(...Object.values(getPos(e)) as [number, number]) }}
                  onTouchStart={() => { isDrawing.current = true }}
                  onTouchEnd={() => { isDrawing.current = false }}
                  onTouchMove={(e) => { e.preventDefault(); if (isDrawing.current) scratch(...Object.values(getPos(e)) as [number, number]) }}
                />
              )}
            </div>

            {/* Result message */}
            <AnimatePresence>
              {status === 'done' && result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-3"
                >
                  <p className="text-sm font-medium">
                    {result.amount > 0
                      ? `🎉 恭喜獲得 ${prizeLabel}！`
                      : '😊 謝謝參與，明天繼續加油！'}
                  </p>
                  {result.amount > 0 && (
                    <p className="text-[10px] text-muted-foreground">獎勵已自動存入您的帳戶</p>
                  )}
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-full bg-foreground text-cream-50 text-sm hover:bg-foreground/90 transition-colors"
                  >
                    完成
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {status === 'idle' && (
              <p className="text-center text-xs text-muted-foreground">刮開灰色區域查看今日獎勵</p>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
