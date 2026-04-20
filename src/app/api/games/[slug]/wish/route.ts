import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit } from '@/lib/rateLimit'
import {
  createStyleWish,
  grantStyleWish,
  pickWinningGrant,
} from '@/lib/games/socialGameActions'

/**
 * POST /api/games/[slug]/wish
 *
 * 僅 slug='wish_pool' 有效。
 *
 * Body:
 *   { action: 'create', title, description, bountyPoints?, budgetHint?, referencePhotos? }
 *   { action: 'grant',  wishId, submissionId, note? }
 *   { action: 'pick',   wishId, submissionId }   // seeker 選出得獎作品
 *
 * Rate limit：每分鐘 10 次。
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    if (slug !== 'wish_pool') {
      return NextResponse.json(
        { success: false, error: `Wish endpoint 只支援 wish_pool，收到: ${slug}` },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const userId = user.id as unknown as string | number

    const rl = checkRateLimit(`social-wish:${userId}`, 10, 60_000)
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
      action?: 'create' | 'grant' | 'pick'
      title?: string
      description?: string
      bountyPoints?: number
      budgetHint?: string
      referencePhotos?: Array<number | string>
      wishId?: number | string
      submissionId?: number | string
      note?: string
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    if (body.action === 'create') {
      if (!body.title || !body.description) {
        return NextResponse.json(
          { success: false, error: 'Missing title or description' },
          { status: 400 },
        )
      }
      const result = await createStyleWish(userId, {
        title: body.title,
        description: body.description,
        bountyPoints: body.bountyPoints,
        budgetHint: body.budgetHint,
        referencePhotos: body.referencePhotos,
      })
      const status = result.success
        ? 200
        : result.reason === 'insufficient_points'
          ? 402 // Payment Required — 點數不足
          : 400
      return NextResponse.json(result, { status })
    }

    if (body.action === 'grant') {
      if (!body.wishId || !body.submissionId) {
        return NextResponse.json(
          { success: false, error: 'Missing wishId or submissionId' },
          { status: 400 },
        )
      }
      const result = await grantStyleWish(userId, {
        wishId: body.wishId,
        submissionId: body.submissionId,
        note: body.note,
      })
      return NextResponse.json(result, {
        status: result.success ? 200 : result.reason === 'wish_closed' ? 409 : 400,
      })
    }

    if (body.action === 'pick') {
      if (!body.wishId || !body.submissionId) {
        return NextResponse.json(
          { success: false, error: 'Missing wishId or submissionId' },
          { status: 400 },
        )
      }
      const result = await pickWinningGrant(userId, {
        wishId: body.wishId,
        submissionId: body.submissionId,
      })
      return NextResponse.json(result, {
        status: result.success ? 200 : result.reason === 'wish_closed' ? 409 : 400,
      })
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${body.action}` },
      { status: 400 },
    )
  } catch (error) {
    console.error('[wish] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/games/[slug]/wish?id=123
 *
 * 讀取 wish（含 grants 列表）。access 由 Payload 處理：
 *   - status ∈ {open, granted} 任何登入會員可讀
 *   - {closed, expired} 僅 seeker + admin
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    if (slug !== 'wish_pool') {
      return NextResponse.json(
        { success: false, error: `Wish endpoint 只支援 wish_pool，收到: ${slug}` },
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
    if (!id) {
      // No id → list open wishes feed
      const res = await payload.find({
        collection: 'style-wishes',
        where: { status: { equals: 'open' } } as never,
        sort: '-createdAt',
        limit: 20,
        user,
      })
      return NextResponse.json({ success: true, data: res.docs, total: res.totalDocs })
    }

    try {
      const wish = await payload.findByID({
        collection: 'style-wishes',
        id,
        user,
      })
      return NextResponse.json({ success: true, data: wish })
    } catch {
      return NextResponse.json(
        { success: false, error: '許願不存在或無權查看' },
        { status: 404 },
      )
    }
  } catch (error) {
    console.error('[wish GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
