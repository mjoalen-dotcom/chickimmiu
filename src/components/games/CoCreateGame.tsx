'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Link2, Plus, Check, Sparkles, Share2, Copy } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

const OUTFIT_SLOTS = [
  { key: 'top', label: '上身', emoji: '👚' },
  { key: 'bottom', label: '下身', emoji: '👖' },
  { key: 'shoes', label: '鞋子', emoji: '👟' },
  { key: 'bag', label: '包包', emoji: '👜' },
  { key: 'accessory', label: '配件', emoji: '💍' },
]

const PIECE_OPTIONS: Record<string, Array<{ emoji: string; label: string }>> = {
  top: [
    { emoji: '👚', label: '襯衫' }, { emoji: '👕', label: 'T恤' }, { emoji: '🧥', label: '外套' },
    { emoji: '👗', label: '洋裝' }, { emoji: '🥻', label: '背心' }, { emoji: '👘', label: '和服外套' },
  ],
  bottom: [
    { emoji: '👖', label: '牛仔褲' }, { emoji: '🩳', label: '短褲' }, { emoji: '👗', label: '裙子' },
    { emoji: '🩱', label: '窄裙' }, { emoji: '🧶', label: '針織褲' }, { emoji: '🎽', label: '寬褲' },
  ],
  shoes: [
    { emoji: '👟', label: '運動鞋' }, { emoji: '👠', label: '高跟鞋' }, { emoji: '👡', label: '涼鞋' },
    { emoji: '🥾', label: '短靴' }, { emoji: '👞', label: '樂福鞋' }, { emoji: '🩴', label: '拖鞋' },
  ],
  bag: [
    { emoji: '👜', label: '手提包' }, { emoji: '🎒', label: '後背包' }, { emoji: '👝', label: '小方包' },
    { emoji: '💼', label: '公事包' }, { emoji: '🧳', label: '托特包' }, { emoji: '🪮', label: '腰包' },
  ],
  accessory: [
    { emoji: '💍', label: '戒指' }, { emoji: '📿', label: '項鏈' }, { emoji: '🧣', label: '圍巾' },
    { emoji: '🕶️', label: '墨鏡' }, { emoji: '👒', label: '帽子' }, { emoji: '🎀', label: '髮飾' },
  ],
}

const DEMO_MEMBERS = [
  { name: '你', avatar: '🙋‍♀️', ready: true },
  { name: '小花', avatar: '🌸', ready: true },
  { name: '美美', avatar: '✨', ready: false },
]

export function CoCreateGame({ settings }: Props) {
  const [phase, setPhase] = useState<'lobby' | 'build' | 'reveal'>('lobby')
  const [currentSlot, setCurrentSlot] = useState(0)
  const [selections, setSelections] = useState<Record<string, { emoji: string; label: string; by: string }>>({})
  const [copied, setCopied] = useState(false)

  const coCreatePoints = (settings.coCreatePoints as number) || 15

  const handleCopyLink = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelectPiece = (piece: { emoji: string; label: string }) => {
    const slot = OUTFIT_SLOTS[currentSlot]
    setSelections((prev) => ({
      ...prev,
      [slot.key]: { ...piece, by: DEMO_MEMBERS[currentSlot % DEMO_MEMBERS.length].name },
    }))
    if (currentSlot < OUTFIT_SLOTS.length - 1) {
      setCurrentSlot((prev) => prev + 1)
    } else {
      setPhase('reveal')
    }
  }

  const totalScore = Object.keys(selections).length * 20

  return (
    <div className="max-w-lg mx-auto">
      {/* Lobby Phase */}
      {phase === 'lobby' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-200 p-5 text-center">
            <Users size={28} className="mx-auto text-gold-600 mb-3" />
            <h3 className="font-serif text-lg mb-1">共創穿搭房</h3>
            <p className="text-xs text-muted-foreground mb-4">邀請好友一起搭配，每人選一件單品！</p>

            {/* Room Code */}
            <div className="bg-cream-50 rounded-xl p-3 mb-4">
              <p className="text-[10px] text-muted-foreground mb-1">房間代碼</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-mono font-bold tracking-widest text-gold-600">CKMU-8824</span>
                <button onClick={handleCopyLink} className="p-1.5 rounded-lg hover:bg-cream-100 transition-colors">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-muted-foreground" />}
                </button>
              </div>
            </div>

            {/* Members */}
            <div className="space-y-2 mb-4">
              {DEMO_MEMBERS.map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-cream-50 rounded-xl">
                  <span className="text-lg">{m.avatar}</span>
                  <span className="text-sm flex-1 text-left">{m.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    m.ready ? 'bg-green-100 text-green-600' : 'bg-cream-200 text-muted-foreground'
                  }`}>
                    {m.ready ? '已準備' : '等待中...'}
                  </span>
                </div>
              ))}
            </div>

            {/* Share */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gold-500/10 text-gold-600 rounded-xl text-sm mb-3"
            >
              <Share2 size={14} />
              分享邀請連結
            </button>

            <button
              onClick={() => setPhase('build')}
              className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide"
            >
              開始共創 ✨
            </button>
          </div>
        </div>
      )}

      {/* Build Phase */}
      {phase === 'build' && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <div className="flex gap-1 mb-3">
              {OUTFIT_SLOTS.map((slot, i) => (
                <div
                  key={slot.key}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    i < currentSlot ? 'bg-gold-500' : i === currentSlot ? 'bg-gold-300' : 'bg-cream-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {DEMO_MEMBERS[currentSlot % DEMO_MEMBERS.length].avatar}{' '}
              {DEMO_MEMBERS[currentSlot % DEMO_MEMBERS.length].name} 正在選擇{' '}
              <span className="text-gold-600 font-medium">{OUTFIT_SLOTS[currentSlot].label}</span>
            </p>
          </div>

          {/* Current outfit so far */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <p className="text-xs font-serif text-center mb-3">目前穿搭</p>
            <div className="flex justify-center gap-3">
              {OUTFIT_SLOTS.map((slot) => (
                <div
                  key={slot.key}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${
                    selections[slot.key]
                      ? 'bg-gold-500/10 border border-gold-300'
                      : slot.key === OUTFIT_SLOTS[currentSlot].key
                        ? 'bg-cream-50 border-2 border-dashed border-gold-400 animate-pulse'
                        : 'bg-cream-50 border border-cream-200'
                  }`}
                >
                  {selections[slot.key]?.emoji || slot.emoji}
                </div>
              ))}
            </div>
          </div>

          {/* Piece Selection */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <p className="text-sm font-serif mb-3 text-center">
              選擇 {OUTFIT_SLOTS[currentSlot].label} {OUTFIT_SLOTS[currentSlot].emoji}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PIECE_OPTIONS[OUTFIT_SLOTS[currentSlot].key].map((piece) => (
                <motion.button
                  key={piece.label}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectPiece(piece)}
                  className="p-3 rounded-xl bg-cream-50 border border-cream-200 hover:border-gold-400 transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">{piece.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{piece.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reveal Phase */}
      {phase === 'reveal' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="bg-white rounded-2xl border border-cream-200 p-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              <Sparkles size={28} className="mx-auto text-gold-500 mb-3" />
            </motion.div>
            <h3 className="text-lg font-serif mb-4">共創穿搭完成！🎉</h3>

            {/* Final outfit display */}
            <div className="flex justify-center gap-2 text-4xl mb-4">
              {OUTFIT_SLOTS.map((slot) => (
                <motion.span
                  key={slot.key}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: OUTFIT_SLOTS.indexOf(slot) * 0.2 }}
                >
                  {selections[slot.key]?.emoji || '❓'}
                </motion.span>
              ))}
            </div>

            {/* Credits */}
            <div className="space-y-2 mb-4">
              {OUTFIT_SLOTS.map((slot) => {
                const sel = selections[slot.key]
                return sel ? (
                  <div key={slot.key} className="flex items-center justify-between px-3 py-2 bg-cream-50 rounded-lg text-xs">
                    <span>{slot.label}: {sel.emoji} {sel.label}</span>
                    <span className="text-muted-foreground">by {sel.by}</span>
                  </div>
                ) : null
              })}
            </div>

            {/* Score */}
            <div className="bg-gradient-to-r from-gold-400 to-gold-500 rounded-xl p-4 text-white">
              <p className="text-sm mb-1">搭配評分</p>
              <p className="text-3xl font-bold">{totalScore}<span className="text-sm font-normal ml-1">/ 100</span></p>
              <p className="text-[10px] opacity-80 mt-1">每位參與者獲得 {coCreatePoints} 點</p>
            </div>
          </div>

          <button
            onClick={() => {
              setPhase('lobby')
              setCurrentSlot(0)
              setSelections({})
            }}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide"
          >
            再玩一次 🔄
          </button>
        </motion.div>
      )}
    </div>
  )
}
