'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, Star, Gift, Heart, MessageCircle } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

interface Wish {
  id: number
  user: string
  avatar: string
  wish: string
  category: string
  suggestions: number
  fulfilled: boolean
}

const CATEGORIES = ['約會穿搭', '上班穿搭', '旅行穿搭', '派對穿搭', '運動穿搭', '其他']

const DEMO_WISHES: Wish[] = [
  { id: 1, user: '小*', avatar: '🌸', wish: '想要約會穿搭建議，要甜美但不會太誇張', category: '約會穿搭', suggestions: 5, fulfilled: false },
  { id: 2, user: '美*', avatar: '✨', wish: '下週面試不知道穿什麼，科技業偏 casual', category: '上班穿搭', suggestions: 8, fulfilled: false },
  { id: 3, user: '璀*', avatar: '🌙', wish: '日本旅行穿搭求推薦，四月去', category: '旅行穿搭', suggestions: 12, fulfilled: true },
  { id: 4, user: '星*', avatar: '💫', wish: '聖誕派對要穿什麼才不會太隆重', category: '派對穿搭', suggestions: 3, fulfilled: false },
  { id: 5, user: '雲*', avatar: '🌿', wish: '健身房穿搭推薦，要好看又實用', category: '運動穿搭', suggestions: 6, fulfilled: false },
]

const SUGGESTION_EMOJIS = ['👗🌸👡', '👚👖👟', '🧥👗💍', '👕🩳🎒']

export function WishPoolGame({ settings }: Props) {
  const [tab, setTab] = useState<'pool' | 'wish' | 'my'>('pool')
  const [wishes, setWishes] = useState(DEMO_WISHES)
  const [wishText, setWishText] = useState('')
  const [wishCategory, setWishCategory] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [respondingTo, setRespondingTo] = useState<number | null>(null)
  const [suggestion, setSuggestion] = useState('')
  const [sentSuggestions, setSentSuggestions] = useState<Set<number>>(new Set())

  const wishPoints = (settings.wishPoints as number) || 3
  const fulfillPoints = (settings.fulfillPoints as number) || 10

  const handleMakeWish = () => {
    if (!wishText || !wishCategory) return
    setWishes((prev) => [
      {
        id: prev.length + 1,
        user: '你',
        avatar: '🙋‍♀️',
        wish: wishText,
        category: wishCategory,
        suggestions: 0,
        fulfilled: false,
      },
      ...prev,
    ])
    setWishText('')
    setWishCategory('')
    setSubmitted(true)
  }

  const handleSendSuggestion = (wishId: number) => {
    setSentSuggestions((prev) => new Set(prev).add(wishId))
    setWishes((prev) =>
      prev.map((w) => (w.id === wishId ? { ...w, suggestions: w.suggestions + 1 } : w))
    )
    setSuggestion('')
    setRespondingTo(null)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header Stats */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-white rounded-xl border border-cream-200 p-3 text-center">
          <p className="text-lg font-bold text-gold-600">{wishes.length}</p>
          <p className="text-[10px] text-muted-foreground">許願池</p>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-cream-200 p-3 text-center">
          <p className="text-lg font-bold text-gold-600">{wishes.reduce((a, w) => a + w.suggestions, 0)}</p>
          <p className="text-[10px] text-muted-foreground">建議數</p>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-cream-200 p-3 text-center">
          <p className="text-lg font-bold text-gold-600">{wishes.filter((w) => w.fulfilled).length}</p>
          <p className="text-[10px] text-muted-foreground">已圓夢</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'pool' as const, label: '🌊 許願池' },
          { key: 'wish' as const, label: '🌟 我要許願' },
          { key: 'my' as const, label: '💝 我的許願' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
              tab === t.key ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pool */}
      {tab === 'pool' && (
        <div className="space-y-3">
          {wishes.map((wish, i) => (
            <motion.div
              key={wish.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-cream-200 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{wish.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{wish.user}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cream-100 text-muted-foreground">
                      {wish.category}
                    </span>
                    {wish.fulfilled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-600">
                        已圓夢 ✅
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mb-2">{wish.wish}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageCircle size={10} />
                      {wish.suggestions} 個建議
                    </span>
                  </div>
                </div>
              </div>

              {/* Respond area */}
              {respondingTo === wish.id ? (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 pt-3 border-t border-cream-100">
                  <p className="text-xs font-serif mb-2">💡 推薦穿搭給 {wish.user}</p>
                  <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                    {SUGGESTION_EMOJIS.map((em) => (
                      <button
                        key={em}
                        onClick={() => setSuggestion(em)}
                        className={`px-3 py-2 rounded-lg text-lg shrink-0 ${
                          suggestion === em ? 'bg-gold-500/10 border border-gold-400' : 'bg-cream-50 border border-cream-200'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={suggestion}
                      onChange={(e) => setSuggestion(e.target.value)}
                      placeholder="描述你的穿搭建議..."
                      className="flex-1 px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                    />
                    <button
                      onClick={() => handleSendSuggestion(wish.id)}
                      disabled={!suggestion}
                      className="px-4 py-2 bg-foreground text-cream-50 rounded-lg text-sm disabled:opacity-40"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="mt-3 pt-3 border-t border-cream-100">
                  {sentSuggestions.has(wish.id) ? (
                    <p className="text-xs text-gold-600 text-center">✨ 已送出建議！+{fulfillPoints} 點</p>
                  ) : (
                    <button
                      onClick={() => setRespondingTo(wish.id)}
                      className="w-full py-2 text-xs text-gold-600 hover:bg-cream-50 rounded-lg transition-colors"
                    >
                      💫 幫 {wish.user} 圓夢（+{fulfillPoints} 點）
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Make a Wish */}
      {tab === 'wish' && (
        <div>
          {submitted ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-10">
              <motion.p
                className="text-5xl mb-4"
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                🌟
              </motion.p>
              <p className="text-lg font-serif mb-2">許願成功！</p>
              <p className="text-sm text-muted-foreground mb-1">你的願望已投入許願池 ✨</p>
              <p className="text-xs text-gold-600">獲得 {wishPoints} 點</p>
              <button
                onClick={() => { setSubmitted(false); setTab('pool') }}
                className="mt-4 px-6 py-2.5 bg-gold-500/10 text-gold-600 rounded-full text-sm"
              >
                查看許願池
              </button>
            </motion.div>
          ) : (
            <div className="bg-white rounded-2xl border border-cream-200 p-5 space-y-4">
              <div className="text-center">
                <Star size={28} className="mx-auto text-gold-500 mb-2" />
                <h3 className="font-serif text-lg">投入你的穿搭願望</h3>
                <p className="text-xs text-muted-foreground mt-1">讓姊妹們幫你實現！</p>
              </div>

              {/* Category */}
              <div>
                <p className="text-sm font-serif mb-2">願望類別</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setWishCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                        wishCategory === cat
                          ? 'bg-foreground text-cream-50'
                          : 'bg-cream-50 border border-cream-200 hover:border-gold-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wish text */}
              <div>
                <p className="text-sm font-serif mb-2">描述你的願望</p>
                <textarea
                  value={wishText}
                  onChange={(e) => setWishText(e.target.value)}
                  placeholder="例：想要約會穿搭建議，要甜美但不會太誇張..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                />
              </div>

              <button
                onClick={handleMakeWish}
                disabled={!wishText || !wishCategory}
                className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🌟 投入許願池
              </button>
              <p className="text-center text-[10px] text-muted-foreground">
                許願 +{wishPoints} 點 · 幫別人圓夢 +{fulfillPoints} 點
              </p>
            </div>
          )}
        </div>
      )}

      {/* My Wishes */}
      {tab === 'my' && (
        <div className="text-center py-10">
          <Gift size={32} className="mx-auto text-cream-300 mb-3" />
          <p className="text-sm text-muted-foreground mb-2">你還沒有許過願望</p>
          <button
            onClick={() => setTab('wish')}
            className="px-5 py-2 bg-gold-500/10 text-gold-600 rounded-full text-sm"
          >
            去許願 🌟
          </button>
        </div>
      )}
    </div>
  )
}
