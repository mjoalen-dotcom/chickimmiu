import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  hitBannedWord,
  publicAuthor,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'

/**
 * GET  /api/app/group-buy/comments?reviewId=&page=&limit=   讀留言
 * POST /api/app/group-buy/comments                          建立留言
 * ──────────────────────────────────────────────────────────────────
 * 工單 2026-08-25 活動二「留言」：
 *   ‧ 依共通規則 #1，留言不再發放任何獎勵；功能保留
 *   ‧ 上限 300 字；需過 bannedWords（與分享共用同一份清單）
 *   ‧ 僅 status='approved' 的分享可以留言
 *   ‧ 最多兩層：parentCommentId 若本身是一則回覆，解析為它的頂層留言 ID 再存，
 *     這樣「回覆別人的回覆」仍掛在同一個頂層留言下，留言串不會無限往下疊
 *   ‧ 被隱藏（hidden）的留言不回傳前台
 */
export const dynamic = 'force-dynamic'

const MAX_COMMENT_LENGTH = 300

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const sp = req.nextUrl.searchParams
    const reviewId = sp.get('reviewId')
    if (!reviewId) return fail(400, CODES.BAD_REQUEST, '缺少 reviewId')
    const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10) || 50, 1), 100)

    const res = await payload.find({
      collection: 'group-buy-share-comments',
      where: {
        and: [{ review: { equals: reviewId } }, { status: { equals: 'published' } }],
      } as Where,
      // 對話順序：由舊到新
      sort: 'createdAt',
      page,
      limit,
      depth: 2,
      overrideAccess: true,
    })

    const items = res.docs.map((d) => {
      const r = d as unknown as Record<string, unknown>
      const parent = r.parentCommentId as Record<string, unknown> | number | null | undefined
      return {
        id: r.id,
        author: publicAuthor(r.user),
        content: (r.content as string) ?? '',
        parentCommentId:
          parent && typeof parent === 'object' ? parent.id : (parent ?? null),
        createdAt: (r.createdAt as string) ?? null,
      }
    })

    return ok(
      { items },
      { meta: { page: res.page, totalPages: res.totalPages, totalDocs: res.totalDocs, limit } },
    )
  } catch (err) {
    console.error('[app/group-buy/comments GET] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const settings = await getActivitySettings(payload)
    const cfg = settings.groupBuyShare
    if (!cfg.isActive) return fail(403, CODES.ACTIVITY_INACTIVE, '活動未開放')

    const body = (await req.json().catch(() => ({}))) as {
      reviewId?: string | number
      content?: string
      parentCommentId?: string | number | null
    }
    const content = (body.content || '').trim()
    if (!body.reviewId) return fail(400, CODES.BAD_REQUEST, '缺少 reviewId')
    if (!content) return fail(400, CODES.BAD_REQUEST, '留言不可為空')
    if (content.length > MAX_COMMENT_LENGTH) {
      return fail(400, CODES.CONTENT_TOO_LONG, '留言超過字數上限', {
        maxLength: MAX_COMMENT_LENGTH,
      })
    }
    if (hitBannedWord(content, cfg.bannedWords)) {
      return fail(400, CODES.BANNED_WORD, '留言含有不允許的字詞')
    }

    // 僅 approved 的分享可以留言
    const shareRes = await payload.find({
      collection: 'group-buy-shares',
      where: {
        and: [{ id: { equals: body.reviewId } }, { status: { equals: 'approved' } }],
      } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const share = shareRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!share) return fail(404, CODES.NOT_FOUND, '找不到可留言的分享')

    // 兩層：把「回覆的回覆」解析回頂層留言
    let parentId: string | number | null = null
    if (body.parentCommentId != null) {
      const pRes = await payload.find({
        collection: 'group-buy-share-comments',
        where: {
          and: [
            { id: { equals: body.parentCommentId } },
            { review: { equals: share.id } },
            { status: { equals: 'published' } },
          ],
        } as Where,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const parent = pRes.docs[0] as unknown as Record<string, unknown> | undefined
      if (!parent) return fail(400, CODES.BAD_REQUEST, '找不到要回覆的留言')
      const grandParent = parent.parentCommentId as Record<string, unknown> | number | null | undefined
      parentId =
        grandParent == null
          ? (parent.id as string | number)
          : ((typeof grandParent === 'object' ? grandParent.id : grandParent) as string | number)
    }

    const created = (await payload.create({
      collection: 'group-buy-share-comments',
      data: {
        review: share.id,
        user: user.id,
        content,
        parentCommentId: parentId ?? undefined,
        status: 'published',
      } as never,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return ok({ id: created.id, parentCommentId: parentId })
  } catch (err) {
    console.error('[app/group-buy/comments POST] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
