'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Send, Package, Sparkles, RotateCcw, Heart } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

const BOX_ITEMS = [
  { emoji: '👗', label: '碎花洋裝', rarity: 'SSR' },
  { emoji: '👚', label: '蕾絲上衣', rarity: 'SR' },
  { emoji: '🧥', label: '風衣外套', rarity: 'SR' },
  { emoji: '👜', label: '小方包', rarity: 'R' },
  { emoji: '🧣', label: '絲質圍巾', rarity: 'R' },
  { emoji: '💍', label: '珍珠戒指', rarity: 'SSR' },
  { emoji: '👠', label: '尖頭高跟鞋', rarity: 'SR' },
  { emoji: '🕶️', label: '復古墨鏡', rarity: 'R' },
  { emoji: '👒', label: '草編帽', rarity: 'R' },
  { emoji: '🎀', label: '蝴蝶結髮夾', rarity: 'N' },
  { emoji: '📿', label: '珍珠項鏈', rarity: 'SSR' },
  { emoji: '👡', label: '涼鞋', rarity: 'N' },
]

const RARITY_STYLES: Record<string, string> = {
  SSR: 'from-yellow-400 to-amber-500 text-white',
  SR: 'from-purple-400 to-purple-500 text-white',
  R: 'from-blue-400 to-blue-500 text-white',
  N: 'from-gray-300 to-gray-400 text-white',
}

const RARITY_GLOW: Record<string, string> = {
  SSR: 'shadow-lg shadow-amber-200',
  SR: 'shadow-lg shadow-purple-200',
  R: 'shadow-md shadow-blue-100',
  N: '',
}

const DEMO_FRIENDS = [
  { name: '小花', avatar: '🌸' },
  { name: '美美', avatar: '✨' },
  { name: '璀璀', avatar: '🌙' },
  { name: '星星', avatar: '💫' },
]

export function BlindBoxGame({ settings }: Props) {
  const [phase, setPhase] = useState<'create' | 'send' | 'unbox' | 'result'>('create')
  const [selectedItems, setSelectedItems] = useState<typeof BOX_ITEMS>([])
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null)
  const [isFlipping, setIsFlipping] = useState(false)
  const [revealedItem, setRevealedItem] = useState<typeof BOX_ITEMS[0] | null>(null)
  const [flipStep, setFlipStep] = useState(0)

  const senderPoints = (settings.senderPoints as number) || 5
  const receiverPoints = (settings.receiverPoints as number) || 8

  const toggleItem = (item: typeof BOX_ITEMS[0]) => {
    setSelectedItems((prev) =>
      prev.find((p) => p.label === item.label)
        ? prev.filter((p) => p.label !== item.label)
        : prev.length < 5
          ? [...prev, item]
          : prev
    )
  }

  const handleSend = () => {
    if (!selectedFriend || selectedItems.length === 0) return
    setPhase('unbox')
  }

  const handleUnbox = () => {
    setIsFlipping(true)
    setFlipStep(1)
    // Simulate dramatic unboxing
    setTimeout(() => setFlipStep(2), 600)
    setTimeout(() => setFlipStep(3), 1200)
    setTimeout(() => {
      const randomItem = BOX_ITEMS[Math.floor(Math.random() * BOX_ITEMS.length)]
      setRevealedItem(randomItem)
      setFlipStep(4)
      setIsFlipping(false)
    }, 2000)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Create Phase */}
      {phase === 'create' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-200 p-5 text-center">
            <Package size={28} className="mx-auto text-gold-600 mb-3" />
            <h3 className="font-serif text-lg mb-1">打造你的盲盒 📦</h3>
            <p className="text-xs text-muted-foreground">選擇最多 5 件單品放入盲盒</p>
          </div>

          {/* Items Grid */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <div className="grid grid-cols-4 gap-2">
              {BOX_ITEMS.map((item) => {
                const selected = selectedItems.find((s) => s.label === item.label)
                return (
                  <motion.button
                    key={item.label}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleItem(item)}
                    className={`p-2 rounded-xl text-center transition-all relative ${
                      selected
                        ? 'bg-gold-500/10 border-2 border-gold-400'
                        : 'bg-cream-50 border border-cream-200 hover:border-gold-300'
                    }`}
                  >
                    <span className="text-2xl block">{item.emoji}</span>
                    <span className="text-[8px] text-muted-foreground block truncate">{item.label}</span>
                    <span className={`text-[8px] px-1 py-0.5 rounded bg-gradient-to-r ${RARITY_STYLES[item.rarity]} absolute -top-1 -right-1`}>
                      {item.rarity}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Selected preview */}
          {selectedItems.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-cream-50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-2">盲盒內容 ({selectedItems.length}/5)</p>
              <div className="flex justify-center gap-2 text-2xl">
                {selectedItems.map((item) => (
                  <span key={item.label}>{item.emoji}</span>
                ))}
              </div>
            </motion.div>
          )}

          <button
            onClick={() => setPhase('send')}
            disabled={selectedItems.length === 0}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          >
            下一步：選擇收件人 →
          </button>
        </div>
      )}

      {/* Send Phase */}
      {phase === 'send' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-200 p-5 text-center">
            <Send size={28} className="mx-auto text-gold-600 mb-3" />
            <h3 className="font-serif text-lg mb-1">選擇收件好友 💌</h3>
            <p className="text-xs text-muted-foreground">盲盒將神秘送達！</p>
          </div>

          <div className="space-y-2">
            {DEMO_FRIENDS.map((friend) => (
              <button
                key={friend.name}
                onClick={() => setSelectedFriend(friend.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  selectedFriend === friend.name
                    ? 'bg-gold-500/10 border-2 border-gold-400'
                    : 'bg-white border border-cream-200 hover:border-gold-300'
                }`}
              >
                <span className="text-2xl">{friend.avatar}</span>
                <span className="text-sm font-medium">{friend.name}</span>
                {selectedFriend === friend.name && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto text-gold-600">
                    <Heart size={16} fill="currentColor" />
                  </motion.span>
                )}
              </button>
            ))}
          </div>

          {/* Box preview */}
          <div className="bg-cream-50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">盲盒預覽</p>
            <div className="flex justify-center gap-1 text-lg">
              {selectedItems.map((item) => (
                <span key={item.label}>📦</span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {selectedItems.length} 件單品 · 收件人隨機抽到 1 件
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPhase('create')}
              className="flex-1 py-3 bg-white border border-cream-200 rounded-xl text-sm"
            >
              ← 返回
            </button>
            <button
              onClick={handleSend}
              disabled={!selectedFriend}
              className="flex-1 py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide disabled:opacity-40"
            >
              🎁 送出盲盒
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground">
            送出盲盒 +{senderPoints} 點 · 收到盲盒 +{receiverPoints} 點
          </p>
        </div>
      )}

      {/* Unbox Phase */}
      {phase === 'unbox' && !revealedItem && (
        <div className="text-center py-6">
          <div className="bg-white rounded-2xl border border-cream-200 p-8">
            <p className="text-sm text-muted-foreground mb-4">
              來自 <span className="text-gold-600 font-medium">小花</span> 的盲盒 🎁
            </p>

            {/* 3D Box */}
            <motion.div
              className="w-32 h-32 mx-auto mb-6 cursor-pointer relative"
              animate={
                flipStep === 1 ? { rotateY: 90 } :
                flipStep === 2 ? { rotateY: 180 } :
                flipStep === 3 ? { rotateY: 270, scale: 1.2 } :
                {}
              }
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ perspective: 1000 }}
            >
              <div className={`w-full h-full rounded-2xl flex items-center justify-center text-6xl ${
                flipStep >= 2 ? 'bg-gradient-to-br from-gold-400 to-gold-500' : 'bg-gradient-to-br from-cream-200 to-cream-300'
              } ${flipStep >= 1 ? 'animate-pulse' : ''}`}>
                {flipStep < 3 ? '📦' : '✨'}
              </div>
            </motion.div>

            {!isFlipping && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleUnbox}
                className="px-8 py-3 bg-gradient-to-r from-gold-400 to-gold-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-gold-200"
              >
                ✨ 開箱！
              </motion.button>
            )}

            {isFlipping && (
              <p className="text-sm text-gold-600 animate-pulse">開箱中...</p>
            )}
          </div>
        </div>
      )}

      {/* Result Phase */}
      {(phase === 'unbox' && revealedItem) && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 10 }}
          className="text-center py-4"
        >
          <div className={`bg-white rounded-2xl border border-cream-200 p-8 ${RARITY_GLOW[revealedItem.rarity]}`}>
            {/* Rarity Banner */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={`inline-block px-4 py-1 rounded-full bg-gradient-to-r ${RARITY_STYLES[revealedItem.rarity]} text-sm font-bold mb-4`}
            >
              {revealedItem.rarity === 'SSR' ? '🌟 超稀有 SSR！' : revealedItem.rarity === 'SR' ? '💜 稀有 SR！' : revealedItem.rarity === 'R' ? '💙 精良 R' : '普通 N'}
            </motion.div>

            {/* Item */}
            <motion.p
              className="text-7xl mb-4"
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              {revealedItem.emoji}
            </motion.p>
            <p className="text-lg font-serif mb-1">{revealedItem.label}</p>
            <p className="text-xs text-muted-foreground mb-4">來自小花的心意 💝</p>

            {/* Points */}
            <div className="bg-gold-500/5 rounded-xl p-3 mb-4">
              <p className="text-sm text-gold-600">
                <Sparkles size={14} className="inline mr-1" />
                獲得 {receiverPoints} 點！
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPhase('create')
                  setRevealedItem(null)
                  setSelectedItems([])
                  setSelectedFriend(null)
                  setFlipStep(0)
                }}
                className="flex-1 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm"
              >
                <Gift size={14} className="inline mr-1" />
                回送盲盒
              </button>
              <button
                onClick={() => {
                  setPhase('create')
                  setRevealedItem(null)
                  setSelectedItems([])
                  setSelectedFriend(null)
                  setFlipStep(0)
                }}
                className="flex-1 py-2.5 bg-gold-500/10 text-gold-600 rounded-xl text-sm"
              >
                <RotateCcw size={14} className="inline mr-1" />
                再玩一次
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
