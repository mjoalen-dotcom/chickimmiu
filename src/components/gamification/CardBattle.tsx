'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Copy, Share2, RotateCcw, Sparkles, Check, AlertCircle, LogIn } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────
interface CardBattleProps {
  open: boolean
  onClose: () => void
  onComplete?: () => void
  roomCode?: string
  referralCode?: string
}

type Phase =
  | 'lobby'       // Choose create or join
  | 'creating'    // POST create in-flight
  | 'waiting'     // Created; polling for opponent (3 s interval)
  | 'joining'     // POST join in-flight
  | 'battle'      // Both ready; challenger sees Flip button, opponent polls
  | 'submitting'  // POST play in-flight (challenger only)
  | 'result'      // Battle resolved
  | 'auth'        // 401 — must log in
  | 'error'       // API / network error
  | 'timeout'     // 5-min polling timeout

interface Card {
  rank: number   // 1-13
  suit: string   // 'spades' | 'hearts' | 'diamonds' | 'clubs'
}

interface BattleResult {
  myCard: Card
  opponentCard: Card
  winner: 'me' | 'opponent' | 'draw'
  pointsAwarded: number
}

// ─── Helpers ──────────────────────────────────────────────────────
function getRankDisplay(rank: number): string {
  if (rank === 1)  return 'A'
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

// ─── Sub-components ───────────────────────────────────────────────
function CardBack() {
  return (
    <div className="w-32 h-44 md:w-40 md:h-56 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 border-2 border-gold-400 shadow-lg flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.3) 8px, rgba(255,255,255,0.3) 9px), repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.3) 8px, rgba(255,255,255,0.3) 9px)`,
        }}
      />
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
      <div className="flex flex-col items-start leading-tight">
        <span className="text-base md:text-lg font-serif font-bold" style={{ color }}>{display}</span>
        <span className="text-sm md:text-base" style={{ color }}>{symbol}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl md:text-5xl font-serif font-bold" style={{ color }}>{display}</span>
      </div>
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
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <CardBack />
          </div>
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            {card && <CardFront card={card} />}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────
export function CardBattle({ open, onClose, onComplete, roomCode: initialRoomCode, referralCode }: CardBattleProps) {
  const initialPhase: Phase = initialRoomCode ? 'joining' : 'lobby'

  const [phase, setPhase] = useState<Phase>(initialPhase)
  const phaseRef = useRef<Phase>(initialPhase)

  const [currentRoomCode, setCurrentRoomCode] = useState(initialRoomCode || '')
  const roomCodeRef = useRef(initialRoomCode || '')

  const [isChallenger, setIsChallenger] = useState(false)
  const isChallRef = useRef(false)

  // Challenger/opponent IDs — populated from GET poll responses
  const playerIdsRef = useRef({ challengerId: '', opponentId: '' })

  const [shareLink, setShareLink] = useState('')
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [copied, setCopied] = useState(false)

  const submittingRef = useRef(false)
  const hasInitialized = useRef(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Stable helper — phaseRef and setPhase are both stable
  const advancePhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current)    { clearInterval(pollingRef.current);  pollingRef.current = null }
    if (pollTimeoutRef.current){ clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null }
  }, [])

  const startPolling = useCallback((roomCode: string) => {
    stopPolling()

    const poll = async () => {
      const p = phaseRef.current
      if (p !== 'waiting' && p !== 'battle') { stopPolling(); return }

      try {
        const res = await fetch(`/api/games/card-battle?roomCode=${encodeURIComponent(roomCode)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data.success || !data.data) return

        const { room } = data.data as {
          room: {
            status: string
            challengerId: string
            opponentId: string | null
            challengerCard: Card | null
            opponentCard: Card | null
            result: string | null
            pointsAwarded: Record<string, number>
          }
        }

        // Keep player IDs current for the play handler
        if (room.challengerId) {
          playerIdsRef.current = {
            challengerId: room.challengerId,
            opponentId: room.opponentId || '',
          }
        }

        if (p === 'waiting' && room.status !== 'waiting') {
          // Opponent joined → challenger advances to battle; polling no longer needed
          stopPolling()
          advancePhase('battle')
        } else if (p === 'battle' && !isChallRef.current) {
          // Opponent polling: wait for challenger to flip
          if (room.status === 'completed' && room.challengerCard && room.opponentCard) {
            const rawResult = room.result || ''
            let winner: 'me' | 'opponent' | 'draw'
            if (rawResult === 'draw')            winner = 'draw'
            else if (rawResult === 'challenger_wins') winner = 'opponent'  // opponent's perspective
            else                                 winner = 'me'

            const myId = playerIdsRef.current.opponentId
            const pa = room.pointsAwarded || {}
            const myPoints = myId ? (pa[myId] || 0) : (Object.values(pa)[1] || 0)

            setBattleResult({
              myCard: room.opponentCard,
              opponentCard: room.challengerCard,
              winner,
              pointsAwarded: myPoints,
            })
            stopPolling()
            setFlipped(true)
            setTimeout(() => {
              phaseRef.current = 'result'
              setPhase('result')
              onComplete?.()
            }, 800)
          }
        }
      } catch {
        // Network error — keep polling
      }
    }

    pollingRef.current = setInterval(poll, 3000)

    // 5-minute hard timeout
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling()
      if (phaseRef.current === 'waiting' || phaseRef.current === 'battle') {
        advancePhase('timeout')
      }
    }, 5 * 60 * 1000)
  }, [stopPolling, advancePhase, onComplete])

  // Auto-join when mounted with an invite URL
  useEffect(() => {
    if (open && initialRoomCode && !hasInitialized.current) {
      hasInitialized.current = true
      handleJoinByCode(initialRoomCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Cleanup polling when modal closes
  useEffect(() => {
    if (!open) stopPolling()
    return () => stopPolling()
  }, [open, stopPolling])

  // ── Handlers ────────────────────────────────────────────────────

  async function handleCreateRoom() {
    advancePhase('creating')
    try {
      const res = await fetch('/api/games/card-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', referralCode }),
      })
      if (res.status === 401) { advancePhase('auth'); return }
      const data = await res.json()
      if (!data.success) {
        setErrorMsg(data.error || '建立房間失敗')
        advancePhase('error')
        return
      }
      const { roomCode: newCode, shareLink: sl } = data.data as { roomCode: string; shareLink: string }
      setCurrentRoomCode(newCode)
      roomCodeRef.current = newCode
      setShareLink(sl || '')
      isChallRef.current = true
      setIsChallenger(true)
      advancePhase('waiting')
      startPolling(newCode)
    } catch {
      setErrorMsg('網路錯誤，請重試')
      advancePhase('error')
    }
  }

  async function handleJoinByCode(code: string) {
    advancePhase('joining')
    try {
      const res = await fetch('/api/games/card-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomCode: code }),
      })
      if (res.status === 401) { advancePhase('auth'); return }
      const data = await res.json()
      if (!data.success) {
        setErrorMsg(data.error || '加入房間失敗')
        advancePhase('error')
        return
      }
      setCurrentRoomCode(code)
      roomCodeRef.current = code
      isChallRef.current = false
      setIsChallenger(false)
      advancePhase('battle')
      startPolling(code)
    } catch {
      setErrorMsg('網路錯誤，請重試')
      advancePhase('error')
    }
  }

  // Only the challenger calls this
  async function handlePlayBattle() {
    if (submittingRef.current || phaseRef.current !== 'battle') return
    submittingRef.current = true
    stopPolling()
    advancePhase('submitting')

    try {
      const res = await fetch('/api/games/card-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play', roomCode: roomCodeRef.current }),
      })
      if (res.status === 401) { advancePhase('auth'); return }
      const data = await res.json()
      if (!data.success) {
        setErrorMsg(data.error || '翻牌失敗')
        advancePhase('error')
        return
      }

      const {
        challengerCard,
        opponentCard,
        result: rawResult,
        pointsAwarded: pa,
      } = data.data as {
        challengerCard: Card
        opponentCard: Card
        result: string
        pointsAwarded: Record<string, number>
      }

      let winner: 'me' | 'opponent' | 'draw'
      if (rawResult === 'draw')            winner = 'draw'
      else if (rawResult === 'challenger_wins') winner = 'me'
      else                                 winner = 'opponent'

      const myId = playerIdsRef.current.challengerId
      const myPoints = myId ? (pa[myId] || 0) : (Object.values(pa)[0] || 0)

      setBattleResult({ myCard: challengerCard, opponentCard, winner, pointsAwarded: myPoints })
      setFlipped(true)
      setTimeout(() => {
        phaseRef.current = 'result'
        setPhase('result')
        onComplete?.()
      }, 800)
    } catch {
      setErrorMsg('網路錯誤，請重試')
      advancePhase('error')
    } finally {
      submittingRef.current = false
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(currentRoomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShareLink() {
    const url = shareLink || `${window.location.origin}/games/card-battle?room=${encodeURIComponent(currentRoomCode)}`
    const text = `來 CHIC KIM & MIU 跟我比大小！房間代碼：${currentRoomCode}\n${url}`
    if (navigator.share) {
      navigator.share({ title: '抽卡片比大小', text, url }).catch(() => { /* user cancelled */ })
    } else {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleShareResult() {
    if (!battleResult) return
    const myDisplay  = `${getSuitName(battleResult.myCard.suit)}${getRankDisplay(battleResult.myCard.rank)}`
    const oppDisplay = `${getSuitName(battleResult.opponentCard.suit)}${getRankDisplay(battleResult.opponentCard.rank)}`
    const resultText = battleResult.winner === 'me' ? '贏了' : battleResult.winner === 'opponent' ? '輸了' : '平手'
    const text = `【CHIC KIM & MIU 抽卡片比大小】\n我的卡片：${myDisplay} vs 對手：${oppDisplay}\n結果：${resultText}！獲得 ${battleResult.pointsAwarded} 點 ✨`
    if (navigator.share) {
      navigator.share({ title: '抽卡片比大小', text }).catch(() => { /* user cancelled */ })
    } else {
      navigator.clipboard.writeText(text)
    }
  }

  function handleBack() {
    stopPolling()
    setFlipped(false)
    setBattleResult(null)
    setCurrentRoomCode('')
    roomCodeRef.current = ''
    setShareLink('')
    setIsChallenger(false)
    isChallRef.current = false
    playerIdsRef.current = { challengerId: '', opponentId: '' }
    setJoinInput('')
    setErrorMsg('')
    advancePhase('lobby')
  }

  function handlePlayAgain() {
    setFlipped(false)
    setBattleResult(null)
    setCurrentRoomCode('')
    roomCodeRef.current = ''
    setShareLink('')
    setIsChallenger(false)
    isChallRef.current = false
    playerIdsRef.current = { challengerId: '', opponentId: '' }
    advancePhase('lobby')
  }

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
        {/* Close */}
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

        {/* ── Auth ──────────────────────────────────── */}
        {phase === 'auth' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 text-center py-6">
            <LogIn size={32} className="text-gold-500 mx-auto" />
            <p className="text-sm text-muted-foreground">請先登入才能參與對戰</p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
            >
              前往登入
            </Link>
            <button onClick={handleBack} className="block w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              返回
            </button>
          </motion.div>
        )}

        {/* ── Error ─────────────────────────────────── */}
        {phase === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 text-center py-6">
            <AlertCircle size={32} className="text-red-400 mx-auto" />
            <p className="text-sm text-muted-foreground">{errorMsg || '發生錯誤，請重試'}</p>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors"
            >
              返回
            </button>
          </motion.div>
        )}

        {/* ── Timeout ───────────────────────────────── */}
        {phase === 'timeout' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 text-center py-6">
            <AlertCircle size={32} className="text-amber-400 mx-auto" />
            <p className="text-sm font-medium">等待超時</p>
            <p className="text-sm text-muted-foreground">超過 5 分鐘仍未等到對手，房間已失效。</p>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors"
            >
              返回
            </button>
          </motion.div>
        )}

        {/* ── Lobby ─────────────────────────────────── */}
        {phase === 'lobby' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <p className="text-center text-sm text-muted-foreground">
              邀請好友一起來比大小，贏家獲得更多點數！
            </p>

            <button
              onClick={handleCreateRoom}
              className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors"
            >
              建立對戰房間
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
                  className="flex-1 px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-sm text-center tracking-[0.1em] uppercase placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
                <button
                  onClick={() => joinInput.trim() && handleJoinByCode(joinInput.trim())}
                  disabled={!joinInput.trim()}
                  className="px-5 py-3 bg-cream-200 text-foreground rounded-xl text-sm font-medium hover:bg-cream-300 transition-colors disabled:opacity-50"
                >
                  加入
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Creating / Joining spinner ─────────────── */}
        {(phase === 'creating' || phase === 'joining') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2 border-gold-500 border-t-transparent"
            />
            <p className="text-sm text-muted-foreground">
              {phase === 'creating' ? '建立房間中...' : '加入房間中...'}
            </p>
          </motion.div>
        )}

        {/* ── Waiting for opponent ──────────────────── */}
        {phase === 'waiting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="flex justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 rounded-full border-2 border-gold-500 border-t-transparent"
              />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              等待好友加入對戰
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                ...
              </motion.span>
            </p>

            <div className="bg-cream-50 rounded-2xl p-5 text-center space-y-3">
              <p className="text-xs text-muted-foreground">房間代碼</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-serif tracking-[0.2em] text-gold-600">{currentRoomCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="w-8 h-8 rounded-full bg-white border border-cream-200 flex items-center justify-center hover:bg-cream-100 transition-colors"
                >
                  {copied
                    ? <Check size={14} className="text-green-500" />
                    : <Copy size={14} className="text-gold-500" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleShareLink}
                className="flex-1 py-3 bg-[#06C755] text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <span className="font-bold text-base">LINE</span>分享
              </button>
              <button
                onClick={handleCopyCode}
                className="flex-1 py-3 bg-cream-200 text-foreground rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-cream-300 transition-colors"
              >
                <Copy size={14} />複製連結
              </button>
            </div>

            <button
              onClick={handleBack}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              取消等待
            </button>
          </motion.div>
        )}

        {/* ── Battle (cards + flip / waiting) ───────── */}
        {(phase === 'battle' || phase === 'submitting') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              房間 <span className="text-gold-500 font-medium">{currentRoomCode}</span>
            </p>

            <div className="flex items-center justify-center gap-4 md:gap-8">
              <FlippableCard
                card={battleResult?.myCard ?? null}
                flipped={flipped}
                label="我的卡片"
              />
              <div className="text-2xl font-serif text-gold-500">VS</div>
              <FlippableCard
                card={battleResult?.opponentCard ?? null}
                flipped={flipped}
                label="對手卡片"
              />
            </div>

            {isChallenger ? (
              <button
                onClick={handlePlayBattle}
                disabled={phase === 'submitting' || flipped}
                className="w-full py-4 bg-gold-500 text-white rounded-xl text-base font-medium tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'submitting' ? '翻牌中...' : '翻牌'}
              </button>
            ) : !flipped ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6 rounded-full border-2 border-gold-500 border-t-transparent"
                />
                <p className="text-sm text-muted-foreground">等待對手翻牌...</p>
              </div>
            ) : null}
          </motion.div>
        )}

        {/* ── Result ────────────────────────────────── */}
        {phase === 'result' && battleResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="inline-flex items-center gap-2 mb-3"
              >
                <Sparkles size={20} className="text-gold-500" />
                <span className="text-2xl font-serif">
                  {battleResult.winner === 'me'       && '你贏了！'}
                  {battleResult.winner === 'opponent'  && '對手贏了'}
                  {battleResult.winner === 'draw'      && '平手！'}
                </span>
                <Sparkles size={20} className="text-gold-500" />
              </motion.div>
            </div>

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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center p-4 bg-gold-500/10 rounded-xl"
            >
              <p className="text-sm font-medium">
                {battleResult.winner === 'me' && (
                  <>恭喜獲得 <span className="text-gold-600 font-bold">{battleResult.pointsAwarded} 點</span>！</>
                )}
                {battleResult.winner === 'opponent' && (
                  <>安慰獎 <span className="text-gold-600 font-bold">{battleResult.pointsAwarded} 點</span></>
                )}
                {battleResult.winner === 'draw' && (
                  <>平手！雙方各獲得 <span className="text-gold-600 font-bold">{battleResult.pointsAwarded} 點</span></>
                )}
              </p>
            </motion.div>

            <div className="space-y-2.5">
              <button
                onClick={handleShareResult}
                className="w-full py-3.5 bg-[#06C755] text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Share2 size={14} />分享戰果
              </button>
              <button
                onClick={handlePlayAgain}
                className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gold-600 transition-colors"
              >
                <RotateCcw size={14} />再來一局
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                關閉
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
