import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { recordGamePlay, updateLeaderboard } from './gameEngine'

// ── Types ──

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

interface Card {
  rank: number // 1-13 (1=Ace, 11=Jack, 12=Queen, 13=King)
  suit: Suit
}

interface BattleRoom {
  id: string
  roomCode: string
  challengerId: string
  opponentId: string | null
  status: 'waiting' | 'in_progress' | 'completed' | 'expired'
  challengerCard: Card | null
  opponentCard: Card | null
  winnerId: string | null
  result: 'challenger_wins' | 'opponent_wins' | 'draw' | null
  pointsAwarded: Record<string, number>
  createdAt: string
}

// ── Constants ──

const DAILY_BATTLE_LIMIT = 3
const SUIT_RANK: Record<Suit, number> = { spades: 4, hearts: 3, diamonds: 2, clubs: 1 }
const WINNER_POINTS_MIN = 30
const WINNER_POINTS_MAX = 80
const LOSER_POINTS_MIN = 5
const LOSER_POINTS_MAX = 15
const DRAW_POINTS_MIN = 20
const DRAW_POINTS_MAX = 40

// ── Helpers ──

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid ambiguous: 0/O, 1/I
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getStartOfDay(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

function getEndOfDay(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
}

async function getUserDailyBattleCount(userId: string): Promise<number> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: userId } },
        { gameType: { equals: 'card_battle' } },
        { createdAt: { greater_than_equal: getStartOfDay() } },
        { createdAt: { less_than_equal: getEndOfDay() } },
        { status: { equals: 'completed' } },
      ],
    } as Where,
    limit: 0,
  })

  return result.totalDocs
}

// ── 1. createBattleRoom ──

export async function createBattleRoom(
  challengerId: string,
  referralCode?: string,
): Promise<{ success: boolean; roomCode?: string; error?: string }> {
  const dailyCount = await getUserDailyBattleCount(challengerId)
  if (dailyCount >= DAILY_BATTLE_LIMIT) {
    return { success: false, error: `今日對戰次數已達上限 (${DAILY_BATTLE_LIMIT} 次)` }
  }

  const payload = await getPayload({ config })
  const roomCode = generateRoomCode()

  await (payload.create as Function)({
    collection: 'mini-game-records',
    data: {
      player: challengerId,
      gameType: 'card_battle' as never,
      result: {
        outcome: 'completed',
        prizeType: 'none',
        prizeAmount: 0,
        prizeDescription: '',
      },
      status: 'active',
      referralCode: referralCode || '',
      metadata: {
        battleType: 'room',
        roomCode,
        role: 'challenger',
        battleStatus: 'waiting',
        opponentId: null,
        challengerCard: null,
        opponentCard: null,
        winnerId: null,
        battleResult: null,
        pointsAwarded: {},
      },
    } as never,
  })

  return { success: true, roomCode }
}

// ── 2. joinBattleRoom ──

export async function joinBattleRoom(
  roomCode: string,
  opponentId: string,
): Promise<{ success: boolean; error?: string }> {
  const payload = await getPayload({ config })

  // Find the room
  const rooms = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { gameType: { equals: 'card_battle' } },
        { 'metadata.roomCode': { equals: roomCode } },
        { 'metadata.role': { equals: 'challenger' } },
        { status: { equals: 'active' } },
      ],
    } as Where,
    limit: 1,
  })

  if (rooms.docs.length === 0) {
    return { success: false, error: '房間不存在或已關閉' }
  }

  const room = rooms.docs[0] as unknown as Record<string, unknown>
  const meta = (room.metadata as unknown as Record<string, unknown>) || {}

  if (meta.battleStatus !== 'waiting') {
    return { success: false, error: '此房間已經有對手了' }
  }

  const challengerId = room.player as string
  if (typeof challengerId === 'object') {
    const challengerObj = challengerId as unknown as Record<string, unknown>
    if (challengerObj.id === opponentId) {
      return { success: false, error: '不能跟自己對戰' }
    }
  } else if (challengerId === opponentId) {
    return { success: false, error: '不能跟自己對戰' }
  }

  // Check opponent's daily limit
  const opponentDailyCount = await getUserDailyBattleCount(opponentId)
  if (opponentDailyCount >= DAILY_BATTLE_LIMIT) {
    return { success: false, error: `對手今日對戰次數已達上限 (${DAILY_BATTLE_LIMIT} 次)` }
  }

  // Update room to in_progress
  await (payload.update as Function)({
    collection: 'mini-game-records',
    id: room.id as unknown as string,
    data: {
      metadata: {
        ...meta,
        battleStatus: 'in_progress',
        opponentId,
      },
    } as never,
  })

  return { success: true }
}

// ── 3. drawCard ──

export function drawCard(): Card {
  const rank = randomBetween(1, 13)
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
  const suit = suits[Math.floor(Math.random() * suits.length)]
  return { rank, suit }
}

// ── 4. playBattle ──

function compareCards(a: Card, b: Card): 'a' | 'b' | 'draw' {
  if (a.rank !== b.rank) {
    return a.rank > b.rank ? 'a' : 'b'
  }
  // Same rank: compare by suit
  if (SUIT_RANK[a.suit] !== SUIT_RANK[b.suit]) {
    return SUIT_RANK[a.suit] > SUIT_RANK[b.suit] ? 'a' : 'b'
  }
  return 'draw'
}

export async function playBattle(
  roomCode: string,
): Promise<{
  success: boolean
  challengerCard?: Card
  opponentCard?: Card
  result?: 'challenger_wins' | 'opponent_wins' | 'draw'
  winnerId?: string | null
  pointsAwarded?: Record<string, number>
  error?: string
}> {
  const payload = await getPayload({ config })

  // Find the room
  const rooms = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { gameType: { equals: 'card_battle' } },
        { 'metadata.roomCode': { equals: roomCode } },
        { 'metadata.role': { equals: 'challenger' } },
        { status: { equals: 'active' } },
      ],
    } as Where,
    limit: 1,
  })

  if (rooms.docs.length === 0) {
    return { success: false, error: '房間不存在' }
  }

  const room = rooms.docs[0] as unknown as Record<string, unknown>
  const meta = (room.metadata as unknown as Record<string, unknown>) || {}

  if (meta.battleStatus !== 'in_progress') {
    return { success: false, error: '房間尚未準備好（需要兩位玩家）' }
  }

  if (meta.battleResult) {
    return { success: false, error: '此場對戰已經結束' }
  }

  // Draw cards for both players
  const challengerCard = drawCard()
  const opponentCard = drawCard()
  const comparison = compareCards(challengerCard, opponentCard)

  // Resolve challenger ID (could be populated object)
  const rawChallengerId = room.player
  const challengerId = typeof rawChallengerId === 'object' && rawChallengerId !== null
    ? (rawChallengerId as unknown as Record<string, unknown>).id as unknown as string
    : rawChallengerId as string

  const opponentId = meta.opponentId as string

  let battleResult: 'challenger_wins' | 'opponent_wins' | 'draw'
  let winnerId: string | null = null
  const pointsAwarded: Record<string, number> = {}

  if (comparison === 'a') {
    battleResult = 'challenger_wins'
    winnerId = challengerId
    pointsAwarded[challengerId] = randomBetween(WINNER_POINTS_MIN, WINNER_POINTS_MAX)
    pointsAwarded[opponentId] = randomBetween(LOSER_POINTS_MIN, LOSER_POINTS_MAX)
  } else if (comparison === 'b') {
    battleResult = 'opponent_wins'
    winnerId = opponentId
    pointsAwarded[opponentId] = randomBetween(WINNER_POINTS_MIN, WINNER_POINTS_MAX)
    pointsAwarded[challengerId] = randomBetween(LOSER_POINTS_MIN, LOSER_POINTS_MAX)
  } else {
    battleResult = 'draw'
    const drawPoints = randomBetween(DRAW_POINTS_MIN, DRAW_POINTS_MAX)
    pointsAwarded[challengerId] = drawPoints
    pointsAwarded[opponentId] = drawPoints
  }

  // Update the room record
  await (payload.update as Function)({
    collection: 'mini-game-records',
    id: room.id as unknown as string,
    data: {
      status: 'completed',
      metadata: {
        ...meta,
        battleStatus: 'completed',
        challengerCard,
        opponentCard,
        winnerId,
        battleResult,
        pointsAwarded,
      },
    } as never,
  })

  // Record game play for challenger
  const challengerOutcome = comparison === 'a' ? 'win' : comparison === 'b' ? 'lose' : 'draw'
  await recordGamePlay({
    userId: challengerId,
    gameType: 'card_battle',
    outcome: challengerOutcome as 'win' | 'lose' | 'draw',
    prizeType: 'points',
    prizeAmount: pointsAwarded[challengerId],
    prizeDescription: `卡牌對戰 ${challengerOutcome === 'win' ? '勝利' : challengerOutcome === 'lose' ? '落敗' : '平手'}`,
    metadata: { roomCode, role: 'challenger', card: challengerCard },
  })

  // Record game play for opponent
  const opponentOutcome = comparison === 'b' ? 'win' : comparison === 'a' ? 'lose' : 'draw'
  await recordGamePlay({
    userId: opponentId,
    gameType: 'card_battle',
    outcome: opponentOutcome as 'win' | 'lose' | 'draw',
    prizeType: 'points',
    prizeAmount: pointsAwarded[opponentId],
    prizeDescription: `卡牌對戰 ${opponentOutcome === 'win' ? '勝利' : opponentOutcome === 'lose' ? '落敗' : '平手'}`,
    metadata: { roomCode, role: 'opponent', card: opponentCard },
  })

  // Update leaderboard for both players
  await updateLeaderboard(challengerId, pointsAwarded[challengerId], challengerOutcome === 'win')
  await updateLeaderboard(opponentId, pointsAwarded[opponentId], opponentOutcome === 'win')

  return {
    success: true,
    challengerCard,
    opponentCard,
    result: battleResult,
    winnerId,
    pointsAwarded,
  }
}

// ── 5. getBattleRoom ──

export async function getBattleRoom(roomCode: string): Promise<BattleRoom | null> {
  const payload = await getPayload({ config })

  const rooms = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { gameType: { equals: 'card_battle' } },
        { 'metadata.roomCode': { equals: roomCode } },
        { 'metadata.role': { equals: 'challenger' } },
      ],
    } as Where,
    limit: 1,
  })

  if (rooms.docs.length === 0) return null

  const room = rooms.docs[0] as unknown as Record<string, unknown>
  const meta = (room.metadata as unknown as Record<string, unknown>) || {}

  const rawChallengerId = room.player
  const challengerId = typeof rawChallengerId === 'object' && rawChallengerId !== null
    ? (rawChallengerId as unknown as Record<string, unknown>).id as unknown as string
    : rawChallengerId as string

  return {
    id: room.id as unknown as string,
    roomCode: meta.roomCode as string,
    challengerId,
    opponentId: (meta.opponentId as string) || null,
    status: mapBattleStatus(meta.battleStatus as string, room.status as string),
    challengerCard: (meta.challengerCard as Card) || null,
    opponentCard: (meta.opponentCard as Card) || null,
    winnerId: (meta.winnerId as string) || null,
    result: (meta.battleResult as BattleRoom['result']) || null,
    pointsAwarded: (meta.pointsAwarded as Record<string, number>) || {},
    createdAt: room.createdAt as string,
  }
}

function mapBattleStatus(
  battleStatus: string | undefined,
  recordStatus: string | undefined,
): BattleRoom['status'] {
  if (recordStatus === 'expired') return 'expired'
  if (battleStatus === 'completed') return 'completed'
  if (battleStatus === 'in_progress') return 'in_progress'
  return 'waiting'
}

// ── 6. expireStaleRooms ──

export async function expireStaleRooms(): Promise<number> {
  const payload = await getPayload({ config })

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const staleRooms = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { gameType: { equals: 'card_battle' } },
        { 'metadata.role': { equals: 'challenger' } },
        { 'metadata.battleStatus': { equals: 'waiting' } },
        { status: { equals: 'active' } },
        { createdAt: { less_than: cutoff } },
      ],
    } as Where,
    limit: 100,
  })

  let expired = 0
  for (const doc of staleRooms.docs) {
    const room = doc as unknown as Record<string, unknown>
    const meta = (room.metadata as unknown as Record<string, unknown>) || {}
    await (payload.update as Function)({
      collection: 'mini-game-records',
      id: room.id as unknown as string,
      data: {
        status: 'expired',
        metadata: { ...meta, battleStatus: 'expired' },
      } as never,
    })
    expired++
  }

  return expired
}

// ── 7. getShareableLink ──

export function getShareableLink(roomCode: string, referralCode?: string): string {
  const base = `/games/card-battle?room=${encodeURIComponent(roomCode)}`
  if (referralCode) {
    return `${base}&ref=${encodeURIComponent(referralCode)}`
  }
  return base
}
