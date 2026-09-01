import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import { requireCustomer, ok, fail, CODES } from '@/lib/app-activities/common'

/**
 * GET /api/app/group-buy/articles?page=1&limit=50
 * ──────────────────────────────────────────────
 * 可分享的團購文章清單（工單 2026-08-25 活動二）。
 *
 * 取用條件三個都要 —— 第三個容易漏，漏了會讓非公開文章出現在 App 的選單裡：
 *   publishToKimLafayette: true ＋ status: 'published' ＋ visibility: 'public'
 *
 * 需列出全部符合條件的文章，不要只給最近幾篇 —— 分享通常發生在團購結束之後，
 * 會員要找的是舊文章。故 limit 上限放寬到 200，並提供分頁。
 */
export const dynamic = 'force-dynamic'

export const SHAREABLE_ARTICLE_WHERE: Where = {
  and: [
    { publishToKimLafayette: { equals: true } },
    { status: { equals: 'published' } },
    { visibility: { equals: 'public' } },
  ],
}

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const sp = req.nextUrl.searchParams
    const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10) || 50, 1), 200)

    const res = await payload.find({
      collection: 'blog-posts',
      where: SHAREABLE_ARTICLE_WHERE,
      sort: '-publishedAt',
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    const items = res.docs.map((d) => {
      const r = d as unknown as Record<string, unknown>
      return {
        id: r.id as number,
        title: (r.title as string) ?? '',
        slug: (r.slug as string) ?? '',
        publishedAt: (r.publishedAt as string) ?? null,
      }
    })

    return ok(
      { items },
      { meta: { page: res.page, totalPages: res.totalPages, totalDocs: res.totalDocs, limit } },
    )
  } catch (err) {
    console.error('[app/group-buy/articles] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
