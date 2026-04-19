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

    // Get daily play status for all game types
    const gameTypes = Object.keys(GAME_CONFIGS)
    const dailyStatus: Record<string, unknown> = {}

    for (const gameType of gameTypes) {
      dailyStatus[gameType] = await checkDailyPlays(userId, gameType)
    }

    // Get player stats
    const stats = await getPlayerStats(userId)

    // Phase 5.7：把使用者目前的 daily-checkin streak 狀態一併回傳，UI 初始化用。
    const userData = user as unknown as Record<string, unknown>
    const lastCheckInDate = (userData.lastCheckInDate as string) || ''
    const todayTpe = getTpeDateString()
    const checkinState = {
      totalCheckIns: (userData.totalCheckIns as number) || 0,
      consecutiveCheckIns: (userData.consecutiveCheckIns as number) || 0,
      lastCheckInDate,
      alreadyCheckedToday: Boolean(lastCheckInDate) && lastCheckInDate === todayTpe,
    }

    // Get top 5 for leaderboard summary (all-time)
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

    const topPlayers = await Promise.all(
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

    return NextResponse.json({
      success: true,
      data: {
        configs: Object.fromEntries(
          Object.entries(GAME_CONFIGS).map(([key, cfg]) => [
            key,
            {
              pointsCost: cfg.pointsCost,
              dailyLimit: cfg.dailyLimit,
              // 把 prizeTable 曝給 client 讓 wheel / scratch UI 能 render 真正的獎項名稱；
              // 刻意 strip `weight` — 機率是營運機密，不要透過 API 洩漏。
              prizeTable: cfg.prizeTable.map((p) => ({
                prize: p.prize,
                type: p.type,
                amount: p.amount,
              })),
            },
          ]),
        ),
        dailyStatus,
        playerStats: stats,
        leaderboard: topPlayers,
        checkinState,
      },
    })
  } catch (error) {
    console.error('Games GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
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
