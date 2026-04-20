import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit } from '@/lib/rateLimit'
import {
  createStyleRoom,
  joinStyleRoom,
  isSocialGameType,
} from '@/lib/games/socialGameActions'

/**
 * POST /api/games/[slug]/room
 *
 * 房間類社交遊戲操作（style_pk / co_create / blind_box / team_style）。
 * Leave / settle 留給後續 PR（需配合 UI 流程設計 host 權限 + 早退 penalty）。
 *
 * Body:
 *   { action: 'create', capacity?, visibility?, theme?, settings? }
 *   { action: 'join',   roomId? | inviteCode?, role? }
 *
 * Rate limit：每分鐘 10 次（建房較慢；join 可能多次重試）。
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    if (!isSocialGameType(slug)) {
      return NextResponse.json(
        { success: false, error: `Invalid game slug: ${slug}` },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const userId = user.id as unknown as string | number

    const rl = checkRateLimit(`social-room:${userId}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `操作太頻繁，請 ${rl.retryAfter}s 後再試`,
          retryAfter: rl.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }

    let body: {
      action?: 'create' | 'join'
      capacity?: number
      visibility?: 'private' | 'friends' | 'public'
      theme?: string
      settings?: Record<string, unknown>
      roomId?: number | string
      inviteCode?: string
      role?: 'member' | 'spectator'
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    if (body.action === 'create') {
      const result = await createStyleRoom(userId, {
        gameType: slug,
        capacity: body.capacity,
        visibility: body.visibility,
        theme: body.theme,
        settings: body.settings,
      })
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (body.action === 'join') {
      if (!body.roomId && !body.inviteCode) {
        return NextResponse.json(
          { success: false, error: '需要 roomId 或 inviteCode' },
          { status: 400 },
        )
      }
      const result = await joinStyleRoom(userId, {
        roomId: body.roomId,
        inviteCode: body.inviteCode,
        role: body.role,
      })
      const status = result.success
        ? 200
        : result.reason === 'room_full'
          ? 409
          : result.reason === 'room_not_waiting'
            ? 409
            : 400
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${body.action}` },
      { status: 400 },
    )
  } catch (error) {
    console.error('[room] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/games/[slug]/room?id=123 | ?code=ABCD1234
 *
 * 讀取房間狀態（polling 用）。回傳 access 由 Payload access 層把關，
 * 只有 host / participants / public-settled 看得到。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    if (!isSocialGameType(slug)) {
      return NextResponse.json(
        { success: false, error: `Invalid game slug: ${slug}` },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const code = url.searchParams.get('code')
    if (!id && !code) {
      return NextResponse.json(
        { success: false, error: 'Missing ?id= or ?code=' },
        { status: 400 },
      )
    }

    // 走 user 身份（非 overrideAccess）讓 access control 擋
    if (id) {
      try {
        const room = await payload.findByID({
          collection: 'style-game-rooms',
          id,
          user,
        })
        return NextResponse.json({ success: true, data: room })
      } catch {
        return NextResponse.json(
          { success: false, error: '房間不存在或無權查看' },
          { status: 404 },
        )
      }
    }

    // code
    const res = await payload.find({
      collection: 'style-game-rooms',
      where: { inviteCode: { equals: code } } as never,
      limit: 1,
      user,
    })
    if (res.docs.length === 0) {
      return NextResponse.json(
        { success: false, error: '房間不存在或無權查看' },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true, data: res.docs[0] })
  } catch (error) {
    console.error('[room GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
