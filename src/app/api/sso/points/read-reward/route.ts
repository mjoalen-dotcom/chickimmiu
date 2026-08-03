import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getSsoClient, verifyClientSecret } from '@/lib/sso/authorizationCode'
import { isValidReadSlug } from '@/lib/sso/readReward'
import { awardKimBlogReadReward } from '@/lib/loyalty/readRewardAward'

/**
 * 金老佛爺部落格「看文章賺點數」server-to-server endpoint。
 * 呼叫端是 blog.kimlafayette.com 的 auth/points.php（帶 client secret），
 * 不直接暴露給瀏覽器 — 會員身分由 PHP 端的 kim_member_session 驗過
 * 後以 user_id 轉發進來。
 *
 * 發點規則（防濫用三道閘）在 awardKimBlogReadReward — 與手機 App 的
 * /api/v1/points/read-reward 共用同一份，勿在這裡各自加規則。
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

  const outcome = await awardKimBlogReadReward(
    payload,
    user,
    slug,
    Number(body.dwell_seconds),
  )
  return json(outcome.body, outcome.status)
}
