'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Share2, RotateCcw, Sparkles, Check, Users, Swords } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────
interface CardBattleProps {
  open: boolean
  onClose: () => void
  roomCode?: string
  referralCode?: string
}

type GameState = 'lobby' | 'waiting' | 'battle' | 'result'

interface Card {
  rank: number   // 1-13
  suit: string   // 'spades' | 'hearts' | 'diamonds' | 'clubs'
}

interface BattleResult {
  myCard: Card
  opponentCard: Card
  winner: 'me' | 'opponent' | 'draw'
  prize: number
}

// ─── Helpers ──────────────────────────────────────────────────────
function getRankDisplay(rank: number): string {
  if (rank === 1) return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

function getSuitDisplay(suit: string): { symbol: string; color: string } {
  switch (suit) {
    case 'spades':   return { symbol: '♠', color: '#2C2C2C' }
    case 'clubs':    return { symbol: '♣', color: '#2C2C2C' }
    case 'hearts':   return { symbol: '♥', color: '#ef4444' }
    case 'diamonds': return { symbol: '♦', color: '#ef4444' }
    default:         return { symbol: '♠', color: '#2C2C2C' }
  }
}

function getSuitName(suit: string): string {
  switch (suit) {
    case 'spades':   return '黑桃'
    case 'hearts':   return '紅心'
    case 'diamonds': return '方塊'
    case 'clubs':    return '梅花'
    default:         return ''
  }
}

function randomCard(): Card {
  const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const
  return {
    rank: Math.floor(Math.random() * 13) + 1,
    suit: suits[Math.floor(Math.random() * 4)],
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ─── Sub-components ───────────────────────────────────────────────

function CardBack() {
  return (
    <div className="w-32 h-44 md:w-40 md:h-56 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 border-2 border-gold-400 shadow-lg flex items-center justify-center relative overflow-hidden">
      {/* Diamond pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.3) 8px, rgba(255,255,255,0.3) 9px), repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.3) 8px, rgba(255,255,255,0.3) 9px)`,
      }} />
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-white/30 flex items-center justify-center">
        <span className="text-white/60 text-2xl md:text-3xl font-serif">C</span>
      </div>
    </div>
  )
}

function CardFront({ card }: { card: Card }) {
  const { symbol, color } = getSuitDisplay(card.suit)
  const display = getRankDisplay(card.rank)

  return (
    <div className="w-32 h-44 md:w-40 md:h-56 rounded-xl bg-white border-2 border-cream-200 shadow-lg flex flex-col justify-between p-2.5 md:p-3 relative">
      {/* Top-left corner */}
      <div className="flex flex-col items-start leading-tight">
        <span className="text-base md:text-lg font-serif font-bold" style={{ color }}>{display}</span>
        <span className="text-sm md:text-base" style={{ color }}>{symbol}</span>
      </div>
      {/* Center rank */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl md:text-5xl font-serif font-bold" style={{ color }}>{display}</span>
      </div>
      {/* Bottom-right corner */}
      <div className="flex flex-col items-end leading-tight self-end rotate-180">
        <span className="text-base md:text-lg font-serif font-bold" style={{ color }}>{display}</span>
        <span className="text-sm md:text-base" style={{ color }}>{symbol}</span>
      </div>
    </div>
  )
}

function FlippableCard({ card, flipped, label }: { card: Card | null; flipped: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs tracking-wide text-gold-500 font-medium">{label}</p>
      <div className="relative w-32 h-44 md:w-40 md:h-56" style={{ perspective: '800px' }}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Back face */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <CardBack />
          </div>
          {/* Front face */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            {card && <CardFront card={card} />}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────

export function CardBattle({ open, onClose, roomCode: initialRoomCode, referralCode }: CardBattleProps) {
  const [gameState, setGameState] = useState<GameState>(initialRoomCode ? 'battle' : 'lobby')
  const [currentRoomCode, setCurrentRoomCode] = useState(initialRoomCode || '')
  const [joinInput, setJoinInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreateRoom = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/games/card-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', referralCode }),
      })
      const data = await res.json()
      setCurrentRoomCode(data.roomCode || generateRoomCode())
    } catch {
      // Fallback for demo
      setCurrentRoomCode(generateRoomCode())
    }
    setLoading(false)
    setGameState('waiting')
  }, [referralCode])

  const handleJoinRoom = useCallback(async () => {
    if (!joinInput.trim()) return
    setLoading(true)
    try {
      await fetch('/api/games/card-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomCode: joinInput.trim().toUpperCase() }),
      })
    } catch {
      // Continue with demo flow
    }
    setCurrentRoomCode(joinInput.trim().toUpperCase())
    setLoading(false)
    setGameState('battle')
  }, [joinInput])

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(currentRoomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [currentRoomCode])

  const handleShareLink = useCallback(() => {
    const url = `${window.location.origin}/games/card-battle?room=${currentRoomCode}`
    const text = `來 CHIC KIM & MIU 跟我比大小！房間代碼：${currentRoomCode}\n${url}`
    if (navigator.share) {
      navigator.share({ title: '抽卡片比大小', text, url })
    } else {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [currentRoomCode])

  const handleFlip = useCallback(() => {
    if (flipped) return
    const myCard = randomCard()
    const opponentCard = randomCard()
    setFlipped(true)

    setTimeout(() => {
      let winner: 'me' | 'opponent' | 'draw'
      if (myCard.rank === opponentCard.rank) winner = 'draw'
      else if (myCard.rank === 1) winner = 'me'
      else if (opponentCard.rank === 1) winner = 'opponent'
      else if (myCard.rank > opponentCard.rank) winner = 'me'
      else winner = 'opponent'

      const prize = winner === 'draw' ? 15 : winner === 'me' ? 30 : 5
      setBattleResult({ myCard, opponentCard, winner, prize })
      setGameState('result')
    }, 800)
  }, [flipped])

  const handleShareResult = useCallback(() => {
    if (!battleResult) return
    const myDisplay = `${getSuitName(battleResult.myCard.suit)}${getRankDisplay(battleResult.myCard.rank)}`
    const oppDisplay = `${getSuitName(battleResult.opponentCard.suit)}${getRankDisplay(battleResult.opponentCard.rank)}`
    const resultText = battleResult.winner === 'me' ? '贏了' : battleResult.winner === 'opponent' ? '輸了' : '平手'
    const text = `【CHIC KIM & MIU 抽卡片比大小】\n我的卡片：${myDisplay} vs 對手：${oppDisplay}\n結果：${resultText}！獲得 ${battleResult.prize} 點 ✨`
    if (navigator.share) {
      navigator.share({ title: '抽卡片比大小', text })
    } else {
      navigator.clipboard.writeText(text)
    }
  }, [battleResult])

  const handlePlayAgain = useCallback(() => {
    setFlipped(false)
    setBattleResult(null)
    setGameState('battle')
  }, [])

  const handleBack = useCallback(() => {
    setFlipped(false)
    setBattleResult(null)
    setCurrentRoomCode('')
    setJoinInput('')
    setGameState('lobby')
  }, [])

  // Simulate opponent joining after a delay in waiting state
  const handleSimulateJoin = useCallback(() => {
    setGameState('battle')
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-1">CARD BATTLE</p>
          <h2 className="text-xl font-serif">抽卡片比大小</h2>
        </div>

        {/* ── Lobby State ─────────────────────────────── */}
        {gameState === 'lobby' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 rounded-full bg-gold-500/10 flex items-center justify-center">
                <Swords size={28} className="text-gold-500" />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              邀請好友一起來比大小，贏家獲得更多點數！
            </p>

            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-50"
            >
              {loading ? '建立中...' : '建立對戰房間'}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-cream-200" />
              <span className="text-xs text-muted-foreground">或</span>
              <div className="flex-1 h-px bg-cream-200" />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-center">輸入房間代碼加入</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="輸入房間代碼"
                  maxLength={6}
                  className="flex-1 px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-sm text-center tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!joinInput.trim() || loading}
                  className="px-5 py-3 bg-cream-200 text-foreground rounded-xl text-sm font-medium hover:bg-cream-300 transition-colors disabled:opacity-50"
                >
                  加入
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Waiting State ───────────────────────────── */}
        {gameState === 'waiting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="flex justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 rounded-full border-2 border-gold-500 border-t-transparent flex items-center justify-center"
              />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              等待好友加入對戰
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ...
              </motion.span>
            </p>

            {/* Room code display */}
            <div className="bg-cream-50 rounded-2xl p-5 text-center space-y-3">
              <p className="text-xs text-muted-foreground">房間代碼</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-serif tracking-[0.3em] text-gold-600">{currentRoomCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="w-8 h-8 rounded-full bg-white border border-cream-200 flex items-center justify-center hover:bg-cream-100 transition-colors"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gold-500" />}
                </button>
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleShareLink}
                className="flex-1 py-3 bg-[#06C755] text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <span className="font-bold text-base">LINE</span>
                分享
              </button>
              <button
                onClick={handleCopyCode}
                className="flex-1 py-3 bg-cream-200 text-foreground rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-cream-300 transition-colors"
              >
                <Copy size={14} />
                複製連結
              </button>
            </div>

            {/* Demo: skip waiting */}
            <button
              onClick={handleSimulateJoin}
              className="w-full py-2 text-xs text-muted-foreground hover:text-gold-500 transition-colors"
            >
              <Users size={12} className="inline mr-1" />
              模擬對手加入（測試用）
            </button>
          </motion.div>
        )}

        {/* ── Battle State ────────────────────────────── */}
        {gameState === 'battle' && !battleResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              房間 <span className="text-gold-500 font-medium">{currentRoomCode}</span>
            </p>

            {/* Cards */}
            <div className="flex items-center justify-center gap-4 md:gap-8">
              <FlippableCard
                card={battleResult ? (battleResult as BattleResult).myCard : { rank: 1, suit: 'spades' as const }}
                flipped={flipped}
                label="我的卡片"
              />
              <div className="text-2xl font-serif text-gold-500">VS</div>
              <FlippableCard
                card={battleResult ? (battleResult as BattleResult).opponentCard : { rank: 1, suit: 'hearts' as const }}
                flipped={flipped}
                label="對手卡片"
              />
            </div>

            {/* Flip button */}
            <button
              onClick={handleFlip}
              disabled={flipped}
              className="w-full py-4 bg-gold-500 text-white rounded-xl text-base font-medium tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {flipped ? '翻牌中...' : '翻牌'}
            </button>
          </motion.div>
        )}

        {/* ── Result State ────────────────────────────── */}
        {gameState === 'result' && battleResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Winner announcement */}
            <div className="text-center">
              <AnimatePresence>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="inline-flex items-center gap-2 mb-3"
                >
                  <Sparkles size={20} className="text-gold-500" />
                  <span className="text-2xl font-serif">
                    {battleResult.winner === 'me' && '你贏了！'}
                    {battleResult.winner === 'opponent' && '對手贏了'}
                    {battleResult.winner === 'draw' && '平手！'}
                  </span>
                  <Sparkles size={20} className="text-gold-500" />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Cards display */}
            <div className="flex items-center justify-center gap-4 md:gap-8">
              <div className={`flex flex-col items-center gap-2 ${battleResult.winner === 'me' ? 'ring-2 ring-gold-500 rounded-2xl p-2 shadow-[0_0_20px_rgba(193,154,91,0.3)]' : ''}`}>
                <CardFront card={battleResult.myCard} />
                <p className="text-xs text-muted-foreground">
                  {getSuitName(battleResult.myCard.suit)}{getRankDisplay(battleResult.myCard.rank)}
                </p>
              </div>
              <span className="text-lg text-muted-foreground font-serif">VS</span>
              <div className={`flex flex-col items-center gap-2 ${battleResult.winner === 'opponent' ? 'ring-2 ring-gold-500 rounded-2xl p-2 shadow-[0_0_20px_rgba(193,154,91,0.3)]' : ''}`}>
                <CardFront card={battleResult.opponentCard} />
                <p className="text-xs text-muted-foreground">
                  {getSuitName(battleResult.opponentCard.suit)}{getRankDisplay(battleResult.opponentCard.rank)}
                </p>
              </div>
            </div>

            {/* Prize */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center p-4 bg-gold-500/10 rounded-xl"
            >
              <p className="text-sm font-medium">
                {battleResult.winner === 'me' && (
                  <>恭喜獲得 <span className="text-gold-600 font-bold">{battleResult.prize} 點</span>！</>
                )}
                {battleResult.winner === 'opponent' && (
                  <>安慰獎 <span className="text-gold-600 font-bold">{battleResult.prize} 點</span></>
                )}
                {battleResult.winner === 'draw' && (
                  <>平手！雙方各獲得 <span className="text-gold-600 font-bold">{battleResult.prize} 點</span></>
                )}
              </p>
            </motion.div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleShareResult}
                className="w-full py-3.5 bg-[#06C755] text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Share2 size={14} />
                分享戰果
              </button>
              <button
                onClick={handlePlayAgain}
                className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gold-600 transition-colors"
              >
                <RotateCcw size={14} />
                再來一局
              </button>
              <button
                onClick={handleBack}
                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                返回
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
