import { NextRequest, NextResponse } from 'next/server'
import { resolveBearerUser, UNAUTHORIZED_RESPONSE } from '@/lib/auth/resolveBearerUser'
import { isValidReadSlug } from '@/lib/sso/readReward'
import { awardKimBlogReadReward } from '@/lib/loyalty/readRewardAward'

/**
 * POST /api/v1/points/read-reward
 * ───────────────────────────────
 * 手機 App 的金老佛爺「看文章賺點數」—— Bearer token 認證版。
 *
 * 為什麼另開一條：/api/sso/points/read-reward 是 blog.kimlafayette.com PHP 端的
 * server-to-server 介面（client_secret 認證），secret 不可打包進 App。
 * 發點規則走 awardKimBlogReadReward，與 SSO 版**同一份**（每篇終身一次、
 * 台北時區日限、最短停留、等級/訂閱倍率）。
 *
 * Request:
 *   Authorization: Bearer <token>
 *   { "slug": "<文章 slug（feed API 的 slug 欄位）>", "dwell_seconds": 25 }
 *
 * Response 200（沿用 SSO 版合約；不給分不是錯誤，App 靜默處理）:
 *   { "awarded": 5, "points": 585, "reason": null }
 *   { "awarded": 0, "points": 580,  "reason": "already_rewarded" | "daily_limit" }
 *   { "awarded": 0, "points": null, "reason": "dwell_too_short" }
 *
 * Errors（v1 統一格式）:
 *   400 BAD_REQUEST / 401 UNAUTHORIZED / 404 NOT_FOUND（文章不存在或未同步金老佛爺）/ 500
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      slug?: string
      dwell_seconds?: number
      dwellSeconds?: number
    }

    if (!isValidReadSlug(body.slug)) {
      return NextResponse.json(
        { success: false, error: 'Invalid article slug', code: 'BAD_REQUEST' },
        { status: 400 },
      )
    }

    // Bearer → JWT 前綴轉換交給 resolveBearerUser（payload.auth 原生只認 JWT 前綴）
    const { payload, user: authUser } = await resolveBearerUser(req)
    if (!authUser) {
      return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 })
    }

    // 重新以 depth:1 取 user —— memberTier 要 populate 出 slug 給倍率解析用，
    // token 驗證回傳的 user 不保證帶到
    let user: Record<string, unknown>
    try {
      user = (await payload.findByID({
        collection: 'users',
        id: authUser.id,
        depth: 1,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: 'Member no longer exists', code: 'UNAUTHORIZED' },
        { status: 401 },
      )
    }

    const outcome = await awardKimBlogReadReward(
      payload,
      user,
      body.slug,
      Number(body.dwell_seconds ?? body.dwellSeconds),
    )

    if (outcome.status === 200) {
      return NextResponse.json(outcome.body, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return NextResponse.json(
      {
        success: false,
        error: outcome.body.error,
        code: outcome.status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      },
      { status: outcome.status },
    )
  } catch (err) {
    console.error('[v1/points/read-reward] error', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
