'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Share2, Users } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

const CARD_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = ['♠️', '♥️', '♦️', '♣️']

type Phase = 'menu' | 'creating' | 'waiting' | 'battling' | 'result'

export function CardBattleGame({ settings }: Props) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [myCard, setMyCard] = useState({ value: 0, suit: '' })
  const [opponentCard, setOpponentCard] = useState({ value: 0, suit: '' })
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null)
  const [points, setPoints] = useState(0)
  const [referralCode, setReferralCode] = useState('')
  const [battleLink, setBattleLink] = useState('')

  const winMin = (settings.winnerPointsMin as number) || 30
  const winMax = (settings.winnerPointsMax as number) || 80
  const loseMin = (settings.loserPointsMin as number) || 5
  const referralBonus = (settings.referralBonusPoints as number) || 20

  const drawCard = () => {
    const value = Math.floor(Math.random() * 13) + 1
    const suit = SUITS[Math.floor(Math.random() * 4)]
    return { value, suit }
  }

  const createRoom = () => {
    const card = drawCard()
    setMyCard(card)
    setPhase('waiting')
    setBattleLink(`${window.location.origin}/games/card-battle?room=demo-${Date.now()}`)
  }

  const joinBattle = () => {
    const card = drawCard()
    const oppCard = drawCard()
    setMyCard(card)
    setOpponentCard(oppCard)
    setPhase('battling')

    setTimeout(() => {
      let res: 'win' | 'lose' | 'draw'
      if (card.value > oppCard.value) res = 'win'
      else if (card.value < oppCard.value) res = 'lose'
      else res = 'draw'

      const bonus = referralCode ? referralBonus : 0
      let pts: number
      if (res === 'win') pts = Math.floor(Math.random() * (winMax - winMin + 1)) + winMin + bonus
      else if (res === 'draw') pts = 20 + bonus
      else pts = Math.floor(Math.random() * (loseMin + 10)) + loseMin

      setResult(res)
      setPoints(pts)
      setPhase('result')
    }, 3000)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(battleLink)
    alert('對戰連結已複製！分享給好友吧！')
  }

  return (
    <div className="max-w-md mx-auto">
      {/* ── Menu ── */}
      {phase === 'menu' && (
        <div className="text-center space-y-6">
          <div className="bg-white rounded-2xl border border-cream-200 p-6">
            <h3 className="font-serif text-lg mb-4">選擇模式</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={createRoom}
                className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-200 hover:shadow-md transition-all"
              >
                <Users size={32} className="mx-auto mb-3 text-blue-500" />
                <p className="font-medium text-sm">建立對戰房</p>
                <p className="text-[10px] text-muted-foreground mt-1">邀請好友對戰</p>
              </button>
              <button
                onClick={joinBattle}
                className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200 hover:shadow-md transition-all"
              >
                <span className="text-3xl block mb-3">🤖</span>
                <p className="font-medium text-sm">隨機對戰</p>
                <p className="text-[10px] text-muted-foreground mt-1">與系統對戰</p>
              </button>
            </div>
          </div>

          {/* Referral code input */}
          <div className="bg-white rounded-2xl border border-cream-200 p-5">
            <h4 className="text-sm font-medium mb-3">有推薦碼？輸入獲得額外獎勵！</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="輸入推薦碼"
                className="flex-1 px-4 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
              <button className="px-4 py-2 bg-gold-500/10 text-gold-600 rounded-lg text-sm hover:bg-gold-500/20 transition-colors">
                確認
              </button>
            </div>
            {referralCode && (
              <p className="text-[10px] text-gold-600 mt-2">推薦碼已套用！對戰獎勵 +{referralBonus} 點</p>
            )}
          </div>
        </div>
      )}

      {/* ── Waiting for opponent ── */}
      {phase === 'waiting' && (
        <div className="text-center">
          <div className="mb-6">
            <PlayingCard value={myCard.value} suit={myCard.suit} size="lg" />
            <p className="text-sm font-medium mt-3">你的牌：{CARD_NAMES[myCard.value - 1]} {myCard.suit}</p>
          </div>

          <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6">
            <p className="text-sm font-medium mb-3">分享對戰連結給好友</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={battleLink}
                className="flex-1 px-3 py-2 rounded-lg bg-cream-50 border border-cream-200 text-xs truncate"
              />
              <button onClick={copyLink} className="p-2 bg-gold-500/10 rounded-lg text-gold-600 hover:bg-gold-500/20">
                <Copy size={16} />
              </button>
              <button
                onClick={() => { if (navigator.share) navigator.share({ title: 'CKMU 抽卡對戰', url: battleLink }) }}
                className="p-2 bg-gold-500/10 rounded-lg text-gold-600 hover:bg-gold-500/20"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              ⏳
            </motion.div>
            等待好友加入...
          </div>

          <button
            onClick={joinBattle}
            className="mt-6 px-6 py-2 bg-cream-200 text-foreground rounded-full text-sm hover:bg-cream-300 transition-colors"
          >
            改為隨機對戰
          </button>
        </div>
      )}

      {/* ── Battling animation ── */}
      {phase === 'battling' && (
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-8 mb-8">
            <motion.div animate={{ x: [-20, 0], rotateY: [180, 0] }} transition={{ duration: 1 }}>
              <PlayingCard value={myCard.value} suit={myCard.suit} size="md" />
              <p className="text-xs mt-2 font-medium">你</p>
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-3xl"
            >
              ⚡
            </motion.div>
            <motion.div
              initial={{ rotateY: 180 }}
              animate={{ x: [20, 0], rotateY: [180, 0] }}
              transition={{ duration: 1, delay: 1 }}
            >
              <PlayingCard value={opponentCard.value} suit={opponentCard.suit} size="md" faceDown />
              <p className="text-xs mt-2 font-medium">對手</p>
            </motion.div>
          </div>
          <p className="text-sm text-muted-foreground">翻牌中...</p>
        </div>
      )}

      {/* ── Result ── */}
      {phase === 'result' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="flex items-center justify-center gap-8 mb-6">
            <div>
              <PlayingCard value={myCard.value} suit={myCard.suit} size="md" highlight={result === 'win'} />
              <p className="text-xs mt-2 font-medium">{CARD_NAMES[myCard.value - 1]} {myCard.suit}</p>
            </div>
            <p className="text-2xl">{result === 'win' ? '>' : result === 'lose' ? '<' : '='}</p>
            <div>
              <PlayingCard value={opponentCard.value} suit={opponentCard.suit} size="md" highlight={result === 'lose'} />
              <p className="text-xs mt-2 font-medium">{CARD_NAMES[opponentCard.value - 1]} {opponentCard.suit}</p>
            </div>
          </div>

          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className={`py-6 px-8 rounded-2xl mb-6 ${
              result === 'win' ? 'bg-gold-500/10' : result === 'draw' ? 'bg-blue-500/10' : 'bg-cream-100'
            }`}
          >
            <p className="text-3xl mb-2">{result === 'win' ? '🎉' : result === 'draw' ? '🤝' : '😅'}</p>
            <p className="text-xl font-serif mb-1">
              {result === 'win' ? '你贏了！' : result === 'draw' ? '平手！' : '可惜輸了'}
            </p>
            <p className="text-sm text-muted-foreground">
              獲得 <span className="text-gold-600 font-medium">{points}</span> 點
              {referralCode && ` (含推薦碼加成 +${referralBonus})`}
            </p>
          </motion.div>

          <div className="flex gap-3">
            <button
              onClick={() => { setPhase('menu'); setResult(null) }}
              className="flex-1 py-3 bg-foreground text-cream-50 rounded-xl text-sm"
            >
              再來一場
            </button>
            <button
              onClick={() => { if (navigator.share) navigator.share({ title: '一起來 CKMU 抽卡對戰！', url: window.location.href }) }}
              className="flex items-center gap-2 px-5 py-3 bg-gold-500/10 text-gold-600 rounded-xl text-sm"
            >
              <Share2 size={14} />
              邀請好友
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ── Playing Card Component ──
function PlayingCard({ value, suit, size, faceDown, highlight }: {
  value: number; suit: string; size: 'sm' | 'md' | 'lg'; faceDown?: boolean; highlight?: boolean
}) {
  const sizeMap = { sm: 'w-16 h-24', md: 'w-24 h-36', lg: 'w-32 h-48' }
  const fontSize = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' }
  const name = CARD_NAMES[value - 1] || '?'
  const isRed = suit === '♥️' || suit === '♦️'

  return (
    <div className={`${sizeMap[size]} rounded-xl shadow-lg inline-block ${
      highlight ? 'ring-4 ring-gold-400' : ''
    } ${faceDown ? 'bg-gradient-to-br from-blue-600 to-indigo-700' : 'bg-white border border-cream-200'}`}>
      {faceDown ? (
        <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl font-serif">
          ?
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <span className={`${fontSize[size]} font-serif ${isRed ? 'text-red-500' : 'text-foreground'}`}>
            {name}
          </span>
          <span className="text-lg">{suit}</span>
        </div>
      )}
    </div>
  )
}
