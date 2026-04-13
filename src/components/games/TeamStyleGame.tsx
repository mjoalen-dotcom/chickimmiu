'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Crown, Star, Trophy, Check, Vote, Share2, Copy, Heart } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

interface Member {
  name: string
  avatar: string
  ready: boolean
  outfit?: string
  desc?: string
  votes?: number
}

const THEMES = [
  { emoji: '🌸', label: '春日野餐' },
  { emoji: '🏖️', label: '海邊度假' },
  { emoji: '🎄', label: '聖誕派對' },
  { emoji: '💼', label: '面試穿搭' },
  { emoji: '🎭', label: '復古 Y2K' },
  { emoji: '🌙', label: '約會之夜' },
]

const DEMO_MEMBERS: Member[] = [
  { name: '你', avatar: '🙋‍♀️', ready: true, outfit: '👗🌸👡✨', desc: '碎花野餐風', votes: 0 },
  { name: '小花', avatar: '🌸', ready: true, outfit: '👚👖👟🎀', desc: '休閒甜美風', votes: 0 },
  { name: '美美', avatar: '✨', ready: true, outfit: '🧥👗💍👠', desc: '優雅名媛風', votes: 0 },
  { name: '璀璀', avatar: '🌙', ready: false, outfit: undefined, desc: undefined, votes: 0 },
]

const OUTFIT_CHOICES = [
  { emoji: '👗🌸👡✨', label: '碎花野餐風' },
  { emoji: '👚👖👟🎀', label: '休閒甜美風' },
  { emoji: '🧥👗💍👠', label: '優雅名媛風' },
  { emoji: '👕🩳🎒👟', label: '運動活力風' },
  { emoji: '👘🌺👒💐', label: '度假波希米亞' },
  { emoji: '🥻📿👠🧣', label: '復古典雅風' },
]

export function TeamStyleGame({ settings }: Props) {
  const [phase, setPhase] = useState<'create' | 'lobby' | 'submit' | 'vote' | 'result'>('create')
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>(DEMO_MEMBERS)
  const [copied, setCopied] = useState(false)
  const [myOutfit, setMyOutfit] = useState<string | null>(null)
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [winner, setWinner] = useState<Member | null>(null)

  const joinPoints = (settings.joinPoints as number) || 5
  const winnerPoints = (settings.winnerPoints as number) || 30

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreateRoom = () => {
    if (!selectedTheme) return
    setPhase('lobby')
  }

  const handleStartGame = () => {
    setPhase('submit')
  }

  const handleSubmitOutfit = () => {
    if (!myOutfit) return
    const choice = OUTFIT_CHOICES.find((c) => c.emoji === myOutfit)
    setMembers((prev) =>
      prev.map((m) =>
        m.name === '你' ? { ...m, ready: true, outfit: myOutfit, desc: choice?.label || '自選穿搭' } : m
      )
    )
    setPhase('vote')
  }

  const handleVote = (name: string) => {
    if (votedFor || name === '你') return
    setVotedFor(name)
    const updated = members.map((m) =>
      m.name === name ? { ...m, votes: (m.votes || 0) + 1 } : m
    )
    setMembers(updated)
    // Auto reveal after vote
    setTimeout(() => {
      const w = [...updated].filter((m) => m.outfit).sort((a, b) => (b.votes || 0) - (a.votes || 0))[0]
      setWinner(w)
      setPhase('result')
    }, 1500)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Create Phase */}
      {phase === 'create' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-200 p-5 text-center">
            <Users size={28} className="mx-auto text-gold-600 mb-3" />
            <h3 className="font-serif text-lg mb-1">開設穿搭房 👗</h3>
            <p className="text-xs text-muted-foreground">選擇主題，邀請好友一起穿搭 PK！</p>
          </div>

          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <p className="text-sm font-serif mb-3">選擇主題</p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((theme) => (
                <motion.button
                  key={theme.label}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedTheme(theme.label)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    selectedTheme === theme.label
                      ? 'bg-gold-500/10 border-2 border-gold-400'
                      : 'bg-cream-50 border border-cream-200 hover:border-gold-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">{theme.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{theme.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!selectedTheme}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          >
            建立房間 ✨
          </button>
        </div>
      )}

      {/* Lobby Phase */}
      {phase === 'lobby' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-violet-400 to-purple-500 rounded-2xl p-4 text-white text-center">
            <p className="text-sm opacity-80">主題</p>
            <h3 className="font-serif text-lg">{selectedTheme}</h3>
          </div>

          {/* Room Code */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">房間代碼</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl font-mono font-bold tracking-widest text-gold-600">TEAM-4419</span>
              <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-cream-100 transition-colors">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-muted-foreground" />}
              </button>
            </div>
            <button
              onClick={handleCopy}
              className="mt-2 inline-flex items-center gap-1 text-xs text-gold-600"
            >
              <Share2 size={12} />
              分享邀請連結
            </button>
          </div>

          {/* Members */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <p className="text-sm font-serif mb-3">房間成員 ({members.length}/6)</p>
            <div className="space-y-2">
              {members.map((m, i) => (
                <motion.div
                  key={m.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 px-3 py-2.5 bg-cream-50 rounded-xl"
                >
                  <span className="text-lg">{m.avatar}</span>
                  <span className="text-sm flex-1">{m.name}</span>
                  {i === 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-600">房主</span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${m.ready ? 'bg-green-400' : 'bg-cream-300 animate-pulse'}`} />
                </motion.div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide"
          >
            開始穿搭！🎮
          </button>
          <p className="text-center text-[10px] text-muted-foreground">
            參與即獲得 {joinPoints} 點 · 冠軍額外 +{winnerPoints} 點
          </p>
        </div>
      )}

      {/* Submit Phase */}
      {phase === 'submit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-200 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">主題：{selectedTheme}</p>
            <p className="text-sm font-serif">選擇你的穿搭 👗</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OUTFIT_CHOICES.map((choice) => (
              <motion.button
                key={choice.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMyOutfit(choice.emoji)}
                className={`p-4 rounded-2xl text-center transition-all ${
                  myOutfit === choice.emoji
                    ? 'bg-gold-500/10 border-2 border-gold-400'
                    : 'bg-white border border-cream-200 hover:border-gold-300'
                }`}
              >
                <span className="text-2xl block mb-2">{choice.emoji}</span>
                <span className="text-xs text-muted-foreground">{choice.label}</span>
              </motion.button>
            ))}
          </div>

          <button
            onClick={handleSubmitOutfit}
            disabled={!myOutfit}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          >
            確認提交 ✨
          </button>
        </div>
      )}

      {/* Vote Phase */}
      {phase === 'vote' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-200 p-4 text-center">
            <Star size={24} className="mx-auto text-gold-500 mb-2" />
            <h3 className="font-serif text-lg mb-1">投票時間！</h3>
            <p className="text-xs text-muted-foreground">選出你心目中的最佳穿搭（不能投自己）</p>
          </div>

          <div className="space-y-3">
            {members.filter((m) => m.outfit).map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-white rounded-2xl border overflow-hidden ${
                  votedFor === m.name ? 'border-gold-400 bg-gold-500/5' : 'border-cream-200'
                }`}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-cream-50 flex items-center justify-center text-2xl shrink-0">
                    {m.outfit}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{m.avatar}</span>
                      <span className="text-sm font-medium">{m.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  {m.name !== '你' && (
                    <button
                      onClick={() => handleVote(m.name)}
                      disabled={Boolean(votedFor)}
                      className={`px-4 py-2 rounded-xl text-xs transition-all shrink-0 ${
                        votedFor === m.name
                          ? 'bg-pink-50 text-pink-500'
                          : votedFor
                            ? 'bg-cream-50 text-cream-300'
                            : 'bg-cream-50 text-muted-foreground hover:bg-pink-50 hover:text-pink-500'
                      }`}
                    >
                      <Heart size={14} fill={votedFor === m.name ? 'currentColor' : 'none'} className="inline mr-1" />
                      投票
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {votedFor && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-gold-600">
              ✨ 已投票！正在統計結果...
            </motion.p>
          )}
        </div>
      )}

      {/* Result Phase */}
      {phase === 'result' && winner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Winner Card */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10 }}
            className="bg-white rounded-2xl border border-gold-300 p-6 text-center"
          >
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Crown size={32} className="mx-auto text-amber-500 mb-2" />
            </motion.div>
            <h3 className="font-serif text-lg mb-3">穿搭冠軍 🎉</h3>
            <span className="text-2xl">{winner.avatar}</span>
            <p className="text-lg font-bold mt-2">{winner.name}</p>
            <p className="text-3xl mt-2">{winner.outfit}</p>
            <p className="text-xs text-muted-foreground mt-2">{winner.desc}</p>
            <div className="mt-4 bg-gradient-to-r from-gold-400 to-gold-500 rounded-xl p-3 text-white">
              <p className="text-sm">
                <Trophy size={14} className="inline mr-1" />
                獲得 {winnerPoints} 點！
              </p>
            </div>
          </motion.div>

          {/* All Results */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <p className="text-sm font-serif mb-3">最終排名</p>
            {[...members]
              .filter((m) => m.outfit)
              .sort((a, b) => (b.votes || 0) - (a.votes || 0))
              .map((m, i) => (
                <div key={m.name} className="flex items-center gap-3 py-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' : 'bg-cream-100 text-muted-foreground'
                  }`}>
                    {i + 1}
                  </span>
                  <span>{m.avatar}</span>
                  <span className="text-sm flex-1">{m.name}</span>
                  <span className="text-lg">{m.outfit?.slice(0, 4)}</span>
                  <span className="text-xs text-pink-500 flex items-center gap-0.5">
                    <Heart size={10} fill="currentColor" />
                    {m.votes || 0}
                  </span>
                </div>
              ))}
          </div>

          <button
            onClick={() => {
              setPhase('create')
              setSelectedTheme(null)
              setMyOutfit(null)
              setVotedFor(null)
              setWinner(null)
              setMembers(DEMO_MEMBERS)
            }}
            className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide"
          >
            再開一局 🔄
          </button>
        </motion.div>
      )}
    </div>
  )
}
