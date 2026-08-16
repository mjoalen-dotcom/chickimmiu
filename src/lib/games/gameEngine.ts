import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { recordWalletTxn } from '../wallet/server'

// ── Types ──

/**
 * 'none' = 銘謝惠顧（未中獎）。實體刮刮樂/轉盤都有「沒中」格子，
 * 加進來讓 admin 能設真實中獎率（法規要求公示）+ 給玩家「差一點」的刺激感。
 */
export type PrizeType = 'points' | 'credit' | 'coupon' | 'none'

export interface PrizeEntry {
  prize: string
  type: PrizeType
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
  type: PrizeType
  amount: number
  /** 若來自 PrizePool collection，記下 ID 讓呼叫端可扣 inventoryRemaining */
  sourcePoolId?: number
  /** PrizePool.deliveryMethod，給後續 UserRewards 出貨流判斷用 */
  deliveryMethod?: 'instant_credit' | 'digital_coupon' | 'physical_shipping' | 'manual_contact'
  /** PrizePool.expiryDays，給 UserRewards expiresAt 計算用 */
  expiryDays?: number
  /** PrizePool.couponCode（type=coupon 時可能有） */
  couponCode?: string
}

interface RecordGamePlayParams {
  userId: string
  gameType: string
  outcome: 'win' | 'lose' | 'draw' | 'completed'
  prizeType?: PrizeType | 'badge'
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
    // 三連線中獎模式：'none' 銘謝惠顧 weight 50 → 整體中獎率約 50%
    // Phase B PrizePool 上線後 admin 可從後台調整任一 entry 的 weight
    prizeTable: [
      { prize: '銘謝惠顧', type: 'none', amount: 0, weight: 50 },
      { prize: '5 點數', type: 'points', amount: 5, weight: 22 },
      { prize: '15 點數', type: 'points', amount: 15, weight: 13 },
      { prize: '30 點數', type: 'points', amount: 30, weight: 7 },
      { prize: '80 點數', type: 'points', amount: 80, weight: 2 },
      { prize: 'NT$5 購物金', type: 'credit', amount: 5, weight: 4 },
      { prize: 'NT$30 購物金', type: 'credit', amount: 30, weight: 1.5 },
      { prize: '95 折優惠券', type: 'coupon', amount: 5, weight: 0.5 },
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
  movie_lottery: {
    // 無免費次數、每次都扣點；winRate / pointsCost / dailyLimit 實際從 GameSettings.movieLottery 覆寫
    freePlaysPerDay: { ordinary: 0, bronze: 0, silver: 0, gold: 0, platinum: 0, diamond: 0 },
    pointsCost: 100,
    prizeTable: [], // 二元結果（中/未中），bespoke draw logic in drawMovieTicket
    dailyLimit: 3,
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

/**
 * Asia/Taipei 的週起始（週日）作為 YYYY-MM-DD key。
 *
 * Phase 5.7.1 (2026-04-17)：原版用 `new Date(todayTpe + 'T00:00:00Z').getUTCDay()`
 * 把 TPE 字串硬塞回 UTC 拿 day-of-week，輸出對但邏輯路徑混合（TPE 字串 → UTC parse →
 * UTC getter）。改為：
 *   1. day-of-week 直接從 Intl 拿（純 TPE 視角）
 *   2. 日期減法用純 ms 算術（任何時區皆等價，因為兩端都是 ISO 8601 date-only string，
 *      規格定義為 UTC midnight）
 * 同一 `now` Date 實例傳給兩個 helper，避免跨 TPE 午夜瞬間的 race。
 */
function getTpeWeeklyKey(): string {
  const now = new Date()
  const todayTpe = getTpeDateString(now) // YYYY-MM-DD in TPE
  const dayOfWeek = getTpeDayOfWeek(now) // 0=Sun .. 6=Sat
  const sundayMs = Date.parse(todayTpe) - dayOfWeek * 86_400_000
  return new Date(sundayMs).toISOString().slice(0, 10)
}

/**
 * Day-of-week in Asia/Taipei (0=Sunday … 6=Saturday).
 * Uses Intl.DateTimeFormat with TPE timezone — no UTC arithmetic, no parsing
 * of TPE date strings as UTC instants.
 */
function getTpeDayOfWeek(date: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
  }).format(date)
  // 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
}

/** Asia/Taipei 的 YYYY-MM month key */
function getTpeMonthlyKey(): string {
  const tpeDate = getTpeDateString() // YYYY-MM-DD
  return tpeDate.substring(0, 7) // YYYY-MM
}

async function getUserTierSlug(userId: string): Promise<string> {
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'customers', id: userId })
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

const TIER_BONUS_MAP: Record<string, number> = {
  ordinary: 0,
  bronze: 0.02,
  silver: 0.04,
  gold: 0.06,
  platinum: 0.08,
  diamond: 0.1,
}

interface PoolPrize {
  id: number
  name: string
  prizeType: PrizeType
  amount: number
  weight: number
  couponCode?: string
  deliveryMethod?: DrawnPrize['deliveryMethod']
  expiryDays?: number
  tierBoost?: Record<string, number>
}

/**
 * 從 PrizePools collection 撈所有「對該遊戲有效」的獎品。
 * 過濾條件：
 *   - active=true
 *   - eligibleGames includes gameType
 *   - inventoryUnlimited OR inventoryRemaining > 0
 *   - 在 startsAt..endsAt 時間區間內（任一未設則該邊不限）
 * 回傳空陣列代表該遊戲尚未在 PrizePool 設定 → 呼叫端應 fallback 到 GAME_CONFIGS
 */
async function loadPoolPrizes(gameType: string): Promise<PoolPrize[]> {
  const payload = await getPayload({ config })
  const now = new Date().toISOString()

  let res: { docs: unknown[] }
  try {
    res = await payload.find({
      collection: 'prize-pools',
      where: {
        and: [
          { active: { equals: true } },
          { eligibleGames: { contains: gameType } },
          {
            or: [
              { inventoryUnlimited: { equals: true } },
              { inventoryRemaining: { greater_than: 0 } },
            ],
          },
          { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] },
          { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: now } }] },
        ],
      } as never,
      limit: 200,
      depth: 0,
    })
  } catch {
    // PrizePools table 還沒 migrate 或 query 失敗 — fallback 到 hardcoded
    return []
  }

  return res.docs.map((d) => {
    const r = d as Record<string, unknown>
    const tierBoost = (r.tierBoost as Record<string, number> | undefined) || undefined
    return {
      id: Number(r.id),
      name: String(r.name || '獎品'),
      prizeType: (r.prizeType as PrizeType) || 'none',
      amount: Number(r.amount || 0),
      weight: Number(r.weight || 0),
      couponCode: typeof r.couponCode === 'string' ? r.couponCode : undefined,
      deliveryMethod: r.deliveryMethod as DrawnPrize['deliveryMethod'],
      expiryDays: typeof r.expiryDays === 'number' ? r.expiryDays : undefined,
      tierBoost,
    }
  }).filter((p) => p.weight > 0)
}

/**
 * 中獎後扣 PrizePool.inventoryRemaining。Fire-and-forget — 失敗不擋發獎流程。
 * 限量獎品 race condition 風險可接受（同時搶最後一個可能 oversell 1-2 個，可由
 * admin 後台手動修正；Phase E 之後可加 row-level lock）。
 */
async function decrementPoolInventory(poolId: number): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const doc = await payload.findByID({ collection: 'prize-pools', id: poolId, depth: 0 })
    const data = doc as unknown as Record<string, unknown>
    if (data.inventoryUnlimited === true) return
    const remaining = Number(data.inventoryRemaining || 0)
    if (remaining <= 0) return
    await (payload.update as Function)({
      collection: 'prize-pools',
      id: poolId,
      data: { inventoryRemaining: Math.max(0, remaining - 1) } as never,
    })
  } catch (err) {
    console.error('decrementPoolInventory failed', { poolId, err })
  }
}

export async function drawPrize(
  gameType: string,
  tierSlug: string,
  creditScore: number = 100,
): Promise<DrawnPrize | null> {
  const tierBonus = TIER_BONUS_MAP[tierSlug] ?? 0
  const creditBonus = (creditScore / 100) * 0.05

  // 1) 優先嘗試從 PrizePools 撈 admin 設定的獎品
  const poolPrizes = await loadPoolPrizes(gameType)
  if (poolPrizes.length > 0) {
    const maxAmount = Math.max(...poolPrizes.map((p) => p.amount), 1)
    const adjusted = poolPrizes.map((p) => {
      const tierMultiplier = p.tierBoost?.[tierSlug] ?? 1
      if (p.prizeType === 'none') {
        return { ...p, adjustedWeight: p.weight * tierMultiplier }
      }
      const relativeValue = p.amount / maxAmount
      const boost = 1 + relativeValue * (tierBonus + creditBonus)
      return { ...p, adjustedWeight: p.weight * boost * tierMultiplier }
    })
    const total = adjusted.reduce((s, e) => s + e.adjustedWeight, 0)
    if (total > 0) {
      let r = Math.random() * total
      for (const e of adjusted) {
        r -= e.adjustedWeight
        if (r <= 0) {
          return {
            prize: e.name,
            type: e.prizeType,
            amount: e.amount,
            sourcePoolId: e.id,
            deliveryMethod: e.deliveryMethod,
            expiryDays: e.expiryDays,
            couponCode: e.couponCode,
          }
        }
      }
      const last = adjusted[adjusted.length - 1]
      return {
        prize: last.name,
        type: last.prizeType,
        amount: last.amount,
        sourcePoolId: last.id,
        deliveryMethod: last.deliveryMethod,
        expiryDays: last.expiryDays,
        couponCode: last.couponCode,
      }
    }
  }

  // 2) Fallback: 用 GAME_CONFIGS 寫死的 prizeTable（admin 還沒 setup PrizePool 時的兜底）
  const gameConfig = GAME_CONFIGS[gameType]
  if (!gameConfig || gameConfig.prizeTable.length === 0) return null

  const sortedByAmount = [...gameConfig.prizeTable].sort((a, b) => a.amount - b.amount)
  const maxAmount = sortedByAmount[sortedByAmount.length - 1]?.amount ?? 1

  const adjustedEntries = gameConfig.prizeTable.map((entry) => {
    if (entry.type === 'none') {
      return { ...entry, adjustedWeight: entry.weight }
    }
    const relativeValue = entry.amount / maxAmount
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

  const last = adjustedEntries[adjustedEntries.length - 1]
  return { prize: last.prize, type: last.type, amount: last.amount }
}

/** 對外 export 給 API route 中獎後 fire-and-forget 扣庫存用 */
export { decrementPoolInventory }

// ── 2.5 generateScratchCells ──
/**
 * 給定中獎/未中獎結果，產生「三連線刮刮樂」要顯示的三個 icon。
 *
 * 中獎時：三 icon 一致（= prize.icon）→ 視覺 BINGO 三連線
 * 未中獎時：50% 機率產出「兩同一異」（差一點，最大化心理刺激），
 *           50% 機率產出「三全異」（完全 miss）
 *
 * Pure 函數無副作用，方便單元測試 + 由 admin 後台 preview 用。
 */
export const SCRATCH_PRIZE_ICONS: Record<PrizeType | 'badge', string> = {
  points: '🎯',
  credit: '💰',
  coupon: '🏷️',
  none: '🍂',
  badge: '🏅',
}

const SCRATCH_DISTRACTOR_POOL = ['🎯', '💰', '🏷️', '🏅', '🌸', '🦋', '⭐']

export function generateScratchCells(opts: {
  won: boolean
  prizeIcon: string | null
  closeMissChance?: number // 預設 0.5；未中獎時「兩同一異」的機率
}): string[] {
  const { won, prizeIcon } = opts
  const closeMissChance = opts.closeMissChance ?? 0.5

  if (won && prizeIcon) {
    return [prizeIcon, prizeIcon, prizeIcon]
  }

  // 未中獎：先決定要不要「兩同一異」
  const closeMiss = Math.random() < closeMissChance
  const pool = SCRATCH_DISTRACTOR_POOL.filter((i) => i !== prizeIcon)

  if (closeMiss && prizeIcon) {
    // 兩個 prizeIcon + 一個 distractor，三個位置打散
    const distractor = pool[Math.floor(Math.random() * pool.length)] || '🌸'
    const cells = [prizeIcon, prizeIcon, distractor]
    // Fisher-Yates shuffle
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cells[i], cells[j]] = [cells[j], cells[i]]
    }
    return cells
  }

  // 完全 miss：三個都不同
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
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

  // Read user ONCE to get current balances
  const user = await payload.findByID({ collection: 'customers', id: params.userId })
  const userData = user as unknown as Record<string, unknown>
  let pointsBalance = (userData.points as number) || 0
  let creditBalance = (userData.shoppingCredit as number) || 0
  const userUpdates: Record<string, number> = {}

  // 1. Deduct spent points first (pay before receiving prize), write points-transactions
  if (params.pointsSpent && params.pointsSpent > 0) {
    pointsBalance = Math.max(0, pointsBalance - params.pointsSpent)
    userUpdates.points = pointsBalance
    await (payload.create as Function)({
      collection: 'points-transactions',
      data: {
        user: params.userId,
        amount: -(params.pointsSpent),
        type: 'redeem',
        source: 'game',
        description: `[${params.gameType}] 遊戲消耗點數`,
        balance: pointsBalance,
      } as never,
    })
  }

  // 2. Award points prize, write points-transactions
  if (params.prizeType === 'points' && params.prizeAmount && params.prizeAmount > 0) {
    pointsBalance += params.prizeAmount
    userUpdates.points = pointsBalance
    await (payload.create as Function)({
      collection: 'points-transactions',
      data: {
        user: params.userId,
        amount: params.prizeAmount,
        type: 'earn',
        source: 'game',
        description: params.prizeDescription || `[${params.gameType}] 遊戲獎勵`,
        balance: pointsBalance,
      } as never,
    })
  }

  // 3. Award credit prize (購物金，寫錢包帳本)
  let creditAwarded = 0
  if (params.prizeType === 'credit' && params.prizeAmount && params.prizeAmount > 0) {
    creditBalance += params.prizeAmount
    creditAwarded = params.prizeAmount
    userUpdates.shoppingCredit = creditBalance
  }

  // Single write to user document
  if (Object.keys(userUpdates).length > 0) {
    await (payload.update as Function)({
      collection: 'customers',
      id: params.userId,
      data: userUpdates as never,
    })
  }

  // 餘額已寫入 → 補錢包帳本一筆（local API，WalletTransactions hook 會跳過不重複加扣）
  if (creditAwarded > 0) {
    await recordWalletTxn(payload, {
      userId: params.userId,
      wallet: 'shoppingCredit',
      amount: creditAwarded,
      type: 'earn',
      source: 'game',
      description: params.prizeDescription || `[${params.gameType}] 遊戲購物金獎勵`,
      balanceOverride: creditBalance,
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

  const user = await payload.findByID({ collection: 'customers', id: userId })
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
    collection: 'customers',
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

// ── 7. drawMovieTicket ──
// 電影票抽獎（二元結果，有限票數）
//
// 邏輯 —
//   - 讀 GameSettings.movieLottery 取 winRate / pointsCost / ticketType / remainingTickets
//   - 扣點 → 擲 winRate → 中獎：產生兌換碼 + 減 remainingTickets + 建 record (prizeType='coupon')
//     → MiniGameRecords afterChange hook 自動建 UserRewards（寶物箱 /account/treasure 看得到）
//   - 未中獎：建 record (outcome='lose', prizeType='none')，無入帳但仍扣點 + 計入 dailyLimit
//   - remainingTickets ≤ 0 直接 throw，前端顯示「本期已抽完」
//
// 注意：remainingTickets 減一是非原子操作（read-modify-write），SQLite 單進程下安全，
// 多 worker 或 Postgres 環境下可能有 race — 下個階段若改並行部署需加 row lock。

export interface MovieLotteryResult {
  won: boolean
  ticketType: string
  couponCode?: string
  pointsSpent: number
  remainingTickets: number
  record: Record<string, unknown>
}

function generateMovieCouponCode(): string {
  // MV + base36 timestamp + 4 位隨機 ≈ 短且可讀
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')
  return `MV${ts}${rnd}`
}

export async function drawMovieTicket(userId: string): Promise<MovieLotteryResult> {
  const payload = await getPayload({ config })
  const gameSettings = (await payload.findGlobal({ slug: 'game-settings' })) as unknown as Record<string, unknown>
  const movieConfig = ((gameSettings.movieLottery as Record<string, unknown>) || {})

  const rawWinRate = Number(movieConfig.winRate ?? 5)
  const winRate = Math.max(0, Math.min(100, rawWinRate)) / 100
  const pointsCost = Number(movieConfig.pointsCostPerPlay ?? 100)
  const ticketType = (movieConfig.ticketType as string) || '威秀影城 2D 一般廳'
  const remaining = Number(movieConfig.remainingTickets ?? 0)

  if (remaining <= 0) {
    throw new Error('本期電影票已全部抽完，敬請期待下一期！')
  }

  // 查使用者目前餘額 + tier/credit（快照用）
  const user = await payload.findByID({ collection: 'customers', id: userId })
  const userData = user as unknown as Record<string, unknown>
  const userPoints = (userData.points as number) || 0

  if (userPoints < pointsCost) {
    throw new Error(`點數不足，需要 ${pointsCost} 點`)
  }

  let tierSlug = 'ordinary'
  if (userData.memberTier) {
    if (typeof userData.memberTier === 'object' && userData.memberTier !== null) {
      tierSlug = ((userData.memberTier as unknown as Record<string, unknown>).slug as string) || 'ordinary'
    }
  }
  const creditScore = (userData.creditScore as number) || 100

  const won = Math.random() < winRate

  if (won) {
    const couponCode = generateMovieCouponCode()

    // 減票 — read-modify-write，不是 atomic 但 SQLite 單進程夠用
    await (payload.updateGlobal as Function)({
      slug: 'game-settings',
      data: {
        movieLottery: {
          ...movieConfig,
          remainingTickets: remaining - 1,
        },
      } as never,
    })

    const record = await recordGamePlay({
      userId,
      gameType: 'movie_lottery',
      outcome: 'win',
      prizeType: 'coupon',
      prizeAmount: 1,
      prizeDescription: ticketType,
      couponCode,
      pointsSpent: pointsCost,
      tierSlug,
      creditScore,
      metadata: { ticketType, winRate: rawWinRate, remainingAfter: remaining - 1 },
    })

    return {
      won: true,
      ticketType,
      couponCode,
      pointsSpent: pointsCost,
      remainingTickets: remaining - 1,
      record,
    }
  }

  // 未中獎仍扣點、記 record（計入 dailyLimit）
  const record = await recordGamePlay({
    userId,
    gameType: 'movie_lottery',
    outcome: 'lose',
    prizeType: 'none',
    prizeAmount: 0,
    prizeDescription: '未中獎',
    pointsSpent: pointsCost,
    tierSlug,
    creditScore,
    metadata: { ticketType, winRate: rawWinRate, remainingAfter: remaining },
  })

  return {
    won: false,
    ticketType,
    pointsSpent: pointsCost,
    remainingTickets: remaining,
    record,
  }
}
