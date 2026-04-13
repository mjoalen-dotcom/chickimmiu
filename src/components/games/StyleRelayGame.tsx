'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Plus, ChevronRight, Sparkles } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

const STYLE_ELEMENTS = ['配色', '材質', '剪裁', '配件', '風格']

const DEMO_CHAIN = [
  {
    id: 1,
    user: '小*',
    outfit: '👗🧣✨',
    description: '法式碎花洋裝 + 絲巾',
    element: '絲巾',
    likes: 42,
  },
  {
    id: 2,
    user: '美*',
    outfit: '🧣👘🌸',
    description: '絲巾改搭和風外套',
    element: '和風元素',
    likes: 38,
  },
  {
    id: 3,
    user: '璀*',
    outfit: '👘👖🎌',
    description: '和風外套配高腰寬褲',
    element: '寬褲',
    likes: 55,
  },
]

const OUTFIT_PIECES = [
  { emoji: '👗', label: '洋裝' },
  { emoji: '👚', label: '上衣' },
  { emoji: '👖', label: '褲子' },
  { emoji: '🧥', label: '外套' },
  { emoji: '👟', label: '鞋子' },
  { emoji: '👜', label: '包包' },
  { emoji: '🧣', label: '圍巾' },
  { emoji: '🎀', label: '髮飾' },
  { emoji: '💍', label: '飾品' },
  { emoji: '🕶️', label: '墨鏡' },
  { emoji: '👒', label: '帽子' },
  { emoji: '🧤', label: '手套' },
]

export function StyleRelayGame({ settings }: Props) {
  const [chain, setChain] = useState(DEMO_CHAIN)
  const [tab, setTab] = useState<'chain' | 'submit'>('chain')
  const [selectedPieces, setSelectedPieces] = useState<string[]>([])
  const [selectedElement, setSelectedElement] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const chainPoints = (settings.chainPoints as number) || 5

  const lastEntry = chain[chain.length - 1]

  const togglePiece = (emoji: string) => {
    setSelectedPieces((prev) =>
      prev.includes(emoji) ? prev.filter((p) => p !== emoji) : prev.length < 4 ? [...prev, emoji] : prev
    )
  }

  const handleSubmit = () => {
    if (selectedPieces.length === 0 || !selectedElement || !description) return
    setChain((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        user: '你',
        outfit: selectedPieces.join(''),
        description,
        element: selectedElement,
        likes: 0,
      },
    ])
    setSubmitted(true)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-xs text-gold-600 font-serif">🔗 目前接龍長度：{chain.length} 套穿搭</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('chain')}
          className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
            tab === 'chain' ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
          }`}
        >
          🔗 接龍鏈
        </button>
        <button
          onClick={() => setTab('submit')}
          className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
            tab === 'submit' ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
          }`}
        >
          ➕ 接龍
        </button>
      </div>

      {/* Chain View */}
      {tab === 'chain' && (
        <div className="space-y-3">
          {chain.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-cream-200 p-4"
            >
              <div className="flex items-start gap-3">
                {/* Chain Number */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {entry.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{entry.user}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cream-100 text-muted-foreground">
                      延續「{entry.element}」
                    </span>
                  </div>
                  <p className="text-2xl mb-1">{entry.outfit}</p>
                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-gold-600">
                    <Sparkles size={10} />
                    {entry.likes} 人喜歡
                  </div>
                </div>
              </div>
              {i < chain.length - 1 && (
                <div className="flex justify-center mt-2">
                  <ChevronRight size={16} className="text-cream-300 rotate-90" />
                </div>
              )}
            </motion.div>
          ))}

          {/* Current Element to Continue */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-4 bg-gold-500/5 rounded-2xl border border-dashed border-gold-300"
          >
            <Link2 size={20} className="mx-auto text-gold-500 mb-2" />
            <p className="text-sm font-serif text-gold-600">
              下一位請延續「{lastEntry.element}」元素
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              每次接龍獲得 {chainPoints} 點 ✨
            </p>
          </motion.div>
        </div>
      )}

      {/* Submit View */}
      {tab === 'submit' && (
        <div>
          {submitted ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-10">
              <p className="text-5xl mb-4">🔗✨</p>
              <p className="text-lg font-serif mb-2">接龍成功！</p>
              <p className="text-sm text-muted-foreground mb-2">
                你的穿搭已加入接龍鏈！獲得 {chainPoints} 點
              </p>
              <button
                onClick={() => { setTab('chain'); setSubmitted(false) }}
                className="mt-4 px-6 py-2.5 bg-gold-500/10 text-gold-600 rounded-full text-sm"
              >
                查看接龍鏈
              </button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* Previous element reminder */}
              <div className="bg-cream-50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  請延續上一位的元素：
                  <span className="text-gold-600 font-medium ml-1">「{lastEntry.element}」</span>
                </p>
              </div>

              {/* Pick style element */}
              <div>
                <p className="text-sm font-serif mb-2">選擇你想傳遞的風格元素</p>
                <div className="flex flex-wrap gap-2">
                  {STYLE_ELEMENTS.map((el) => (
                    <button
                      key={el}
                      onClick={() => setSelectedElement(el)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                        selectedElement === el
                          ? 'bg-foreground text-cream-50'
                          : 'bg-white border border-cream-200 hover:border-gold-300'
                      }`}
                    >
                      {el}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pick outfit pieces */}
              <div>
                <p className="text-sm font-serif mb-2">組合你的穿搭（最多 4 件）</p>
                <div className="grid grid-cols-6 gap-2">
                  {OUTFIT_PIECES.map((piece) => (
                    <button
                      key={piece.emoji}
                      onClick={() => togglePiece(piece.emoji)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center text-lg transition-all ${
                        selectedPieces.includes(piece.emoji)
                          ? 'bg-gold-500/10 border-2 border-gold-400 scale-105'
                          : 'bg-white border border-cream-200 hover:border-gold-300'
                      }`}
                    >
                      <span>{piece.emoji}</span>
                      <span className="text-[8px] text-muted-foreground">{piece.label}</span>
                    </button>
                  ))}
                </div>
                {selectedPieces.length > 0 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-2xl mt-3">
                    {selectedPieces.join('')}
                  </motion.p>
                )}
              </div>

              {/* Description */}
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述你的穿搭..."
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={selectedPieces.length === 0 || !selectedElement || !description}
                className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <Plus size={14} className="inline mr-1" />
                提交接龍
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
