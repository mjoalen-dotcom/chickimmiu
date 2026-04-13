import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  createBattleRoom,
  joinBattleRoom,
  playBattle,
  getBattleRoom,
  getShareableLink,
} from '@/lib/games/cardBattleEngine'

/**
 * Card Battle API
 * GET  /api/games/card-battle?roomCode=X — get battle room state
 * POST /api/games/card-battle — create/join/play
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const roomCode = searchParams.get('roomCode')

    if (!roomCode) {
      return NextResponse.json(
        { success: false, error: 'Missing roomCode parameter' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 },
      )
    }

    const room = await getBattleRoom(roomCode)

    if (!room) {
      return NextResponse.json(
        { success: false, error: '找不到此房間' },
        { status: 404 },
      )
    }

    // Mask cards if battle is still in progress (not yet played)
    const userId = user.id as unknown as string
    const safeRoom = { ...room }

    if (room.status !== 'completed') {
      safeRoom.challengerCard = null
      safeRoom.opponentCard = null
    }

    // Generate shareable link
    const userData = user as unknown as Record<string, unknown>
    const referralCode = (userData.referralCode as string) || undefined
    const shareLink = getShareableLink(roomCode, referralCode)

    return NextResponse.json({
      success: true,
      data: {
        room: safeRoom,
        shareLink,
        isChallenger: room.challengerId === userId,
        isOpponent: room.opponentId === userId,
      },
    })
  } catch (error) {
    console.error('Card Battle GET error:', error)
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
    const { action } = body as { action: string }

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action' },
        { status: 400 },
      )
    }

    // ── Action: create ──
    if (action === 'create') {
      const referralCode = (body.referralCode as string) || (userData.referralCode as string) || undefined
      const result = await createBattleRoom(userId, referralCode)

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        )
      }

      const shareLink = getShareableLink(result.roomCode!, referralCode)

      return NextResponse.json({
        success: true,
        data: {
          roomCode: result.roomCode,
          shareLink,
        },
      })
    }

    // ── Action: join ──
    if (action === 'join') {
      const { roomCode } = body as { roomCode?: string }

      if (!roomCode) {
        return NextResponse.json(
          { success: false, error: 'Missing roomCode' },
          { status: 400 },
        )
      }

      const result = await joinBattleRoom(roomCode, userId)

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        )
      }

      return NextResponse.json({
        success: true,
        data: { roomCode, joined: true },
      })
    }

    // ── Action: play ──
    if (action === 'play') {
      const { roomCode } = body as { roomCode?: string }

      if (!roomCode) {
        return NextResponse.json(
          { success: false, error: 'Missing roomCode' },
          { status: 400 },
        )
      }

      const result = await playBattle(roomCode)

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          challengerCard: result.challengerCard,
          opponentCard: result.opponentCard,
          result: result.result,
          winnerId: result.winnerId,
          pointsAwarded: result.pointsAwarded,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 },
    )
  } catch (error) {
    console.error('Card Battle POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
