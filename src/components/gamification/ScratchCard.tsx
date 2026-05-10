'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onComplete?: () => void
}

type DailyStatus = { remaining: number; canPlay: boolean; freePlaysLeft: number; requiresPoints: boolean }
type PlayResult = {
  prize: { prize: string; type: string; amount: number }
  pointsSpent: number
  cells?: string[]
  won?: boolean
}
type Phase = 'loading' | 'auth' | 'limit' | 'ready' | 'submitting' | 'done' | 'error'

export function ScratchCard({ open, onClose, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawing = useRef(false)
  const submitted = useRef(false)

  const [phase, setPhase] = useState<Phase>('loading')
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null)
  const [result, setResult] = useState<PlayResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/games', { credentials: 'include' })
      if (res.status === 401) { setPhase('auth'); return }
      if (!res.ok) { setErrorMsg(`載入失敗（${res.status}）`); setPhase('error'); return }
      const json = await res.json() as {
        success: boolean
        data?: { dailyStatus?: Record<string, DailyStatus> }
      }
      const ds = json.data?.dailyStatus?.scratch_card
      if (ds) {
        setDailyStatus(ds)
        setPhase(ds.canPlay ? 'ready' : 'limit')
      } else {
        setPhase('ready')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '載入失敗')
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    submitted.current = false
    setResult(null)
    setErrorMsg(null)
    fetchStatus()
  }, [open, fetchStatus])

  const handleScratchThreshold = useCallback(async () => {
    if (submitted.current) return
    submitted.current = true
    setPhase('submitting')
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play', gameType: 'scratch_card' }),
      })
      const json = await res.json() as { success: boolean; error?: string; data?: PlayResult }
      if (!res.ok || !json.success || !json.data) {
        setErrorMsg(json.error ?? `遊戲失敗（${res.status}）`)
        setPhase('error')
        return
      }
      setResult(json.data)
      setPhase('done')
      onComplete?.()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '網路錯誤，請稍後再試')
      setPhase('error')
    }
  }, [onComplete])

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#E8D9C8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#C19A5B'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('用手指或滑鼠刮開', canvas.width / 2, canvas.height / 2)
  }, [])

  const doScratch = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'ready') return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 20 * Math.min(scaleX, scaleY), 0, Math.PI * 2)
    ctx.fill()
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let transparent = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++
    if (transparent / (data.length / 4) > 0.5) handleScratchThreshold()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl z-10"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200"
          aria-label="關閉"
        >
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-1">SCRATCH & WIN</p>
          <h2 className="text-xl font-serif">刮刮樂</h2>
          {dailyStatus && phase !== 'auth' && (
            <p className="text-xs text-muted-foreground mt-1">
              今日剩餘 <span className="text-gold-600 font-bold">{dailyStatus.remaining}</span> 次
            </p>
          )}
        </div>

        {phase === 'loading' && (
          <div className="text-center py-10 text-sm text-muted-foreground">載入中⋯</div>
        )}

        {phase === 'auth' && (
          <div className="text-center py-8">
            <p className="text-sm mb-4">請先登入以開始遊戲</p>
            <a
              href="/login?redirect=/account/points"
              className="inline-block px-6 py-2.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
            >
              前往登入
            </a>
          </div>
        )}

        {phase === 'limit' && (
          <div className="text-center py-8">
            <p className="text-3xl mb-3">🎫</p>
            <p className="text-sm font-medium mb-1">今日次數已用完</p>
            <p className="text-xs text-muted-foreground">明天再來挑戰吧！</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="text-center py-8">
            <p className="text-sm text-rose-600 mb-4">{errorMsg ?? '發生錯誤'}</p>
            <button
              onClick={fetchStatus}
              className="px-5 py-2 border border-cream-200 rounded-full text-sm hover:bg-cream-50"
            >
              重試
            </button>
          </div>
        )}

        {(phase === 'ready' || phase === 'submitting' || phase === 'done') && (
          <>
            <div className="relative w-full aspect-[3/2] rounded-2xl overflow-hidden border-2 border-gold-500/30 mx-auto mb-6">
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gold-500/10 to-cream-100">
                {phase === 'submitting' ? (
                  <p className="text-sm text-muted-foreground">計算獎品⋯</p>
                ) : result ? (
                  <>
                    <Sparkles size={32} className={result.won === false ? 'text-cream-300 mb-2' : 'text-gold-500 mb-2'} />
                    <p className={`text-2xl font-serif ${result.won === false ? 'text-muted-foreground' : 'text-gold-600'}`}>
                      {result.won === false ? '銘謝惠顧' : result.prize.prize}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.won === false
                        ? '差一點 — 再接再厲'
                        : result.prize.type === 'credit' ? '購物金'
                          : result.prize.type === 'coupon' ? '優惠券'
                          : result.prize.type === 'badge' ? '專屬徽章'
                          : '會員點數'}
                    </p>
                  </>
                ) : (
                  <>
                    <Sparkles size={32} className="text-gold-500/30 mb-2" />
                    <p className="text-sm text-muted-foreground">刮開查看獎品</p>
                  </>
                )}
              </div>

              {phase === 'ready' && (
                <canvas
                  ref={initCanvas}
                  width={300}
                  height={200}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                  onMouseDown={() => { isDrawing.current = true }}
                  onMouseUp={() => { isDrawing.current = false }}
                  onMouseLeave={() => { isDrawing.current = false }}
                  onMouseMove={(e) => { if (isDrawing.current) doScratch(e.clientX, e.clientY) }}
                  onTouchStart={() => { isDrawing.current = true }}
                  onTouchEnd={() => { isDrawing.current = false }}
                  onTouchMove={(e) => { if (isDrawing.current) doScratch(e.touches[0].clientX, e.touches[0].clientY) }}
                />
              )}
            </div>

            {phase === 'done' && result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-center p-4 rounded-xl ${result.won === false ? 'bg-cream-100' : 'bg-gold-500/10'}`}
              >
                <p className="text-sm font-medium">
                  {result.won === false ? (
                    <span className="text-muted-foreground">本次未中獎，明天再試試</span>
                  ) : (
                    <>恭喜獲得 <span className="text-gold-600">{result.prize.prize}</span>！</>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {result.won !== false && result.prize.type === 'points' && `已加入點數（+${result.prize.amount}）`}
                  {result.won !== false && result.prize.type === 'credit' && `已加入購物金（+NT$${result.prize.amount}）`}
                  {result.won !== false && result.prize.type === 'coupon' && '已進寶物箱，可於「我的寶物箱」查詢'}
                  {result.pointsSpent > 0 && (
                    <span className="block mt-1 text-amber-600">（扣 {result.pointsSpent} 點）</span>
                  )}
                </p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
