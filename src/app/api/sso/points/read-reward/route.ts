import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getSsoClient, verifyClientSecret } from '@/lib/sso/authorizationCode'
import {
  applyPointsMultiplier,
  isValidReadSlug,
  readRewardConfig,
  readRewardDescription,
  taipeiStartOfToday,
} from '@/lib/sso/readReward'
import { resolvePointsMultiplier } from '@/lib/loyalty/pointsMultiplier'

/**
 * 金老佛爺部落格「看文章賺點數」server-to-server endpoint。
 * 呼叫端是 blog.kimlafayette.com 的 auth/points.php（帶 client secret），
 * 不直接暴露給瀏覽器 — 會員身分由 PHP 端的 kim_member_session 驗過
 * 後以 user_id 轉發進來。
 *
 * 防濫用三道閘：
 *   1. 每人每篇文章終身一次（description 當防重複鍵）
 *   2. 每人每日上限 N 篇（台北時區，KIM_BLOG_READ_DAILY_LIMIT）
 *   3. 文章必須是 published 且勾選同步 Kim 的真實文章
 */

interface ReadRewardRequest {
  client_id?: string
  client_secret?: string
  user_id?: string
  slug?: string
  dwell_seconds?: number
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}

export async function POST(request: NextRequest) {
  let body: ReadRewardRequest
  try {
    body = (await request.json()) as ReadRewardRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  let client
  try {
    client = getSsoClient(body.client_id || '')
  } catch (error) {
    console.error('[sso/read-reward] configuration error:', error)
    return json({ error: 'SSO is not configured' }, 503)
  }
  if (
    !client ||
    !body.client_secret ||
    !verifyClientSecret(body.client_secret, client)
  ) {
    return json({ error: 'Invalid client authentication' }, 401)
  }

  if (!isValidReadSlug(body.slug)) {
    return json({ error: 'Invalid article slug' }, 400)
  }
  const slug = body.slug
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) {
    return json({ error: 'Missing member id' }, 400)
  }

  const rewardConfig = readRewardConfig()
  const dwellSeconds = Number(body.dwell_seconds)
  if (!Number.isFinite(dwellSeconds) || dwellSeconds < rewardConfig.minDwellSeconds) {
    return json({ awarded: 0, points: null, reason: 'dwell_too_short' }, 200)
  }

  const payload = await getPayload({ config })

  // depth 1：memberTier 要 populate 出 slug 給倍率解析用
  let user: Record<string, unknown>
  try {
    user = (await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 1,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return json({ error: 'Member no longer exists' }, 404)
  }
  if ('_verified' in user && user._verified === false) {
    return json({ error: 'Email verification is required' }, 403)
  }

  const article = await payload.find({
    collection: 'blog-posts',
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
        { publishToKimLafayette: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
  })
  if (article.totalDocs === 0) {
    return json({ error: 'Unknown article' }, 404)
  }

  const description = readRewardDescription(slug)
  const currentBalance = typeof user.points === 'number' ? user.points : 0

  const existing = await payload.find({
    collection: 'points-transactions',
    where: {
      and: [
        { user: { equals: user.id as string | number } },
        { source: { equals: 'kim_blog_read' } },
        { description: { equals: description } },
      ],
    },
    limit: 1,
    depth: 0,
  })
  if (existing.totalDocs > 0) {
    return json(
      { awarded: 0, points: currentBalance, reason: 'already_rewarded' },
      200,
    )
  }

  const todayCount = await payload.find({
    collection: 'points-transactions',
    where: {
      and: [
        { user: { equals: user.id as string | number } },
        { source: { equals: 'kim_blog_read' } },
        { createdAt: { greater_than: taipeiStartOfToday().toISOString() } },
      ],
    },
    limit: 0,
    depth: 0,
  })
  if (todayCount.totalDocs >= rewardConfig.dailyLimit) {
    return json(
      { awarded: 0, points: currentBalance, reason: 'daily_limit' },
      200,
    )
  }

  // 會員等級 + 訂閱點數倍率，與消費回饋同一套規則（Orders 付款 hook）
  const multiplier = await resolvePointsMultiplier(payload, user)
  const awardedPoints = applyPointsMultiplier(rewardConfig.points, multiplier)

  // local API 會被 PointsTransactions hooks 跳過（req.payloadAPI === 'local'），
  // 所以 users.points 要自己同步 — 與 gameActions 相同 pattern
  const newBalance = currentBalance + awardedPoints
  try {
    await (payload.create as (args: {
      collection: 'points-transactions'
      data: Record<string, unknown>
    }) => Promise<unknown>)({
      collection: 'points-transactions',
      data: {
        user: user.id,
        amount: awardedPoints,
        type: 'earn',
        source: 'kim_blog_read',
        description,
        balance: newBalance,
      },
    })
    await (payload.update as (args: {
      collection: 'users'
      id: string | number
      data: Record<string, unknown>
    }) => Promise<unknown>)({
      collection: 'users',
      id: user.id as string | number,
      data: { points: newBalance },
    })
  } catch (error) {
    console.error('[sso/read-reward] award failed:', error)
    return json({ error: 'Reward could not be recorded' }, 500)
  }

  return json({ awarded: awardedPoints, points: newBalance, reason: null }, 200)
}
