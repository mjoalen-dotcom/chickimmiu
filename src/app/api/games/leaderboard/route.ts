import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * Leaderboard API (public)
 * GET /api/games/leaderboard?period=daily|weekly|monthly|all_time&limit=20
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const period = searchParams.get('period') || 'all_time'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    const validPeriods = ['daily', 'weekly', 'monthly', 'all_time']
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { success: false, error: `Invalid period. Use: ${validPeriods.join(', ')}` },
        { status: 400 },
      )
    }

    // Determine the period key
    const now = new Date()
    let periodKey: string

    switch (period) {
      case 'daily':
        periodKey = now.toISOString().split('T')[0]
        break
      case 'weekly': {
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        periodKey = weekStart.toISOString().split('T')[0]
        break
      }
      case 'monthly':
        periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        break
      default:
        periodKey = 'all_time'
    }

    const payload = await getPayload({ config })

    const where: Record<string, unknown> = {
      and: [
        { gameType: { equals: `leaderboard_${period}` } },
        { 'metadata.periodKey': { equals: periodKey } },
      ],
    }

    const results = await payload.find({
      collection: 'mini-game-records',
      where: where as Where,
      limit,
      sort: '-metadata.totalPoints' as never,
      depth: 1, // Populate player relationship
    })

    const leaderboard = results.docs.map((doc, index) => {
      const record = doc as unknown as Record<string, unknown>
      const meta = (record.metadata as unknown as Record<string, unknown>) || {}
      const rawPlayer = record.player

      let playerName = '匿名玩家'
      let playerId = ''
      let avatar: string | null = null

      if (typeof rawPlayer === 'object' && rawPlayer !== null) {
        const playerObj = rawPlayer as unknown as Record<string, unknown>
        playerName = (playerObj.name as string) || '匿名玩家'
        playerId = playerObj.id as unknown as string
        if (playerObj.avatar && typeof playerObj.avatar === 'object') {
          const avatarObj = playerObj.avatar as unknown as Record<string, unknown>
          avatar = (avatarObj.url as string) || null
        }
      } else if (typeof rawPlayer === 'string') {
        playerId = rawPlayer
      }

      return {
        rank: index + 1,
        userId: playerId,
        name: playerName,
        avatar,
        totalPoints: (meta.totalPoints as number) || 0,
        totalWins: (meta.totalWins as number) || 0,
        totalGames: (meta.totalGames as number) || 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        period,
        periodKey,
        leaderboard,
        total: results.totalDocs,
      },
    })
  } catch (error) {
    console.error('Leaderboard GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
