import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import {
  GAME_CONFIGS,
  checkDailyPlays,
  drawPrize,
  recordGamePlay,
  updateLeaderboard,
  checkAndAwardBadges,
  getPlayerStats,
  performDailyCheckin,
  getTpeDateString,
} from '@/lib/games/gameEngine'
import { startChallenge, submitChallenge } from '@/lib/games/fashionChallengeEngine'

/**
 * Games API
 * GET  /api/games — game configs, daily play status, leaderboard summary
 * POST /api/games — play a game or check in
 */
export async function GET(req: NextRequest) {
  // Auth/init is the only hard dependency — if this fails the whole route is useless.
  // Downstream reads (leaderboard, stats, per-game daily status) each get their own
  // try/catch so a single subsystem glitch (e.g. missing DB column, malformed JSON)
  // can't poison the primary daily-checkin flow the user actually came for.
  let payload: Awaited<ReturnType<typeof getPayload>>
  let user: Awaited<ReturnType<typeof payload.auth>>['user']
  try {
    payload = await getPayload({ config })
    ;({ user } = await payload.auth({ headers: req.headers }))
  } catch (error) {
    console.error('[games GET] auth/init failed:', error)
    return NextResponse.json(
      { success: false, error: '服務暫時無法使用，請稍後重試' },
      { status: 503 },
    )
  }

  if (!user) {
    return NextResponse.json(
      { success: false, error: '請先登入' },
      { status: 401 },
    )
  }

  const userId = user.id as unknown as string
  const userData = user as unknown as Record<string, unknown>

  // checkinState is derived purely from the already-loaded user object, so it's safe.
  const lastCheckInDate = (userData.lastCheckInDate as string) || ''
  const todayTpe = getTpeDateString()
  const checkinState = {
    totalCheckIns: (userData.totalCheckIns as number) || 0,
    consecutiveCheckIns: (userData.consecutiveCheckIns as number) || 0,
    lastCheckInDate,
    alreadyCheckedToday: Boolean(lastCheckInDate) && lastCheckInDate === todayTpe,
  }

  // Per-game daily play status
  const dailyStatus: Record<string, unknown> = {}
  try {
    for (const gameType of Object.keys(GAME_CONFIGS)) {
      dailyStatus[gameType] = await checkDailyPlays(userId, gameType)
    }
  } catch (error) {
    console.error('[games GET] dailyStatus failed:', error)
  }

  // Aggregate player stats
  let stats: Awaited<ReturnType<typeof getPlayerStats>> = {
    totalGames: 0,
    totalWins: 0,
    totalPointsEarned: 0,
    currentStreak: 0,
    badges: [],
  }
  try {
    stats = await getPlayerStats(userId)
  } catch (error) {
    console.error('[games GET] getPlayerStats failed:', error)
  }

  // All-time leaderboard (top 5) — isolate the JSON-sorted query and per-player
  // findByID lookups so a single weird row can't take down the whole GET.
  let topPlayers: Array<{
    userId: string
    name: string
    totalPoints: unknown
    totalWins: unknown
    totalGames: unknown
  }> = []
  try {
    const leaderboardSummary = await payload.find({
      collection: 'mini-game-records',
      where: {
        and: [
          { gameType: { equals: 'leaderboard_all_time' as never } },
          { 'metadata.periodKey': { equals: 'all_time' } },
        ],
      } as Where,
      limit: 5,
      sort: '-metadata.totalPoints' as never,
    })

    topPlayers = await Promise.all(
      leaderboardSummary.docs.map(async (doc) => {
        const record = doc as unknown as Record<string, unknown>
        const meta = (record.metadata as unknown as Record<string, unknown>) || {}
        const rawPlayer = record.player

        let playerName = '匿名玩家'
        let playerId = ''

        if (typeof rawPlayer === 'object' && rawPlayer !== null) {
          const playerObj = rawPlayer as unknown as Record<string, unknown>
          playerName = (playerObj.name as string) || '匿名玩家'
          playerId = playerObj.id as unknown as string
        } else if (typeof rawPlayer === 'string') {
          playerId = rawPlayer
          try {
            const playerDoc = await payload.findByID({ collection: 'users', id: rawPlayer })
            playerName = (playerDoc as unknown as Record<string, unknown>).name as string || '匿名玩家'
          } catch {
            // Player may have been deleted
          }
        }

        return {
          userId: playerId,
          name: playerName,
          totalPoints: meta.totalPoints || 0,
          totalWins: meta.totalWins || 0,
          totalGames: meta.totalGames || 0,
        }
      }),
    )
  } catch (error) {
    console.error('[games GET] leaderboard failed:', error)
  }

  return NextResponse.json({
    success: true,
    data: {
      configs: Object.fromEntries(
        Object.entries(GAME_CONFIGS).map(([key, cfg]) => [
          key,
          { pointsCost: cfg.pointsCost, dailyLimit: cfg.dailyLimit },
        ]),
      ),
      dailyStatus,
      playerStats: stats,
      leaderboard: topPlayers,
      checkinState,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 },
      )
    }

    const userId = user.id as unknown as string
    const userData = user as unknown as Record<string, unknown>
    const body = await req.json()
    const { action, gameType } = body as { action: string; gameType?: string }

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action' },
        { status: 400 },
      )
    }

    // ── Action: checkin ──
    // Phase 5.6：走 performDailyCheckin，啟用 streak 追蹤（Asia/Taipei）
    if (action === 'checkin') {
      let result: Awaited<ReturnType<typeof performDailyCheckin>>
      try {
        result = await performDailyCheckin(userId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : '簽到失敗'
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }

      await updateLeaderboard(userId, result.prize.amount, false)
      const newBadges = await checkAndAwardBadges(userId)

      return NextResponse.json({
        success: true,
        data: {
          prize: result.prize,
          record: result.record,
          newBadges,
          streak: {
            totalCheckIns: result.totalCheckIns,
            consecutiveCheckIns: result.consecutiveCheckIns,
            lastCheckInDate: result.lastCheckInDate,
            streakReset: result.streakReset,
            streakBonus: result.streakBonus,
          },
        },
      })
    }

    // ── Action: play ──
    if (action === 'play') {
      if (!gameType) {
        return NextResponse.json(
          { success: false, error: 'Missing gameType' },
          { status: 400 },
        )
      }

      // Fashion challenge has its own flow
      if (gameType === 'fashion_challenge') {
        const subAction = body.subAction as string | undefined
        if (subAction === 'submit') {
          const { challengeId, selectedItems } = body as {
            challengeId: string
            selectedItems: string[]
          }
          if (!challengeId || !selectedItems) {
            return NextResponse.json(
              { success: false, error: 'Missing challengeId or selectedItems' },
              { status: 400 },
            )
          }
          const result = await submitChallenge(userId, challengeId, selectedItems)
          return NextResponse.json({ success: result.success, data: result.result, error: result.error })
        }

        // Default: start a new challenge
        const dailyPlays = await checkDailyPlays(userId, 'fashion_challenge')
        if (!dailyPlays.canPlay) {
          return NextResponse.json(
            { success: false, error: '今日穿搭挑戰次數已達上限' },
            { status: 400 },
          )
        }

        // Charge points if free plays exhausted
        if (dailyPlays.requiresPoints) {
          const gameConfig = GAME_CONFIGS[gameType]
          const userPoints = (userData.points as number) || 0
          if (userPoints < gameConfig.pointsCost) {
            return NextResponse.json(
              { success: false, error: `點數不足，需要 ${gameConfig.pointsCost} 點`, required: gameConfig.pointsCost, current: userPoints },
              { status: 400 },
            )
          }
        }

        const session = await startChallenge(userId)
        return NextResponse.json({ success: true, data: session })
      }

      // Spin wheel or scratch card
      if (gameType !== 'spin_wheel' && gameType !== 'scratch_card') {
        return NextResponse.json(
          { success: false, error: `Unknown gameType: ${gameType}` },
          { status: 400 },
        )
      }

      const gameConfig = GAME_CONFIGS[gameType]
      if (!gameConfig) {
        return NextResponse.json(
          { success: false, error: 'Invalid game configuration' },
          { status: 400 },
        )
      }

      const dailyPlays = await checkDailyPlays(userId, gameType)
      if (!dailyPlays.canPlay) {
        return NextResponse.json(
          { success: false, error: '今日遊玩次數已達上限' },
          { status: 400 },
        )
      }

      // Determine if points need to be spent
      let pointsSpent = 0
      if (dailyPlays.requiresPoints) {
        const userPoints = (userData.points as number) || 0
        if (userPoints < gameConfig.pointsCost) {
          return NextResponse.json(
            { success: false, error: `點數不足，需要 ${gameConfig.pointsCost} 點`, required: gameConfig.pointsCost, current: userPoints },
            { status: 400 },
          )
        }
        pointsSpent = gameConfig.pointsCost
      }

      // Get tier slug for prize drawing
      let tierSlug = 'ordinary'
      if (userData.memberTier) {
        if (typeof userData.memberTier === 'object' && userData.memberTier !== null) {
          tierSlug = ((userData.memberTier as unknown as Record<string, unknown>).slug as string) || 'ordinary'
        }
      }
      const creditScore = (userData.creditScore as number) || 100

      const prize = drawPrize(gameType, tierSlug, creditScore)
      if (!prize) {
        return NextResponse.json(
          { success: false, error: 'No prizes available' },
          { status: 500 },
        )
      }

      const isWin = prize.amount > gameConfig.pointsCost
      const record = await recordGamePlay({
        userId,
        gameType,
        outcome: isWin ? 'win' : 'completed',
        prizeType: prize.type,
        prizeAmount: prize.amount,
        prizeDescription: prize.prize,
        pointsSpent,
        tierSlug,
        creditScore,
      })

      await updateLeaderboard(userId, prize.amount, isWin)
      const newBadges = await checkAndAwardBadges(userId)

      return NextResponse.json({
        success: true,
        data: {
          prize,
          pointsSpent,
          record,
          newBadges,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 },
    )
  } catch (error) {
    console.error('Games POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
