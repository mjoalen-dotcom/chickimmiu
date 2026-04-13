'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Ticket, Film } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

export function MovieLotteryGame({ settings }: Props) {
  const [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const [remaining, setRemaining] = useState(3)

  const pointsCost = (settings.pointsCostPerPlay as number) || 100
  const ticketType = (settings.ticketType as string) || '威秀影城 2D 一般廳'
  const remainingTickets = (settings.remainingTickets as number) || 50

  const handleDraw = () => {
    if (drawing || remaining <= 0) return
    setDrawing(true)
    setResult(null)

    setTimeout(() => {
      const won = Math.random() < 0.05 // 5% win rate
      setResult(won ? 'win' : 'lose')
      setDrawing(false)
      setRemaining((r) => r - 1)
    }, 2500)
  }

  return (
    <div className="max-w-md mx-auto text-center">
      {/* Info */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">電影票類型</span>
          <span className="font-medium">{ticketType}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">本期剩餘票數</span>
          <span className="font-medium text-gold-600">{remainingTickets} 張</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">每次消耗</span>
          <span className="font-medium">{pointsCost} 點</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">今日剩餘次數</span>
          <span className="font-medium">{remaining} 次</span>
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
            ) : result === 'win' ? (
              <motion.div
                key="win"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                className="text-center text-white"
              >
                <p className="text-5xl mb-2">🎬</p>
                <p className="text-lg font-serif">中獎！</p>
              </motion.div>
            ) : result === 'lose' ? (
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
        disabled={drawing || remaining <= 0}
        className="px-10 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-full text-lg font-serif tracking-wider hover:shadow-lg transition-all disabled:opacity-50"
      >
        {drawing ? '抽獎中...' : remaining <= 0 ? '今日次數已用完' : `抽獎 (-${pointsCost}點)`}
      </button>

      {/* Result message */}
      {result && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mt-4 text-sm ${result === 'win' ? 'text-gold-600 font-medium' : 'text-muted-foreground'}`}
        >
          {result === 'win'
            ? '🎉 恭喜中獎！電影票兌換碼已發送至您的帳戶！'
            : '再試一次吧，幸運之神就在下一次！'}
        </motion.p>
      )}
    </div>
  )
}
