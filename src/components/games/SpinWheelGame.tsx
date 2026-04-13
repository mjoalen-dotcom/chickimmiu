'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface Props { settings: Record<string, unknown> }

const DEFAULT_PRIZES = [
  { name: '50 點', color: '#C19A5B', textColor: '#fff' },
  { name: '謝謝參與', color: '#F8F1E9', textColor: '#888' },
  { name: '100 點', color: '#E8A87C', textColor: '#fff' },
  { name: '95折券', color: '#D4A574', textColor: '#fff' },
  { name: '謝謝參與', color: '#F8F1E9', textColor: '#888' },
  { name: '200 點', color: '#B8860B', textColor: '#fff' },
  { name: '免運券', color: '#C19A5B', textColor: '#fff' },
  { name: '加倍獎勵', color: '#F8F1E9', textColor: '#888' },
]

export function SpinWheelGame({ settings }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [remaining, setRemaining] = useState(3)

  const prizes = DEFAULT_PRIZES
  const sliceAngle = 360 / prizes.length
  void settings

  const handleSpin = useCallback(() => {
    if (spinning || remaining <= 0) return
    setSpinning(true)
    setResult(null)

    const winIndex = Math.floor(Math.random() * prizes.length)
    // 指針固定在頂部（12 點鐘 = 0°）
    // SVG 扇區 i 的中心角度 = i * sliceAngle + sliceAngle/2（從頂部順時針量）
    // CSS rotate(θ) 將原本在 α° 的點移到 (α+θ)° 的視覺位置
    // 要讓扇區中心 α 對齊指針 0°：α + θ ≡ 0 (mod 360) → θ ≡ -α (mod 360) = 360 - α
    //
    // 重點：rotation 是絕對角度（累計），所以每次要計算「比目前 rotation 更大的」絕對目標
    const sliceMidAngle = winIndex * sliceAngle + sliceAngle / 2
    const stopAngle = ((360 - sliceMidAngle) % 360 + 360) % 360 // 停止時 wheel 的 mod-360 角度
    const spins = 5 + Math.floor(Math.random() * 3) // 5-7 圈

    setRotation((prev) => {
      // 計算比 prev 更大的目標，且 mod 360 === stopAngle
      const base = Math.ceil(prev / 360) * 360 // 下一個完整圈的起點
      return base + spins * 360 + stopAngle
    })

    setTimeout(() => {
      setSpinning(false)
      setResult(prizes[winIndex].name)
      setRemaining((r) => r - 1)
    }, 4500)
  }, [spinning, remaining, prizes, sliceAngle])

  return (
    <div className="max-w-md mx-auto text-center">
      <p className="text-sm text-muted-foreground mb-6">
        剩餘次數：<span className="text-gold-600 font-bold text-base">{remaining}</span>
      </p>

      {/* Wheel Container */}
      <div className="relative w-[300px] h-[300px] mx-auto mb-8">
        {/* Pointer — fixed at top center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
          <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-red-500 drop-shadow-md" />
        </div>

        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-[6px] border-gold-400 shadow-xl" />

        {/* Rotating wheel */}
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

              // Text positioned along the radial axis, reading outward
              const midDeg = startDeg + sliceAngle / 2
              const midRad = ((midDeg - 90) * Math.PI) / 180
              const textR = 62
              const textX = 100 + textR * Math.cos(midRad)
              const textY = 100 + textR * Math.sin(midRad)

              return (
                <g key={i}>
                  <path
                    d={`M100,100 L${x1},${y1} A97,97 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={prize.color}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill={prize.textColor}
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midDeg}, ${textX}, ${textY})`}
                  >
                    {prize.name}
                  </text>
                </g>
              )
            })}
            {/* Center circle */}
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

      {/* Spin button */}
      <button
        onClick={handleSpin}
        disabled={spinning || remaining <= 0}
        className="px-10 py-3.5 bg-gradient-to-r from-gold-500 to-amber-600 text-white rounded-full text-lg font-serif tracking-wider hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {spinning ? '✨ 轉動中...' : remaining <= 0 ? '今日次數已用完' : '🎡 開始轉盤'}
      </button>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mt-6 p-5 bg-gold-500/10 rounded-2xl border border-gold-500/20"
        >
          <p className="text-3xl mb-2">{result === '謝謝參與' || result === '加倍獎勵' ? '😊' : '🎉'}</p>
          <p className="font-serif text-xl font-bold">{result}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {result === '謝謝參與' ? '下次一定中！加油！' : result === '加倍獎勵' ? '下次遊戲獎勵翻倍！' : '恭喜！獎勵已自動發放到您的帳戶'}
          </p>
        </motion.div>
      )}
    </div>
  )
}
