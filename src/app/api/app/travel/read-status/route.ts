import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'

/**
 * GET /api/app/travel/read-status?articleId=xxx
 * ────────────────────────────────────────────
 * App 進文章頁即需判斷要不要顯示獎勵提示（工單 2026-08-25 活動一）。
 * 回傳「這位會員是否已領過這篇」，以及本活動目前的每篇點數與開關。
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const articleId = (req.nextUrl.searchParams.get('articleId') || '').trim()
    if (!articleId) return fail(400, CODES.BAD_REQUEST, '缺少 articleId')

    const settings = await getActivitySettings(payload)
    const existing = await payload.find({
      collection: 'travel-read-rewards',
      where: {
        and: [{ user: { equals: user.id } }, { articleId: { equals: articleId } }],
      } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const claimed = existing.docs[0] as unknown as Record<string, unknown> | undefined
    return ok({
      articleId,
      claimed: Boolean(claimed),
      claimedAt: (claimed?.claimedAt as string) ?? null,
      pointsAwarded: claimed ? Number(claimed.pointsAwarded ?? 0) : null,
      isActive: settings.travelRead.isActive,
      pointsPerArticle: settings.travelRead.pointsPerArticle,
    })
  } catch (err) {
    console.error('[app/travel/read-status] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
