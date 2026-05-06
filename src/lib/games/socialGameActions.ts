import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { getTpeDateString, recordGamePlay } from './gameEngine'

/**
 * 社交 / UGC 遊戲 server actions。
 *
 * PR-2 scope：資料層 wrappers（驗證 + 寫入 + 獎勵結算入口），
 * 由 `/api/games/[slug]/(submit|vote|room|wish)` route handlers 呼叫。
 *
 * 獎勵結算原則（對齊 GAMES_SOCIAL_COLLECTIONS.md 第 4.2 節）：
 *   - 立即觸發（wish_pool 被選中）→ 本檔用 `recordGamePlay` 直接處理
 *   - 房間結算類（style_pk/co_create/blind_box/team_style）→ settleStyleRoom
 *     呼叫 recordGamePlay for each participant
 *   - 週期結算（style_relay/weekly_challenge/queen_vote）→ cron 非本 PR
 *
 * 獎勵設定（bountyPoints / 結算點數）預設由 GameSettings global 讀；
 * PR-2 先用保守 fallback，後續 PR 加 admin 配置。
 */

// ── Types ──

const SOCIAL_GAME_TYPES = [
  'style_pk',
  'style_relay',
  'weekly_challenge',
  'co_create',
  'blind_box',
  'queen_vote',
  'team_style',
  'wish_pool',
] as const
export type SocialGameType = (typeof SOCIAL_GAME_TYPES)[number]

const ROOM_GAME_TYPES: SocialGameType[] = [
  'style_pk',
  'co_create',
  'blind_box',
  'team_style',
]

const VOTE_TYPES = ['pk_pick', 'like', 'star', 'score'] as const
type VoteType = (typeof VOTE_TYPES)[number]

export function isSocialGameType(v: unknown): v is SocialGameType {
  return typeof v === 'string' && (SOCIAL_GAME_TYPES as readonly string[]).includes(v)
}

// ── 常數 ──

const DEFAULT_DAILY_QUOTA: Record<SocialGameType, number> = {
  style_pk: 5,
  style_relay: 3,
  weekly_challenge: 1,
  co_create: 5,
  blind_box: 3,
  queen_vote: 1,
  team_style: 3,
  wish_pool: 3,
}

const DEFAULT_WISH_DURATION_MS = 14 * 24 * 60 * 60 * 1000
const DEFAULT_ROOM_DURATION_MS = 24 * 60 * 60 * 1000
const MIN_BOUNTY = 0
const MAX_BOUNTY = 5000
const MAX_TITLE_LEN = 80
const MAX_DESCRIPTION_LEN = 500
const MAX_NOTE_LEN = 300
const MAX_CAPTION_LEN = 500
const MAX_TAGS = 10
const MAX_TAG_LEN = 20
const MAX_REFERENCE_PHOTOS = 5
const MAX_IMAGES = 6
const MIN_IMAGES = 1

// ── 共用 helpers ──

function getTpeStartOfDayISO(): string {
  const tpeDate = getTpeDateString()
  return new Date(`${tpeDate}T00:00:00+08:00`).toISOString()
}

function genInviteCode(): string {
  // 8 char base36 — 約 2.8T 種，用途只是「不易猜」，非密碼學安全
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

/** 檢查 userId 今日社交遊戲的投稿/參與數量 */
async function checkSocialDailyQuota(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  userId: string | number,
  gameType: SocialGameType,
  limit: number,
): Promise<{ used: number; canPlay: boolean }> {
  const where: Where = {
    and: [
      { player: { equals: userId } },
      { gameType: { equals: gameType } },
      { createdAt: { greater_than_equal: getTpeStartOfDayISO() } },
    ],
  }
  const res = await payload.find({
    collection: 'style-submissions',
    where,
    limit: 0,
  })
  const used = res.totalDocs as number
  return { used, canPlay: used < limit }
}

// ── 1. submitStyleWork ──

export interface SubmitStyleWorkInput {
  gameType: SocialGameType
  images: Array<number | string> // media IDs
  caption?: string
  tags?: string[]
  room?: number | string
  parent?: number | string
  wish?: number | string
  theme?: string
  metadata?: Record<string, unknown>
}

export interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  reason?: string
  data?: T
}

export async function submitStyleWork(
  userId: string | number,
  input: SubmitStyleWorkInput,
): Promise<ActionResult<{ submissionId: number | string; dailyUsed: number }>> {
  if (!isSocialGameType(input.gameType)) {
    return { success: false, error: `Invalid gameType: ${input.gameType}` }
  }
  if (!Array.isArray(input.images) || input.images.length < MIN_IMAGES) {
    return { success: false, error: `至少需要 ${MIN_IMAGES} 張圖片` }
  }
  if (input.images.length > MAX_IMAGES) {
    return { success: false, error: `最多 ${MAX_IMAGES} 張圖片` }
  }
  if (input.caption && input.caption.length > MAX_CAPTION_LEN) {
    return { success: false, error: `文案最多 ${MAX_CAPTION_LEN} 字` }
  }
  if (input.tags) {
    if (input.tags.length > MAX_TAGS) {
      return { success: false, error: `最多 ${MAX_TAGS} 個標籤` }
    }
    for (const t of input.tags) {
      if (typeof t !== 'string' || t.length === 0 || t.length > MAX_TAG_LEN) {
        return { success: false, error: `標籤每個最多 ${MAX_TAG_LEN} 字` }
      }
    }
  }

  const payload = await getPayload({ config })
  const quotaLimit = DEFAULT_DAILY_QUOTA[input.gameType]
  const quota = await checkSocialDailyQuota(payload, userId, input.gameType, quotaLimit)
  if (!quota.canPlay) {
    return {
      success: false,
      reason: 'daily_limit',
      error: `今日 ${input.gameType} 投稿已達上限 (${quotaLimit})`,
    }
  }

  // 拿會員等級做 snapshot
  let playerTierSnapshot: string | undefined
  try {
    const user = (await payload.findByID({
      collection: 'users',
      id: userId,
    })) as unknown as Record<string, unknown>
    const memberTier = user.memberTier
    if (memberTier && typeof memberTier === 'object') {
      playerTierSnapshot = (memberTier as Record<string, unknown>).slug as string | undefined
    } else if (typeof memberTier === 'string') {
      playerTierSnapshot = memberTier
    }
  } catch {
    // 拿不到 tier 不擋投稿
  }

  const data = {
    player: userId,
    gameType: input.gameType,
    room: input.room,
    parent: input.parent,
    wish: input.wish,
    theme: input.theme,
    images: input.images.map((id) => ({ image: id })),
    caption: input.caption,
    tags: input.tags?.map((tag) => ({ tag })),
    status: 'submitted' as const,
    playerTierSnapshot,
    metadata: input.metadata,
  }

  try {
    const submission = (await (payload.create as (args: {
      collection: 'style-submissions'
      data: unknown
      overrideAccess?: boolean
    }) => Promise<Record<string, unknown>>)({
      collection: 'style-submissions',
      data,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return {
      success: true,
      data: {
        submissionId: submission.id as number | string,
        dailyUsed: quota.used + 1,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Submission failed',
    }
  }
}

// ── 2. castStyleVote ──

export interface CastStyleVoteInput {
  submissionId: number | string
  voteType: VoteType
  score?: number
}

export async function castStyleVote(
  userId: string | number,
  input: CastStyleVoteInput,
): Promise<ActionResult<{ voteId: number | string }>> {
  if (!VOTE_TYPES.includes(input.voteType)) {
    return { success: false, error: `Invalid voteType: ${input.voteType}` }
  }
  if (input.voteType === 'score') {
    if (typeof input.score !== 'number' || input.score < 1 || input.score > 10) {
      return { success: false, error: 'voteType=score 需要 1-10 分' }
    }
  }

  const payload = await getPayload({ config })

  // Denormalize room from submission（for per-room queries）
  let roomId: number | string | undefined
  try {
    const submission = (await payload.findByID({
      collection: 'style-submissions',
      id: input.submissionId,
      depth: 0,
    })) as unknown as Record<string, unknown>
    const rawRoom = submission.room
    if (rawRoom !== undefined && rawRoom !== null) {
      roomId =
        typeof rawRoom === 'object'
          ? ((rawRoom as Record<string, unknown>).id as number | string)
          : (rawRoom as number | string)
    }
    // self-vote 由 StyleVotes beforeChange hook 擋
    void submission
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Submission not found',
    }
  }

  try {
    const vote = (await (payload.create as (args: {
      collection: 'style-votes'
      data: unknown
      overrideAccess?: boolean
    }) => Promise<Record<string, unknown>>)({
      collection: 'style-votes',
      data: {
        voter: userId,
        submission: input.submissionId,
        room: roomId,
        voteType: input.voteType,
        score: input.score,
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return { success: true, data: { voteId: vote.id as number | string } }
  } catch (err) {
    // UNIQUE (voter, submission, voteType) 衝突 / self-vote hook throw
    const msg = err instanceof Error ? err.message : 'Vote failed'
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return { success: false, reason: 'duplicate_vote', error: '已經對此作品投過同類型票' }
    }
    if (msg.includes('自己的作品')) {
      return { success: false, reason: 'self_vote', error: '不能對自己的作品投票' }
    }
    return { success: false, error: msg }
  }
}

// ── 3. createStyleRoom ──

export interface CreateStyleRoomInput {
  gameType: SocialGameType
  capacity?: number
  visibility?: 'private' | 'friends' | 'public'
  theme?: string
  settings?: Record<string, unknown>
}

export async function createStyleRoom(
  userId: string | number,
  input: CreateStyleRoomInput,
): Promise<
  ActionResult<{ roomId: number | string; roomCode: string; inviteCode: string }>
> {
  if (!ROOM_GAME_TYPES.includes(input.gameType)) {
    return {
      success: false,
      error: `${input.gameType} 不支援房間模式（允許：${ROOM_GAME_TYPES.join(', ')}）`,
    }
  }
  const capacity = input.capacity ?? 2
  if (capacity < 2 || capacity > 10) {
    return { success: false, error: '人數上限必須 2-10' }
  }

  const payload = await getPayload({ config })
  const now = new Date()
  const inviteCode = genInviteCode()

  try {
    const room = (await (payload.create as (args: {
      collection: 'style-game-rooms'
      data: unknown
      overrideAccess?: boolean
    }) => Promise<Record<string, unknown>>)({
      collection: 'style-game-rooms',
      data: {
        // roomCode 由 beforeChange hook 自動產
        gameType: input.gameType,
        host: userId,
        participants: [
          {
            user: userId,
            role: 'host',
            joinedAt: now.toISOString(),
            status: 'active',
          },
        ],
        capacity,
        visibility: input.visibility ?? 'private',
        inviteCode,
        theme: input.theme,
        settings: input.settings,
        status: 'waiting',
        expiresAt: new Date(now.getTime() + DEFAULT_ROOM_DURATION_MS).toISOString(),
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return {
      success: true,
      data: {
        roomId: room.id as number | string,
        roomCode: room.roomCode as string,
        inviteCode,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Create room failed',
    }
  }
}

// ── 4. joinStyleRoom ──

export interface JoinStyleRoomInput {
  roomId?: number | string
  inviteCode?: string
  role?: 'member' | 'spectator'
}

export async function joinStyleRoom(
  userId: string | number,
  input: JoinStyleRoomInput,
): Promise<ActionResult<{ roomId: number | string; participantCount: number; full: boolean }>> {
  if (!input.roomId && !input.inviteCode) {
    return { success: false, error: '需要 roomId 或 inviteCode' }
  }

  const payload = await getPayload({ config })
  let room: Record<string, unknown> | null = null

  if (input.roomId) {
    try {
      room = (await payload.findByID({
        collection: 'style-game-rooms',
        id: input.roomId,
        depth: 0,
      })) as unknown as Record<string, unknown>
    } catch {
      return { success: false, error: '房間不存在' }
    }
  } else {
    const res = await payload.find({
      collection: 'style-game-rooms',
      where: { inviteCode: { equals: input.inviteCode } } as Where,
      limit: 1,
      depth: 0,
    })
    if (res.docs.length === 0) {
      return { success: false, error: '邀請碼無效' }
    }
    room = res.docs[0] as unknown as Record<string, unknown>
  }

  if (!room) {
    return { success: false, error: '房間不存在' }
  }
  if (room.status !== 'waiting') {
    return { success: false, reason: 'room_not_waiting', error: `房間狀態 ${room.status}，無法加入` }
  }

  const participants =
    (room.participants as Array<Record<string, unknown>> | undefined) ?? []
  const capacity = (room.capacity as number) || 2

  // 不重複加入（同 user 已 active 則 noop）
  const existingActive = participants.find((p) => {
    const u = p.user
    const uId = typeof u === 'object' && u ? (u as Record<string, unknown>).id : u
    return String(uId) === String(userId) && p.status === 'active'
  })
  if (existingActive) {
    return {
      success: true,
      data: {
        roomId: room.id as number | string,
        participantCount: participants.length,
        full: participants.filter((p) => p.status === 'active').length >= capacity,
      },
    }
  }

  const activeCount = participants.filter((p) => p.status === 'active').length
  if (activeCount >= capacity) {
    return { success: false, reason: 'room_full', error: '房間已滿' }
  }

  const newParticipant = {
    user: userId,
    role: input.role ?? 'member',
    joinedAt: new Date().toISOString(),
    status: 'active' as const,
  }
  const nextParticipants = [...participants, newParticipant]
  const nextActive = nextParticipants.filter((p) => p.status === 'active').length
  const full = nextActive >= capacity
  const nextStatus = full ? 'active' : 'waiting'

  try {
    await (payload.update as (args: {
      collection: 'style-game-rooms'
      id: number | string
      data: unknown
      overrideAccess?: boolean
    }) => Promise<Record<string, unknown>>)({
      collection: 'style-game-rooms',
      id: room.id as number | string,
      data: {
        participants: nextParticipants,
        status: nextStatus,
        ...(full ? { startedAt: new Date().toISOString() } : {}),
      },
      overrideAccess: true,
    })

    return {
      success: true,
      data: {
        roomId: room.id as number | string,
        participantCount: nextParticipants.length,
        full,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Join room failed',
    }
  }
}

// ── 5. createStyleWish ──

export interface CreateStyleWishInput {
  title: string
  description: string
  bountyPoints?: number
  budgetHint?: string
  referencePhotos?: Array<number | string>
}

export async function createStyleWish(
  userId: string | number,
  input: CreateStyleWishInput,
): Promise<ActionResult<{ wishId: number | string; bountyPoints: number }>> {
  if (!input.title || input.title.length > MAX_TITLE_LEN) {
    return { success: false, error: `標題 1-${MAX_TITLE_LEN} 字` }
  }
  if (!input.description || input.description.length > MAX_DESCRIPTION_LEN) {
    return { success: false, error: `描述 1-${MAX_DESCRIPTION_LEN} 字` }
  }
  const bountyPoints = input.bountyPoints ?? 0
  if (bountyPoints < MIN_BOUNTY || bountyPoints > MAX_BOUNTY) {
    return { success: false, error: `bountyPoints 需在 ${MIN_BOUNTY}-${MAX_BOUNTY}` }
  }
  if (input.referencePhotos && input.referencePhotos.length > MAX_REFERENCE_PHOTOS) {
    return { success: false, error: `參考圖最多 ${MAX_REFERENCE_PHOTOS} 張` }
  }

  const payload = await getPayload({ config })

  // 預扣點數（bountyPoints > 0 時）
  if (bountyPoints > 0) {
    try {
      const user = (await payload.findByID({
        collection: 'users',
        id: userId,
      })) as unknown as Record<string, unknown>
      const currentPoints = (user.points as number) || 0
      if (currentPoints < bountyPoints) {
        return {
          success: false,
          reason: 'insufficient_points',
          error: `點數不足（需要 ${bountyPoints}，現有 ${currentPoints}）`,
        }
      }
      // 扣除會員點數 + 開流水帳
      await (payload.update as (args: {
        collection: 'users'
        id: number | string
        data: unknown
      }) => Promise<Record<string, unknown>>)({
        collection: 'users',
        id: userId,
        data: { points: currentPoints - bountyPoints } as never,
      })
      await (payload.create as (args: {
        collection: 'points-transactions'
        data: unknown
      }) => Promise<Record<string, unknown>>)({
        collection: 'points-transactions',
        data: {
          user: userId,
          amount: -bountyPoints,
          type: 'redeem',
          source: 'game',
          description: `[wish_pool] 許願預扣 ${bountyPoints} 點`,
          balance: currentPoints - bountyPoints,
        } as never,
      })
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : '預扣點數失敗',
      }
    }
  }

  try {
    const wish = (await (payload.create as (args: {
      collection: 'style-wishes'
      data: unknown
      overrideAccess?: boolean
    }) => Promise<Record<string, unknown>>)({
      collection: 'style-wishes',
      data: {
        seeker: userId,
        title: input.title,
        description: input.description,
        bountyPoints,
        budgetHint: input.budgetHint,
        referencePhotos: input.referencePhotos?.map((id) => ({ image: id })),
        status: 'open',
        // expiresAt 由 beforeChange hook default +14d（但我們顯式帶也可以）
        expiresAt: new Date(Date.now() + DEFAULT_WISH_DURATION_MS).toISOString(),
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return {
      success: true,
      data: { wishId: wish.id as number | string, bountyPoints },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Create wish failed',
    }
  }
}

// ── 6. grantStyleWish (附加到 wish.grants) ──

export interface GrantStyleWishInput {
  wishId: number | string
  submissionId: number | string
  note?: string
}

export async function grantStyleWish(
  granterId: string | number,
  input: GrantStyleWishInput,
): Promise<ActionResult<{ wishId: number | string; grantCount: number }>> {
  if (input.note && input.note.length > MAX_NOTE_LEN) {
    return { success: false, error: `留言最多 ${MAX_NOTE_LEN} 字` }
  }

  const payload = await getPayload({ config })

  let wish: Record<string, unknown>
  try {
    wish = (await payload.findByID({
      collection: 'style-wishes',
      id: input.wishId,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    return { success: false, error: '許願不存在' }
  }

  if (wish.status !== 'open') {
    return { success: false, reason: 'wish_closed', error: `許願狀態 ${wish.status}，無法回應` }
  }

  // 驗證 submission 是 granter 自己的
  let submission: Record<string, unknown>
  try {
    submission = (await payload.findByID({
      collection: 'style-submissions',
      id: input.submissionId,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    return { success: false, error: '作品不存在' }
  }
  const subPlayer = submission.player
  const subPlayerId =
    typeof subPlayer === 'object' && subPlayer
      ? ((subPlayer as Record<string, unknown>).id as number | string)
      : subPlayer
  if (String(subPlayerId) !== String(granterId)) {
    return { success: false, error: '只能回應自己的作品' }
  }

  // 不能對自己的許願回應（seeker === granter）
  const seeker = wish.seeker
  const seekerId =
    typeof seeker === 'object' && seeker
      ? ((seeker as Record<string, unknown>).id as number | string)
      : seeker
  if (String(seekerId) === String(granterId)) {
    return { success: false, error: '不能回應自己的許願' }
  }

  const grants = (wish.grants as Array<Record<string, unknown>> | undefined) ?? []
  // 防重複（同 granter+submission 組合不重覆加）
  const dup = grants.find((g) => {
    const gSub = g.submission
    const gSubId =
      typeof gSub === 'object' && gSub ? (gSub as Record<string, unknown>).id : gSub
    return String(gSubId) === String(input.submissionId)
  })
  if (dup) {
    return { success: true, data: { wishId: input.wishId, grantCount: grants.length } }
  }

  const nextGrants = [
    ...grants,
    {
      granter: granterId,
      submission: input.submissionId,
      note: input.note,
    },
  ]

  try {
    await (payload.update as (args: {
      collection: 'style-wishes'
      id: number | string
      data: unknown
      overrideAccess?: boolean
    }) => Promise<Record<string, unknown>>)({
      collection: 'style-wishes',
      id: input.wishId,
      data: { grants: nextGrants },
      overrideAccess: true,
    })

    return {
      success: true,
      data: { wishId: input.wishId, grantCount: nextGrants.length },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Grant failed',
    }
  }
}

// ── 7. pickWinningGrant (seeker 選出得獎作品；觸發點數轉移) ──

export interface PickWinningGrantInput {
  wishId: number | string
  submissionId: number | string
}

export async function pickWinningGrant(
  seekerId: string | number,
  input: PickWinningGrantInput,
): Promise<
  ActionResult<{ wishId: number | string; granterId: number | string; bountyPoints: number }>
> {
  const payload = await getPayload({ config })

  let wish: Record<string, unknown>
  try {
    wish = (await payload.findByID({
      collection: 'style-wishes',
      id: input.wishId,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    return { success: false, error: '許願不存在' }
  }

  const seekerField = wish.seeker
  const seekerFieldId =
    typeof seekerField === 'object' && seekerField
      ? ((seekerField as Record<string, unknown>).id as number | string)
      : seekerField
  if (String(seekerFieldId) !== String(seekerId)) {
    return { success: false, error: '只有許願者能挑選得獎作品' }
  }
  if (wish.status !== 'open') {
    return { success: false, reason: 'wish_closed', error: `許願狀態 ${wish.status}` }
  }

  const grants = (wish.grants as Array<Record<string, unknown>> | undefined) ?? []
  const match = grants.find((g) => {
    const gSub = g.submission
    const gSubId =
      typeof gSub === 'object' && gSub ? (gSub as Record<string, unknown>).id : gSub
    return String(gSubId) === String(input.submissionId)
  })
  if (!match) {
    return { success: false, error: '此作品不在回應列表中' }
  }

  const granterField = match.granter
  const granterId =
    typeof granterField === 'object' && granterField
      ? ((granterField as Record<string, unknown>).id as number | string)
      : (granterField as number | string)
  const bountyPoints = (wish.bountyPoints as number) || 0

  try {
    // 1. 更新 wish 狀態
    await (payload.update as (args: {
      collection: 'style-wishes'
      id: number | string
      data: unknown
      overrideAccess?: boolean
    }) => Promise<Record<string, unknown>>)({
      collection: 'style-wishes',
      id: input.wishId,
      data: {
        winningGrant: input.submissionId,
        status: 'granted',
      },
      overrideAccess: true,
    })

    // 2. 標記 submission 為 winner（feed 排序用）
    try {
      await (payload.update as (args: {
        collection: 'style-submissions'
        id: number | string
        data: unknown
        overrideAccess?: boolean
      }) => Promise<Record<string, unknown>>)({
        collection: 'style-submissions',
        id: input.submissionId,
        data: { status: 'winner' },
        overrideAccess: true,
      })
    } catch {
      // 非關鍵，log 但不擋
    }

    // 3. 若有 bountyPoints，轉給 granter（走 recordGamePlay 自動加分 + 建 MiniGameRecord）
    if (bountyPoints > 0) {
      await recordGamePlay({
        userId: String(granterId),
        gameType: 'wish_pool',
        outcome: 'win',
        prizeType: 'points',
        prizeAmount: bountyPoints,
        prizeDescription: `許願池獲選：${wish.title ?? ''}`,
        metadata: { wishId: input.wishId, submissionId: input.submissionId },
      })
    }

    return {
      success: true,
      data: {
        wishId: input.wishId,
        granterId,
        bountyPoints,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Pick winner failed',
    }
  }
}

// ── 8. leaveStyleRoom / settleStyleRoom ──
// 留給下一個 PR：需要配合 UI 流程設計（host vs member 權限、早期離開 penalty 等）
