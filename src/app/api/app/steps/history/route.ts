import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import { requireCustomer, ok, fail, CODES } from '@/lib/app-activities/common'

/**
 * GET /api/app/steps/history?page=1&limit=30
 * ─────────────────────────────────────────
 * 工單 2026-08-25 活動三：每日步數與領取狀態的歷史列表（只回本人）。
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const sp = req.nextUrl.searchParams
    const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '30', 10) || 30, 1), 100)

    const res = await payload.find({
      collection: 'step-daily-records',
      where: { user: { equals: user.id } } as Where,
      sort: '-date',
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    const items = res.docs.map((d) => {
      const r = d as unknown as Record<string, unknown>
      const claimed = Array.isArray(r.claimedMilestones)
        ? (r.claimedMilestones as unknown[]).map((v) => Number(v)).filter(Number.isFinite)
        : []
      return {
        date: r.date as string,
        steps: Number(r.steps ?? 0) || 0,
        claimedMilestones: claimed,
      }
    })

    return ok(
      { items },
      {
        meta: {
          page: res.page,
          totalPages: res.totalPages,
          totalDocs: res.totalDocs,
          limit,
        },
      },
    )
  } catch (err) {
    console.error('[app/steps/history] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
