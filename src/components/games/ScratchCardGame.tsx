'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props { settings: Record<string, unknown> }

/**
 * 刮刮樂規則：
 * - 3 格隨機產生獎品
 * - 三格相同 → 中大獎（該獎品 ×3）
 * - 兩格相同 → 中獎（該獎品 ×1）
 * - 三格都不同 → 謝謝參與
 */

const PRIZE_POOL = ['50 點', '100 點', '95折券', '免運券', '200 點']
const EMOJI_MAP: Record<string, string> = {
  '50 點': '🎯',
  '100 點': '💎',
  '95折券': '🏷️',
  '免運券': '🚚',
  '200 點': '👑',
}

function getResult(cells: string[]): { type: 'jackpot' | 'win' | 'lose'; prize: string; message: string } {
  // Check if all three match
  if (cells[0] === cells[1] && cells[1] === cells[2]) {
    return { type: 'jackpot', prize: cells[0], message: `🎊 超級大獎！三連中 ${cells[0]} ×3！` }
  }
  // Check for two matching
  if (cells[0] === cells[1]) return { type: 'win', prize: cells[0], message: `🎉 恭喜中獎！獲得 ${cells[0]}` }
  if (cells[0] === cells[2]) return { type: 'win', prize: cells[0], message: `🎉 恭喜中獎！獲得 ${cells[0]}` }
  if (cells[1] === cells[2]) return { type: 'win', prize: cells[1], message: `🎉 恭喜中獎！獲得 ${cells[1]}` }
  // All different
  return { type: 'lose', prize: '', message: '😅 差一點！三格都不同，下次再試試！' }
}

export function ScratchCardGame({}: Props) {
  const [revealed, setRevealed] = useState(false)
  const [scratchProgress, setScratchProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const totalPixels = useRef(0)
  const [cells, setCells] = useState<string[]>(['50 點', '100 點', '95折券'])
  const [mounted, setMounted] = useState(false)
  const result = getResult(cells)

  useEffect(() => {
    if (!mounted) {
      setCells(Array.from({ length: 3 }, () => PRIZE_POOL[Math.floor(Math.random() * PRIZE_POOL.length)]))
      setMounted(true)
    }
  }, [mounted])

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    canvasRef.current = canvas

    // Use actual display size for accurate pixel tracking
    const dpr = 1 // Keep 1:1 for simpler scratch tracking
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Golden scratch surface
    ctx.fillStyle = '#C19A5B'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Pattern text
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = `bold ${14 * dpr}px serif`
    for (let y = 20 * dpr; y < canvas.height; y += 30 * dpr) {
      for (let x = 0; x < canvas.width; x += 80 * dpr) {
        ctx.fillText('CKMU', x, y)
      }
    }

    // Center prompt
    ctx.font = `bold ${16 * dpr}px serif`
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.textAlign = 'center'
    ctx.fillText('用手指刮開這裡 ↓', canvas.width / 2, canvas.height / 2)

    totalPixels.current = canvas.width * canvas.height
  }, [])

  // Resize handler
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

    if (progress >= 0.45) {
      setRevealed(true)
    }
  }, [revealed])

  const scratch = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || revealed) return
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
  }, [revealed, checkProgress])

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawing.current = true
  }, [])

  const handleEnd = useCallback(() => {
    isDrawing.current = false
    checkProgress()
  }, [checkProgress])

  return (
    <div className="max-w-sm mx-auto text-center">
      {/* 遊戲規則說明 */}
      <div className="mb-6 p-4 bg-cream-100 rounded-xl border border-cream-200 text-left">
        <p className="text-sm font-bold text-gold-600 mb-2">🎰 刮刮樂規則</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• 刮開金色區域，揭曉 3 格獎品</li>
          <li>• <span className="text-gold-600 font-medium">三格相同</span> → 超級大獎（獎品 ×3）🎊</li>
          <li>• <span className="text-gold-600 font-medium">兩格相同</span> → 中獎（獲得該獎品）🎉</li>
          <li>• <span className="text-muted-foreground">三格都不同</span> → 謝謝參與，下次加油 💪</li>
        </ul>
      </div>

      <p className="text-sm text-muted-foreground mb-4">用手指或滑鼠刮開金色區域（刮滿 50% 自動揭曉）</p>

      {/* Scratch area */}
      <div className="relative w-full aspect-[3/2] bg-white rounded-2xl border-2 border-gold-400 overflow-hidden mb-6 shadow-lg">
        {/* Prize layer — always visible underneath */}
        <div className="absolute inset-0 flex items-center justify-center gap-4 p-4">
          {cells.map((cell, i) => (
            <div
              key={i}
              className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-center transition-all duration-500 ${
                revealed && result.type === 'jackpot'
                  ? 'bg-gradient-to-br from-gold-400 to-amber-500 text-white scale-105 shadow-lg'
                  : revealed && result.type === 'win' && cell === result.prize
                    ? 'bg-gold-100 border-2 border-gold-400 scale-105'
                    : 'bg-cream-100 border border-cream-200'
              }`}
            >
              <div>
                <p className="text-2xl mb-1">{EMOJI_MAP[cell] || '🎁'}</p>
                <p className="text-xs font-medium">{cell}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Canvas scratch layer */}
        {!revealed && (
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
      {!revealed && (
        <div className="mb-6">
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full"
              animate={{ width: `${Math.min(scratchProgress * 100 / 0.5, 100)}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            刮開進度：{Math.min(Math.round(scratchProgress * 100 / 0.5), 100)}%
          </p>
        </div>
      )}

      {/* Result */}
      {revealed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-5 rounded-2xl border ${
            result.type === 'jackpot'
              ? 'bg-gradient-to-br from-gold-500/20 to-amber-500/10 border-gold-500/40'
              : result.type === 'win'
                ? 'bg-gold-500/10 border-gold-500/30'
                : 'bg-cream-50 border-cream-200'
          }`}
        >
          <p className="font-serif text-lg mb-2">{result.message}</p>
          {result.type === 'jackpot' && (
            <p className="text-xs text-gold-600 mb-2">超級幸運！三格完全相同！</p>
          )}
          {result.type === 'win' && (
            <p className="text-xs text-muted-foreground mb-2">兩格相同即中獎，獎勵已自動發放</p>
          )}
          {result.type === 'lose' && (
            <p className="text-xs text-muted-foreground mb-2">
              您刮出的是：{cells.map((c, i) => (i > 0 ? '、' : '') + c).join('')}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-6 py-2 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
          >
            再刮一張
          </button>
        </motion.div>
      )}
    </div>
  )
}
