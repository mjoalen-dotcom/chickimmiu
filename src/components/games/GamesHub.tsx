'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Trophy, Medal, TrendingUp, Crown, Lock } from 'lucide-react'
import { GAME_CATEGORIES, GAME_DEFS } from '@/lib/games/gameConfig'
import type { EnabledGame } from '@/lib/games/getEnabledGames'

// ── Demo 排行榜 ──
const DEMO_LEADERBOARD = [
  { rank: 1, name: '璀*天后', points: 2850, tier: '璀璨天后', badge: '👑' },
  { rank: 2, name: '星*皇后', points: 2340, tier: '星耀皇后', badge: '🌟' },
  { rank: 3, name: '金*女王', points: 1890, tier: '金曦女王', badge: '💎' },
  { rank: 4, name: '優*仙子', points: 1230, tier: '曦漾仙子', badge: '🦋' },
  { rank: 5, name: '曦*仙子', points: 980, tier: '曦漾仙子', badge: '🌸' },
]

const BADGES = [
  { id: 'first_game', name: '初次冒險', icon: '🎮', desc: '完成第一場遊戲', earned: true },
  { id: 'lucky_star', name: '幸運之星', icon: '⭐', desc: '第一次獲獎', earned: true },
  { id: 'streak_3', name: '連勝達人', icon: '🔥', desc: '連續獲勝 3 場', earned: false },
  { id: 'master_50', name: '遊戲大師', icon: '🎯', desc: '累計遊玩 50 場', earned: false },
  { id: 'battle_king', name: '挑戰王者', icon: '👑', desc: '對戰勝利 10 場', earned: false },
  { id: 'social_butterfly', name: '社交蝴蝶', icon: '🦋', desc: '完成 5 場好友對戰', earned: false },
  { id: 'points_rich', name: '點數富翁', icon: '💰', desc: '遊戲累計獲得 1000 點', earned: false },
  { id: 'hero_100', name: '百戰英雄', icon: '🏅', desc: '累計遊玩 100 場', earned: false },
]

interface Props {
  enabledGames: EnabledGame[]
  todayGamePoints?: number | null
  badgeCount?: number | null
}

export function GamesHub({ enabledGames, todayGamePoints = null, badgeCount = null }: Props) {
  const [activeTab, setActiveTab] = useState<'games' | 'leaderboard' | 'badges'>('games')
  const [activeCat, setActiveCat] = useState<string>('all')

  const enabledIds = new Set(enabledGames.map((g) => g.id))

  // 根據分類過濾
  const filteredGames = activeCat === 'all'
    ? GAME_DEFS
    : GAME_DEFS.filter((g) => g.category === activeCat)

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-gold-500/10 via-cream-100 to-blush-50 border-b border-cream-200">
        <div className="container py-12 md:py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/10 text-gold-600 text-xs tracking-widest mb-4">
            <Sparkles size={14} />
            REWARDS & GAMES
          </div>
          <h1 className="text-3xl md:text-4xl font-serif mb-3">會員遊樂園</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            玩遊戲贏取點數與購物金，邀請好友對戰更有趣！
            <br />
            會員等級越高，免費次數越多、獲獎機率越大。
          </p>

          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="text-center">
              <p className="text-lg font-serif text-gold-600">
                {todayGamePoints === null ? '—' : todayGamePoints.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">今日已獲點數</p>
            </div>
            <div className="w-px h-8 bg-cream-200" />
            <div className="text-center">
              <p className="text-lg font-serif text-gold-600">{enabledGames.length}</p>
              <p className="text-[10px] text-muted-foreground">已開放遊戲</p>
            </div>
            <div className="w-px h-8 bg-cream-200" />
            <div className="text-center">
              <p className="text-lg font-serif text-gold-600">
                {badgeCount === null ? '—' : badgeCount}
              </p>
              <p className="text-[10px] text-muted-foreground">已獲得徽章</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-10 md:py-16">
        {/* ── Tab Navigation ── */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { key: 'games' as const, label: '所有遊戲', icon: Sparkles },
            { key: 'leaderboard' as const, label: '排行榜', icon: Trophy },
            { key: 'badges' as const, label: '我的徽章', icon: Medal },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-foreground text-cream-50'
                  : 'bg-white border border-cream-200 text-foreground/70 hover:border-gold-400'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════ Games Tab ═══════ */}
        {activeTab === 'games' && (
          <div className="space-y-10 animate-fade-in">
            {/* Category filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveCat('all')}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                  activeCat === 'all'
                    ? 'bg-gold-500 text-white'
                    : 'bg-white border border-cream-200 hover:border-gold-400'
                }`}
              >
                全部遊戲
              </button>
              {GAME_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                    activeCat === cat.id
                      ? 'bg-gold-500 text-white'
                      : 'bg-white border border-cream-200 hover:border-gold-400'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Games grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredGames.map((game, i) => {
                  const isEnabled = enabledIds.has(game.id)
                  return (
                    <motion.div
                      key={game.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <GameCard game={game} isEnabled={isEnabled} />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {enabledGames.length === 0 && (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🎮</p>
                <p className="text-lg font-serif mb-2">遊戲即將上線</p>
                <p className="text-sm text-muted-foreground">我們正在準備精彩的遊戲，敬請期待！</p>
              </div>
            )}

            {/* Tier benefits */}
            <div className="bg-white rounded-2xl border border-cream-200 p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Crown size={20} className="text-gold-500" />
                <h3 className="font-serif text-lg">等級越高、福利越多</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cream-200">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">會員等級</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">每月轉盤</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">每日刮刮樂</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">每日對戰</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">穿搭挑戰</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">獎勵倍率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tier: '優雅初遇者', spins: 0, scratches: 1, battles: 3, fashion: 3, multiplier: '1x' },
                      { tier: '曦漾仙子', spins: 1, scratches: 1, battles: 3, fashion: 3, multiplier: '1.1x' },
                      { tier: '優漾女神', spins: 2, scratches: 2, battles: 3, fashion: 5, multiplier: '1.2x' },
                      { tier: '金曦女王', spins: 3, scratches: 2, battles: 3, fashion: 5, multiplier: '1.3x' },
                      { tier: '星耀皇后', spins: 5, scratches: 3, battles: 3, fashion: 8, multiplier: '1.5x' },
                      { tier: '璀璨天后', spins: 10, scratches: 5, battles: 3, fashion: 10, multiplier: '2x' },
                    ].map((t) => (
                      <tr key={t.tier} className="border-b border-cream-100 last:border-none">
                        <td className="py-2.5 pr-4 font-medium">{t.tier}</td>
                        <td className="text-center py-2.5 px-3 text-gold-600">{t.spins}</td>
                        <td className="text-center py-2.5 px-3 text-gold-600">{t.scratches}</td>
                        <td className="text-center py-2.5 px-3 text-gold-600">{t.battles}</td>
                        <td className="text-center py-2.5 px-3 text-gold-600">{t.fashion}</td>
                        <td className="text-center py-2.5 px-3 text-gold-600 font-medium">{t.multiplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ Leaderboard Tab ═══════ */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2">
              {['今日', '本週', '本月', '全部'].map((period, i) => (
                <button
                  key={period}
                  className={`px-4 py-1.5 rounded-full text-xs border transition-colors ${
                    i === 0 ? 'bg-foreground text-cream-50 border-foreground' : 'border-cream-200 hover:border-gold-400'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Podium */}
            <div className="flex items-end justify-center gap-4 py-8">
              <PodiumEntry entry={DEMO_LEADERBOARD[1]} size="sm" color="gray" height="h-20" />
              <PodiumEntry entry={DEMO_LEADERBOARD[0]} size="lg" color="gold" height="h-28" crown />
              <PodiumEntry entry={DEMO_LEADERBOARD[2]} size="sm" color="amber" height="h-14" />
            </div>

            <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
              {DEMO_LEADERBOARD.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-4 px-6 py-4 border-b border-cream-100 last:border-none ${
                    entry.rank <= 3 ? 'bg-gold-500/5' : ''
                  }`}
                >
                  <span className={`w-8 text-center font-serif text-lg ${
                    entry.rank === 1 ? 'text-gold-600' : entry.rank === 2 ? 'text-gray-500' : entry.rank === 3 ? 'text-amber-600' : 'text-muted-foreground'
                  }`}>
                    {entry.rank}
                  </span>
                  <span className="text-lg">{entry.badge}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="text-[10px] text-muted-foreground">{entry.tier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gold-600">{entry.points.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">點數</p>
                  </div>
                  <TrendingUp size={14} className="text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ Badges Tab ═══════ */}
        {activeTab === 'badges' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {BADGES.map((badge) => (
                <div
                  key={badge.id}
                  className={`rounded-2xl border p-5 text-center transition-all ${
                    badge.earned
                      ? 'bg-gradient-to-br from-gold-500/10 to-cream-100 border-gold-500/30'
                      : 'bg-cream-50 border-cream-200 opacity-50 grayscale'
                  }`}
                >
                  <span className="text-3xl block mb-3">{badge.icon}</span>
                  <p className="text-sm font-medium mb-1">{badge.name}</p>
                  <p className="text-[10px] text-muted-foreground">{badge.desc}</p>
                  {badge.earned && (
                    <span className="inline-block mt-2 text-[10px] text-gold-600 bg-gold-500/10 px-2 py-0.5 rounded-full">
                      已獲得
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// ── Game Card ──
function GameCard({ game, isEnabled }: { game: typeof GAME_DEFS[number]; isEnabled: boolean }) {
  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all group ${
      isEnabled
        ? 'bg-white border-cream-200 hover:shadow-lg hover:-translate-y-1'
        : 'bg-cream-100/50 border-cream-200/50'
    }`}>
      {/* Gradient header */}
      <div className={`h-24 bg-gradient-to-br ${game.color} flex items-center justify-center relative ${
        !isEnabled ? 'opacity-40 grayscale' : ''
      }`}>
        <span className="text-4xl drop-shadow-sm group-hover:scale-110 transition-transform">
          {game.icon}
        </span>
        {!isEnabled && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <Lock size={24} className="text-white/80" />
          </div>
        )}
      </div>

      <div className="p-5">
        {/* Category tag */}
        <span className="text-[10px] tracking-wider text-gold-600 bg-gold-500/10 px-2 py-0.5 rounded-full">
          {game.categoryLabel}
        </span>

        <h3 className="text-base font-serif mt-2 mb-1">{game.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">
          {game.description}
        </p>

        {isEnabled ? (
          <Link
            href={`/games/${game.slug}`}
            className="block w-full py-2.5 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide text-center hover:bg-foreground/90 transition-colors"
          >
            開始遊戲
          </Link>
        ) : (
          <div className="w-full py-2.5 bg-cream-200 text-cream-400 rounded-xl text-sm tracking-wide text-center cursor-not-allowed">
            即將上線
          </div>
        )}
      </div>
    </div>
  )
}

// ── Podium Entry ──
function PodiumEntry({ entry, size, color, height, crown }: {
  entry: typeof DEMO_LEADERBOARD[number]
  size: 'sm' | 'lg'
  color: string
  height: string
  crown?: boolean
}) {
  const circleSize = size === 'lg' ? 'w-20 h-20' : 'w-16 h-16'
  const barWidth = size === 'lg' ? 'w-20' : 'w-16'
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs'
  const numSize = size === 'lg' ? 'text-xl' : 'text-lg'
  const colorMap: Record<string, string> = {
    gold: 'from-gold-400 to-gold-600',
    gray: 'from-gray-300 to-gray-400',
    amber: 'from-amber-600 to-amber-700',
  }
  const barColorMap: Record<string, string> = {
    gold: 'bg-gold-500/20',
    gray: 'bg-gray-200',
    amber: 'bg-amber-100',
  }

  return (
    <div className={`text-center ${crown ? '-mt-4' : ''}`}>
      {crown && <div className="text-2xl mb-1">👑</div>}
      <div className={`${circleSize} mx-auto rounded-full bg-gradient-to-br ${colorMap[color]} flex items-center justify-center text-white ${numSize} font-serif mb-2 ${crown ? 'ring-4 ring-gold-500/20' : ''}`}>
        {entry.rank}
      </div>
      <p className={`${textSize} font-medium`}>{entry.name}</p>
      <p className="text-[10px] text-gold-600">{entry.points.toLocaleString()} pt</p>
      <div className={`${barWidth} ${height} mx-auto mt-2 ${barColorMap[color]} rounded-t-lg`} />
    </div>
  )
}
