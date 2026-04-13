'use client'

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'

interface ScratchPrize {
  label: string
  value: number
  type: 'points' | 'credit'
}

const POSSIBLE_PRIZES: ScratchPrize[] = [
  { label: '5 點', value: 5, type: 'points' },
  { label: '10 點', value: 10, type: 'points' },
  { label: '20 點', value: 20, type: 'points' },
  { label: '50 點', value: 50, type: 'points' },
  { label: 'NT$5', value: 5, type: 'credit' },
  { label: 'NT$10', value: 10, type: 'credit' },
  { label: 'NT$20', value: 20, type: 'credit' },
]

interface ScratchCardProps {
  open: boolean
  onClose: () => void
}

export function ScratchCard({ open, onClose }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [prize] = useState<ScratchPrize>(
    () => POSSIBLE_PRIZES[Math.floor(Math.random() * POSSIBLE_PRIZES.length)],
  )
  const isDrawing = useRef(false)
  const scratchPercentage = useRef(0)

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#E8D9C8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Add text
    ctx.fillStyle = '#C19A5B'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('用手指或滑鼠刮開', canvas.width / 2, canvas.height / 2)
  }, [])

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 20, 0, Math.PI * 2)
    ctx.fill()

    // Check reveal percentage
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++
    }
    scratchPercentage.current = transparent / (imageData.data.length / 4)
    if (scratchPercentage.current > 0.5 && !revealed) {
      setRevealed(true)
      console.log('[ScratchCard] Prize:', prize)
    }
  }

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleStart = () => { isDrawing.current = true }
  const handleEnd = () => { isDrawing.current = false }
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    const { x, y } = getPos(e)
    scratch(x, y)
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
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200">
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-1">SCRATCH & WIN</p>
          <h2 className="text-xl font-serif">刮刮樂</h2>
          <p className="text-xs text-muted-foreground mt-1">刮開灰色區域查看你的獎勵</p>
        </div>

        {/* Card */}
        <div className="relative w-full aspect-[3/2] rounded-2xl overflow-hidden border-2 border-gold-500/30 mx-auto mb-6">
          {/* Prize (underneath) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gold-500/10 to-cream-100">
            <Sparkles size={32} className="text-gold-500 mb-2" />
            <p className="text-2xl font-serif text-gold-600">{prize.label}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {prize.type === 'credit' ? '購物金' : '會員點數'}
            </p>
          </div>

          {/* Scratch overlay */}
          <canvas
            ref={initCanvas}
            width={300}
            height={200}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onMouseMove={handleMove}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            onTouchMove={handleMove}
          />
        </div>

        {/* Result */}
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-4 bg-gold-500/10 rounded-xl"
          >
            <p className="text-sm font-medium">
              恭喜獲得 <span className="text-gold-600">{prize.label}</span>
              {prize.type === 'credit' ? ' 購物金' : ' 會員點數'}！
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              獎勵已自動存入您的帳戶
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
