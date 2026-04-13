'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Gift, X } from 'lucide-react'

interface Prize {
  label: string
  value: number
  type: 'points' | 'credit'
  color: string
  probability: number
}

const PRIZES: Prize[] = [
  { label: '10 點', value: 10, type: 'points', color: '#C19A5B', probability: 30 },
  { label: '20 點', value: 20, type: 'points', color: '#E2C89A', probability: 25 },
  { label: '50 點', value: 50, type: 'points', color: '#D4AF77', probability: 15 },
  { label: 'NT$10', value: 10, type: 'credit', color: '#A8824A', probability: 10 },
  { label: '100 點', value: 100, type: 'points', color: '#856639', probability: 8 },
  { label: 'NT$50', value: 50, type: 'credit', color: '#C19A5B', probability: 5 },
  { label: 'NT$100', value: 100, type: 'credit', color: '#E2C89A', probability: 4 },
  { label: '再來一次', value: 0, type: 'points', color: '#D4AF77', probability: 3 },
]

interface SpinWheelProps {
  open: boolean
  onClose: () => void
  remainingSpins?: number
}

export function SpinWheel({ open, onClose, remainingSpins = 1 }: SpinWheelProps) {
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<Prize | null>(null)
  const [spinsLeft, setSpinsLeft] = useState(remainingSpins)
  const wheelRef = useRef<HTMLDivElement>(null)

  const segmentAngle = 360 / PRIZES.length

  const spin = () => {
    if (spinning || spinsLeft <= 0) return
    setSpinning(true)
    setResult(null)

    // Weighted random selection
    const totalWeight = PRIZES.reduce((s, p) => s + p.probability, 0)
    let rand = Math.random() * totalWeight
    let selectedIndex = 0
    for (let i = 0; i < PRIZES.length; i++) {
      rand -= PRIZES[i].probability
      if (rand <= 0) { selectedIndex = i; break }
    }

    // Calculate rotation to land on selected
    const targetAngle = 360 - (selectedIndex * segmentAngle + segmentAngle / 2)
    const fullSpins = 5 + Math.floor(Math.random() * 3) // 5-7 full rotations
    const newRotation = rotation + fullSpins * 360 + targetAngle - (rotation % 360)

    setRotation(newRotation)

    setTimeout(() => {
      setSpinning(false)
      setResult(PRIZES[selectedIndex])
      setSpinsLeft((s) => s - 1)

      // In production: call Server Action to add points/credit
      console.log('[SpinWheel] Prize:', PRIZES[selectedIndex])
    }, 4000)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200">
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-1">LUCKY SPIN</p>
          <h2 className="text-xl font-serif">幸運轉盤</h2>
          <p className="text-xs text-muted-foreground mt-1">
            剩餘 {spinsLeft} 次抽獎機會
          </p>
        </div>

        {/* Wheel */}
        <div className="relative w-64 h-64 mx-auto mb-6">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-gold-500" />

          <motion.div
            ref={wheelRef}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.17, 0.67, 0.12, 0.99] }}
            className="w-full h-full rounded-full border-4 border-gold-500 overflow-hidden relative"
            style={{ transformOrigin: 'center center' }}
          >
            {PRIZES.map((prize, i) => {
              const angle = i * segmentAngle
              return (
                <div
                  key={i}
                  className="absolute w-full h-full"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.tan((segmentAngle * Math.PI) / 360)}% 0%)`,
                  }}
                >
                  <div
                    className="w-full h-full flex items-start justify-center pt-6"
                    style={{ backgroundColor: prize.color + '30' }}
                  >
                    <span
                      className="text-[10px] font-medium"
                      style={{ transform: `rotate(${segmentAngle / 2}deg)`, color: prize.color }}
                    >
                      {prize.label}
                    </span>
                  </div>
                </div>
              )
            })}
            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white border-2 border-gold-500 flex items-center justify-center shadow-lg">
              <Gift size={20} className="text-gold-500" />
            </div>
          </motion.div>
        </div>

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4 p-4 bg-gold-500/10 rounded-xl"
          >
            <p className="text-sm font-medium">
              恭喜獲得 <span className="text-gold-600">{result.label}</span>
              {result.type === 'credit' ? ' 購物金' : ' 會員點數'}！
            </p>
          </motion.div>
        )}

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning || spinsLeft <= 0}
          className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {spinning ? '抽獎中...' : spinsLeft <= 0 ? '今日抽獎次數已用完' : '開始抽獎'}
        </button>
      </motion.div>
    </div>
  )
}
