import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit } from '@/lib/rateLimit'
import {
  submitStyleWork,
  isSocialGameType,
  type SubmitStyleWorkInput,
} from '@/lib/games/socialGameActions'

/**
 * POST /api/games/[slug]/submit
 *
 * 提交一份穿搭作品到社交遊戲。slug 為 snake_case gameType（style_pk / weekly_challenge / ...）。
 *
 * Body:
 *   {
 *     images: number[]       // required 1-6 media IDs
 *     caption?: string       // ≤500 字
 *     tags?: string[]        // ≤10 個，每個 ≤20 字
 *     room?: number          // 房間類遊戲需填
 *     parent?: number        // style_relay 接龍用
 *     wish?: number          // wish_pool 回應許願用
 *     theme?: string
 *     metadata?: object
 *   }
 *
 * Rate limit：每分鐘 6 次 + 每日 quota（見 socialGameActions.DEFAULT_DAILY_QUOTA）。
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

    // Per-user rate limit：6 submit/min
    const rl = checkRateLimit(`social-submit:${userId}`, 6, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `投稿太頻繁，請 ${rl.retryAfter}s 後再試`,
          retryAfter: rl.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }

    let body: Partial<SubmitStyleWorkInput>
    try {
      body = (await req.json()) as Partial<SubmitStyleWorkInput>
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const input: SubmitStyleWorkInput = {
      gameType: slug,
      images: body.images ?? [],
      caption: body.caption,
      tags: body.tags,
      room: body.room,
      parent: body.parent,
      wish: body.wish,
      theme: body.theme,
      metadata: body.metadata,
    }

    const result = await submitStyleWork(userId, input)
    const status = result.success ? 200 : result.reason === 'daily_limit' ? 429 : 400
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('[submit] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
