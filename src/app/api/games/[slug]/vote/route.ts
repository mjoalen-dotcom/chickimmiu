import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit } from '@/lib/rateLimit'
import { castStyleVote, isSocialGameType } from '@/lib/games/socialGameActions'

/**
 * POST /api/games/[slug]/vote
 *
 * slug 目前純粹做 sanity check — 實際投票邏輯只需要 submissionId + voteType。
 * （UNIQUE (voter, submission, voteType) 約束擋重複票）
 *
 * Body:
 *   {
 *     submissionId: number     // required
 *     voteType: 'pk_pick' | 'like' | 'star' | 'score'   // default 'like'
 *     score?: number           // voteType='score' 時必填 1-10
 *   }
 *
 * Rate limit：每分鐘 30 票（不同 submission，仍為正常瀏覽速度）。
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

    const rl = checkRateLimit(`social-vote:${userId}`, 30, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `投票太頻繁，請 ${rl.retryAfter}s 後再試`,
          retryAfter: rl.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }

    let body: {
      submissionId?: number | string
      voteType?: 'pk_pick' | 'like' | 'star' | 'score'
      score?: number
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.submissionId) {
      return NextResponse.json(
        { success: false, error: 'Missing submissionId' },
        { status: 400 },
      )
    }

    const result = await castStyleVote(userId, {
      submissionId: body.submissionId,
      voteType: body.voteType ?? 'like',
      score: body.score,
    })

    const status = result.success
      ? 200
      : result.reason === 'duplicate_vote'
        ? 409
        : result.reason === 'self_vote'
          ? 403
          : 400
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('[vote] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
