import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

// ── Types ──

interface PrizeEntry {
  prize: string
  type: 'points' | 'credit' | 'coupon'
  amount: number
  weight: number
}

interface GameConfig {
  freePlaysPerDay: Record<string, number>
  pointsCost: number
  prizeTable: PrizeEntry[]
  dailyLimit: number
}

interface DailyPlaysResult {
  played: number
  remaining: number
  canPlay: boolean
  freePlaysLeft: number
  requiresPoints: boolean
}

interface DrawnPrize {
  prize: string
  type: 'points' | 'credit' | 'coupon'
  amount: number
}

interface RecordGamePlayParams {
  userId: string
  gameType: string
  outcome: 'win' | 'lose' | 'draw' | 'completed'
  prizeType?: 'points' | 'credit' | 'coupon' | 'badge' | 'none'
  prizeAmount?: number
  prizeDescription?: string
  couponCode?: string
  pointsSpent?: number
  metadata?: Record<string, unknown>
  tierSlug?: string
  creditScore?: number
  referralCode?: string
}

interface PlayerStats {
  totalGames: number
  totalWins: number
  totalPointsEarned: number
  currentStreak: number
  badges: string[]
}

// ── Default Configs ──

export const GAME_CONFIGS: Record<string, GameConfig> = {
  spin_wheel: {
    freePlaysPerDay: { ordinary: 1, bronze: 2, silver: 2, gold: 3, platinum: 3, diamond: 5 },
    pointsCost: 50,
    prizeTable: [
      { prize: '10 點數', type: 'points', amount: 10, weight: 35 },
      { prize: '20 點數', type: 'points', amount: 20, weight: 25 },
      { prize: '50 點數', type: 'points', amount: 50, weight: 15 },
      { prize: '100 點數', type: 'points', amount: 100, weight: 8 },
      { prize: 'NT$10 購物金', type: 'credit', amount: 10, weight: 10 },
      { prize: 'NT$50 購物金', type: 'credit', amount: 50, weight: 4 },
      { prize: '95 折優惠券', type: 'coupon', amount: 5, weight: 2 },
      { prize: '9 折優惠券', type: 'coupon', amount: 10, weight: 1 },
    ],
    dailyLimit: 10,
  },
  scratch_card: {
    freePlaysPerDay: { ordinary: 1, bronze: 1, silver: 2, gold: 2, platinum: 3, diamond: 4 },
    pointsCost: 30,
    prizeTable: [
      { prize: '5 點數', type: 'points', amount: 5, weight: 40 },
      { prize: '15 點數', type: 'points', amount: 15, weight: 25 },
      { prize: '30 點數', type: 'points', amount: 30, weight: 15 },
      { prize: '80 點數', type: 'points', amount: 80, weight: 5 },
      { prize: 'NT$5 購物金', type: 'credit', amount: 5, weight: 10 },
      { prize: 'NT$30 購物金', type: 'credit', amount: 30, weight: 3 },
      { prize: '95 折優惠券', type: 'coupon', amount: 5, weight: 2 },
    ],
    dailyLimit: 8,
  },
  daily_checkin: {
    freePlaysPerDay: { ordinary: 1, bronze: 1, silver: 1, gold: 1, platinum: 1, diamond: 1 },
    pointsCost: 0,
    prizeTable: [
      { prize: '每日簽到 10 點', type: 'points', amount: 10, weight: 100 },
    ],
    dailyLimit: 1,
  },
  fashion_challenge: {
    freePlaysPerDay: { ordinary: 2, bronze: 3, silver: 3, gold: 4, platinum: 5, diamond: 6 },
    pointsCost: 20,
    prizeTable: [], // Fashion challenge uses its own scoring
    dailyLimit: 10,
  },
}

// ── Helpers ──

/**
 * Asia/Taipei 的今日 YYYY-MM-DD。
 * Intl 的 en-CA locale 本身就是 YYYY-MM-DD，Asia/Taipei 是 UTC+8 無 DST。
 */
export function getTpeDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Asia/Taipei 今日 00:00:00 的 UTC ISO string (供 DB 時間範圍查詢用) */
function getStartOfDay(): string {
  const tpeDate = getTpeDateString()
  // `${YYYY-MM-DD}T00:00:00+08:00` → parse 為 UTC 的 ISO
  return new Date(`${tpeDate}T00:00:00+08:00`).toISOString()
}

/** Asia/Taipei 今日 23:59:59.999 的 UTC ISO string */
function getEndOfDay(): string {
  const tpeDate = getTpeDateString()
  return new Date(`${tpeDate}T23:59:59.999+08:00`).toISOString()
}

/** Asia/Taipei 的週起始（週日 00:00）的 YYYY-MM-DD key */
function getTpeWeeklyKey(): string {
  const todayTpe = getTpeDateString() // e.g. 2026-04-16
  const todayAsUtc = new Date(`${todayTpe}T00:00:00Z`)
  const dayOfWeek = todayAsUtc.getUTCDay() // 0=Sun
  const sunday = new Date(todayAsUtc)
  sunday.setUTCDate(todayAsUtc.getUTCDate() - dayOfWeek)
  return sunday.toISOString().split('T')[0]
}

/** Asia/Taipei 的 YYYY-MM month key */
function getTpeMonthlyKey(): string {
  const tpeDate = getTpeDateString() // YYYY-MM-DD
  return tpeDate.substring(0, 7) // YYYY-MM
}

async function getUserTierSlug(userId: string): Promise<string> {
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: userId })
  const userData = user as unknown as Record<string, unknown>

  if (!userData.memberTier) return 'ordinary'

  // memberTier can be a relationship ID or populated object
  if (typeof userData.memberTier === 'object' && userData.memberTier !== null) {
    const tier = userData.memberTier as unknown as Record<string, unknown>
    return (tier.slug as string) || 'ordinary'
  }

  // If it's an ID, fetch the tier
  try {
    const tier = await payload.findByID({
      collection: 'membership-tiers',
      id: userData.memberTier as string,
    })
    return (tier as unknown as Record<string, unknown>).slug as string || 'ordinary'
  } catch {
    return 'ordinary'
  }
}

// ── 1. checkDailyPlays ──

export async function checkDailyPlays(
  userId: string,
  gameType: string,
): Promise<DailyPlaysResult> {
  const payload = await getPayload({ config })
  const gameConfig = GAME_CONFIGS[gameType]

  if (!gameConfig) {
    return { played: 0, remaining: 0, canPlay: false, freePlaysLeft: 0, requiresPoints: false }
  }

  const tierSlug = await getUserTierSlug(userId)
  const freePlays = gameConfig.freePlaysPerDay[tierSlug] ?? gameConfig.freePlaysPerDay.ordinary ?? 1

  const where: Record<string, unknown> = {
    and: [
      { player: { equals: userId } },
      { gameType: { equals: gameType } },
      { createdAt: { greater_than_equal: getStartOfDay() } },
      { createdAt: { less_than_equal: getEndOfDay() } },
      { status: { equals: 'completed' } },
    ],
  }

  const result = await payload.find({
    collection: 'mini-game-records',
    where: where as Where,
    limit: 0,
  })

  const played = result.totalDocs
  const remaining = Math.max(0, gameConfig.dailyLimit - played)
  const freePlaysLeft = Math.max(0, freePlays - played)
  const requiresPoints = played >= freePlays
  const canPlay = remaining > 0

  return { played, remaining, canPlay, freePlaysLeft, requiresPoints }
}

// ── 2. drawPrize ──

export function drawPrize(
  gameType: string,
  tierSlug: string,
  creditScore: number = 100,
): DrawnPrize | null {
  const gameConfig = GAME_CONFIGS[gameType]
  if (!gameConfig || gameConfig.prizeTable.length === 0) return null

  // Higher tiers and credit scores get slight weight boosts to better prizes
  // Tier bonus: ordinary=0, bronze=0.02, silver=0.04, gold=0.06, platinum=0.08, diamond=0.1
  const tierBonusMap: Record<string, number> = {
    ordinary: 0,
    bronze: 0.02,
    silver: 0.04,
    gold: 0.06,
    platinum: 0.08,
    diamond: 0.1,
  }
  const tierBonus = tierBonusMap[tierSlug] ?? 0
  // Credit score bonus: max 0.05 extra at 100 credit score
  const creditBonus = (creditScore / 100) * 0.05

  // Adjust weights: better prizes (higher amount) get a small boost
  const sortedByAmount = [...gameConfig.prizeTable].sort((a, b) => a.amount - b.amount)
  const maxAmount = sortedByAmount[sortedByAmount.length - 1]?.amount ?? 1

  const adjustedEntries = gameConfig.prizeTable.map((entry) => {
    const relativeValue = entry.amount / maxAmount // 0-1, higher = better prize
    const boost = 1 + relativeValue * (tierBonus + creditBonus)
    return { ...entry, adjustedWeight: entry.weight * boost }
  })

  const totalWeight = adjustedEntries.reduce((sum, e) => sum + e.adjustedWeight, 0)
  let random = Math.random() * totalWeight

  for (const entry of adjustedEntries) {
    random -= entry.adjustedWeight
    if (random <= 0) {
      return { prize: entry.prize, type: entry.type, amount: entry.amount }
    }
  }

  // Fallback to last entry
  const last = adjustedEntries[adjustedEntries.length - 1]
  return { prize: last.prize, type: last.type, amount: last.amount }
}

// ── 3. recordGamePlay ──

export async function recordGamePlay(params: RecordGamePlayParams): Promise<Record<string, unknown>> {
  const payload = await getPayload({ config })

  // Create the game record
  const record = await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      player: params.userId,
      gameType: params.gameType,
      result: {
        outcome: params.outcome,
        prizeType: params.prizeType || 'none',
        prizeAmount: params.prizeAmount || 0,
        prizeDescription: params.prizeDescription || '',
        couponCode: params.couponCode || '',
      },
      pointsSpent: params.pointsSpent || 0,
      metadata: params.metadata || {},
      playerTier: params.tierSlug || '',
      playerCreditScore: params.creditScore || 0,
      referralCode: params.referralCode || '',
      status: 'completed',
    } as never,
  })

  // Award points or credit to user if applicable
  if (params.prizeType === 'points' && params.prizeAmount && params.prizeAmount > 0) {
    const user = await payload.findByID({ collection: 'users', id: params.userId })
    const userData = user as unknown as Record<string, unknown>
    const currentPoints = (userData.points as number) || 0
    await (payload.update as Function)({
      collection: 'users',
      id: params.userId,
      data: { points: currentPoints + params.prizeAmount } as never,
    })
  }

  if (params.prizeType === 'credit' && params.prizeAmount && params.prizeAmount > 0) {
    const user = await payload.findByID({ collection: 'users', id: params.userId })
    const userData = user as unknown as Record<string, unknown>
    const currentCredit = (userData.shoppingCredit as number) || 0
    await (payload.update as Function)({
      collection: 'users',
      id: params.userId,
      data: { shoppingCredit: currentCredit + params.prizeAmount } as never,
    })
  }

  // Deduct points cost if applicable
  if (params.pointsSpent && params.pointsSpent > 0) {
    const user = await payload.findByID({ collection: 'users', id: params.userId })
    const userData = user as unknown as Record<string, unknown>
    const currentPoints = (userData.points as number) || 0
    await (payload.update as Function)({
      collection: 'users',
      id: params.userId,
      data: { points: Math.max(0, currentPoints - params.pointsSpent) } as never,
    })
  }

  return record as unknown as Record<string, unknown>
}

// ── 3.5. performDailyCheckin ──
// Phase 5.6：daily check-in with streak tracking (Asia/Taipei 日界)
//   - same day: reject
//   - next day (dayDiff === 1): consecutive += 1, totalCheckIns += 1
//   - gap > 1 day: consecutive = 1 (reset), totalCheckIns += 1
//   - first time: consecutive = 1, totalCheckIns = 1
// 獎勵：day1to6 用基礎 10 點；第 7 天（consecutive === 7）加倍為 50 點。
// 搭配 DailyCheckinGame.tsx 前端 UI（UI 在另一批接入）。

interface DailyCheckinResult {
  prize: DrawnPrize
  totalCheckIns: number
  consecutiveCheckIns: number
  lastCheckInDate: string
  streakReset: boolean
  streakBonus: boolean // 連續 7 天當日觸發
  record: Record<string, unknown>
}

/**
 * Pure decision function — 給定 lastDate/prevTotal/prevConsec + todayTpe，
 * 計算 streak 新狀態與獎勵。無副作用，易於單元測試。
 */
export function computeCheckinOutcome(params: {
  lastDate: string
  prevTotal: number
  prevConsec: number
  todayTpe: string
}): {
  newTotal: number
  newConsec: number
  streakReset: boolean
  streakBonus: boolean
  prizeAmount: number
  prizeDescription: string
} {
  const { lastDate, prevTotal, prevConsec, todayTpe } = params

  if (lastDate === todayTpe) {
    throw new Error('今日已簽到')
  }

  const dayDiff = lastDate
    ? Math.round(
        (Date.parse(`${todayTpe}T00:00:00Z`) - Date.parse(`${lastDate}T00:00:00Z`)) / 86_400_000,
      )
    : 0

  let newConsec: number
  let streakReset = false
  if (!lastDate) {
    newConsec = 1
  } else if (dayDiff === 1) {
    newConsec = prevConsec + 1
  } else {
    newConsec = 1
    streakReset = true
  }

  const newTotal = prevTotal + 1
  const streakBonus = newConsec === 7
  const prizeAmount = streakBonus ? 50 : 10
  const prizeDescription = streakBonus
    ? `連續簽到 7 天獎勵 ${prizeAmount} 點`
    : `每日簽到 ${prizeAmount} 點`

  return { newTotal, newConsec, streakReset, streakBonus, prizeAmount, prizeDescription }
}

export async function performDailyCheckin(userId: string): Promise<DailyCheckinResult> {
  const payload = await getPayload({ config })
  const todayTpe = getTpeDateString()

  const user = await payload.findByID({ collection: 'users', id: userId })
  const userData = user as unknown as Record<string, unknown>

  const outcome = computeCheckinOutcome({
    lastDate: (userData.lastCheckInDate as string) || '',
    prevTotal: (userData.totalCheckIns as number) || 0,
    prevConsec: (userData.consecutiveCheckIns as number) || 0,
    todayTpe,
  })

  const { newTotal, newConsec, streakReset, streakBonus, prizeAmount, prizeDescription } = outcome

  // 1. Record the game play (會自動加分到 users.points)
  const record = await recordGamePlay({
    userId,
    gameType: 'daily_checkin',
    outcome: 'completed',
    prizeType: 'points',
    prizeAmount,
    prizeDescription,
    metadata: {
      totalCheckIns: newTotal,
      consecutiveCheckIns: newConsec,
      lastCheckInDate: todayTpe,
      streakReset,
      streakBonus,
    },
  })

  // 2. Update streak fields on user
  await (payload.update as Function)({
    collection: 'users',
    id: userId,
    data: {
      totalCheckIns: newTotal,
      consecutiveCheckIns: newConsec,
      lastCheckInDate: todayTpe,
    } as never,
  })

  return {
    prize: { prize: prizeDescription, type: 'points', amount: prizeAmount },
    totalCheckIns: newTotal,
    consecutiveCheckIns: newConsec,
    lastCheckInDate: todayTpe,
    streakReset,
    streakBonus,
    record,
  }
}

// ── 4. getPlayerStats ──

export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  const payload = await getPayload({ config })

  // Get all completed game records for this user
  const allGames = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { status: { equals: 'completed' } },
      ],
    } as Where,
    limit: 0,
  })

  const totalGames = allGames.totalDocs

  // Get wins
  const wins = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { status: { equals: 'completed' } },
        { 'result.outcome': { equals: 'win' } },
      ],
    } as Where,
    limit: 0,
  })

  const totalWins = wins.totalDocs

  // Calculate total points earned from games
  const gamesWithPoints = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { status: { equals: 'completed' } },
        { 'result.prizeType': { equals: 'points' } },
      ],
    } as Where,
    limit: 1000,
    sort: '-createdAt',
  })

  const totalPointsEarned = gamesWithPoints.docs.reduce((sum, doc) => {
    const result = (doc as unknown as Record<string, unknown>).result as unknown as Record<string, unknown> | undefined
    return sum + ((result?.prizeAmount as number) || 0)
  }, 0)

  // Calculate current win streak (most recent consecutive wins)
  const recentGames = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { status: { equals: 'completed' } },
      ],
    } as Where,
    limit: 50,
    sort: '-createdAt',
  })

  let currentStreak = 0
  for (const doc of recentGames.docs) {
    const result = (doc as unknown as Record<string, unknown>).result as unknown as Record<string, unknown> | undefined
    if (result?.outcome === 'win') {
      currentStreak++
    } else {
      break
    }
  }

  // Check badges (stored in metadata of game records or separate logic)
  const badges = await getPlayerBadges(userId)

  return { totalGames, totalWins, totalPointsEarned, currentStreak, badges }
}

// ── 5. updateLeaderboard ──

export async function updateLeaderboard(
  userId: string,
  points: number,
  isWin: boolean,
): Promise<void> {
  const payload = await getPayload({ config })

  // Asia/Taipei 統一時區（避免 server 時區造成 8 點後 dailyKey 切到隔天）
  const dailyKey = getTpeDateString()
  const weeklyKey = getTpeWeeklyKey()
  const monthlyKey = getTpeMonthlyKey()

  const periods = [
    { period: 'daily', periodKey: dailyKey },
    { period: 'weekly', periodKey: weeklyKey },
    { period: 'monthly', periodKey: monthlyKey },
    { period: 'all_time', periodKey: 'all_time' },
  ]

  for (const { period, periodKey } of periods) {
    // Try to find existing entry
    const existing = await payload.find({
      collection: 'mini-game-records',
      where: {
        and: [
          { player: { equals: userId } },
          { gameType: { equals: `leaderboard_${period}` } },
          { 'metadata.periodKey': { equals: periodKey } },
        ],
      } as Where,
      limit: 1,
    })

    if (existing.docs.length > 0) {
      const doc = existing.docs[0] as unknown as Record<string, unknown>
      const meta = (doc.metadata as unknown as Record<string, unknown>) || {}
      const prevPoints = (meta.totalPoints as number) || 0
      const prevWins = (meta.totalWins as number) || 0
      const prevGames = (meta.totalGames as number) || 0

      await (payload.update as Function)({
        collection: 'mini-game-records',
        id: doc.id as unknown as string,
        data: {
          metadata: {
            ...meta,
            periodKey,
            totalPoints: prevPoints + points,
            totalWins: prevWins + (isWin ? 1 : 0),
            totalGames: prevGames + 1,
          },
        } as never,
      })
    } else {
      await (payload.create as Function)({
        collection: 'mini-game-records',
        data: {
          player: userId,
          gameType: `leaderboard_${period}` as never,
          result: {
            outcome: 'completed',
            prizeType: 'none',
            prizeAmount: 0,
          },
          status: 'completed',
          metadata: {
            periodKey,
            totalPoints: points,
            totalWins: isWin ? 1 : 0,
            totalGames: 1,
          },
        } as never,
      })
    }
  }
}

// ── 6. checkAndAwardBadges ──

const BADGE_DEFINITIONS: Array<{
  id: string
  name: string
  check: (stats: PlayerStats, cardBattleCount: number, cardBattleWins: number) => boolean
}> = [
  { id: 'first_game', name: '初次冒險', check: (s) => s.totalGames >= 1 },
  { id: 'first_win', name: '幸運之星', check: (s) => s.totalWins >= 1 },
  { id: 'streak_3', name: '連勝達人', check: (s) => s.currentStreak >= 3 },
  { id: 'games_50', name: '遊戲大師', check: (s) => s.totalGames >= 50 },
  { id: 'games_100', name: '百戰英雄', check: (s) => s.totalGames >= 100 },
  { id: 'points_1000', name: '點數富翁', check: (s) => s.totalPointsEarned >= 1000 },
  { id: 'social_5', name: '社交蝴蝶', check: (_s, cb) => cb >= 5 },
  { id: 'battle_wins_10', name: '挑戰王者', check: (_s, _cb, cbw) => cbw >= 10 },
]

async function getPlayerBadges(userId: string): Promise<string[]> {
  const payload = await getPayload({ config })

  const badgeRecords = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { gameType: { equals: 'daily_checkin' } },
        { 'result.prizeType': { equals: 'badge' } },
      ],
    } as Where,
    limit: 100,
  })

  return badgeRecords.docs.map((doc) => {
    const result = (doc as unknown as Record<string, unknown>).result as unknown as Record<string, unknown> | undefined
    return (result?.prizeDescription as string) || ''
  }).filter(Boolean)
}

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const payload = await getPayload({ config })
  const stats = await getPlayerStats(userId)
  const existingBadges = stats.badges

  // Count card battles
  const cardBattles = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { gameType: { equals: 'card_battle' } },
        { status: { equals: 'completed' } },
      ],
    } as Where,
    limit: 0,
  })
  const cardBattleCount = cardBattles.totalDocs

  const cardBattleWins = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { gameType: { equals: 'card_battle' } },
        { 'result.outcome': { equals: 'win' } },
      ],
    } as Where,
    limit: 0,
  })
  const cardBattleWinCount = cardBattleWins.totalDocs

  const newBadges: string[] = []

  for (const badge of BADGE_DEFINITIONS) {
    if (existingBadges.includes(badge.name)) continue
    if (!badge.check(stats, cardBattleCount, cardBattleWinCount)) continue

    // Award badge by creating a record
    await (payload.create as Function)({
      collection: 'mini-game-records',
      data: {
        player: userId,
        gameType: 'daily_checkin' as never,
        result: {
          outcome: 'completed',
          prizeType: 'badge',
          prizeAmount: 0,
          prizeDescription: badge.name,
        },
        status: 'completed',
        metadata: { badgeId: badge.id, badgeName: badge.name },
      } as never,
    })

    newBadges.push(badge.name)
  }

  return newBadges
}
