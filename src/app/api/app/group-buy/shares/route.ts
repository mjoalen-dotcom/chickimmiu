import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  normalizeOrderNumber,
  hitBannedWord,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'
import { visibilityWhere, serializeShare, validateMediaIds } from '@/lib/app-activities/groupBuy'
import { SHAREABLE_ARTICLE_WHERE } from '../articles/route'

/**
 * GET  /api/app/group-buy/shares   清單（篩選 status / isFeatured / user / article）
 * POST /api/app/group-buy/shares   建立分享（狀態 pending，此時不發點）
 * ─────────────────────────────────────────────────────────────────────────────
 * 工單 2026-08-25 活動二。發獎時機是「審核通過時」，不是送出時。
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const sp = req.nextUrl.searchParams
    const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 50)

    const filters: Where[] = [visibilityWhere(user.id)]
    const status = sp.get('status')
    if (status) filters.push({ status: { equals: status } } as Where)
    const featured = sp.get('isFeatured')
    if (featured === 'true' || featured === 'false') {
      filters.push({ isFeatured: { equals: featured === 'true' } } as Where)
    }
    const userFilter = sp.get('user')
    if (userFilter) filters.push({ user: { equals: userFilter } } as Where)
    const article = sp.get('article')
    if (article) filters.push({ article: { equals: article } } as Where)

    const res = await payload.find({
      collection: 'group-buy-shares',
      where: { and: filters } as Where,
      // 預設排序：精選優先，其次由新到舊
      sort: ['-isFeatured', '-createdAt'],
      page,
      limit,
      depth: 2, // 帶出 user.avatar 與 photos.image 的 url
      overrideAccess: true,
    })

    return ok(
      { items: res.docs.map((d) => serializeShare(d, user.id)) },
      { meta: { page: res.page, totalPages: res.totalPages, totalDocs: res.totalDocs, limit } },
    )
  } catch (err) {
    console.error('[app/group-buy/shares GET] error', err)
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
      articleId?: string | number
      orderNumber?: string
      purchaseDate?: string
      content?: string
      photoIds?: Array<string | number>
    }

    const content = (body.content || '').trim()
    const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter((v) => v != null) : []

    // ── 文章：三個條件都要符合（漏了 visibility 會讓非公開文章出現在選單）──
    if (body.articleId == null) return fail(400, CODES.BAD_REQUEST, '缺少文章')
    const articleRes = await payload.find({
      collection: 'blog-posts',
      where: { and: [{ id: { equals: body.articleId } }, SHAREABLE_ARTICLE_WHERE] } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const articleDoc = articleRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!articleDoc) return fail(400, CODES.INVALID_ARTICLE, '此文章無法分享')

    // ── 內容 ──
    if (content.length < cfg.minContentLength) {
      return fail(400, CODES.CONTENT_TOO_SHORT, '分享內容太短', {
        minContentLength: cfg.minContentLength,
      })
    }
    const banned = hitBannedWord(content, cfg.bannedWords)
    if (banned) return fail(400, CODES.BANNED_WORD, '內容含有不允許的字詞')

    // ── 照片：至少 1 張、不超過上限、且必須是本站 media ──
    if (photoIds.length < 1) return fail(400, CODES.PHOTO_REQUIRED, '請至少上傳 1 張照片')
    if (photoIds.length > cfg.maxImages) {
      return fail(400, CODES.TOO_MANY_PHOTOS, '照片張數超過上限', { maxImages: cfg.maxImages })
    }
    if (!(await validateMediaIds(payload, photoIds))) {
      return fail(400, CODES.INVALID_MEDIA, '照片無效，請重新上傳')
    }

    // ── 訂單編號：正規化後 4–40 字 ──
    const orderNumber = normalizeOrderNumber(String(body.orderNumber || ''))
    if (orderNumber.length < 4 || orderNumber.length > 40) {
      return fail(400, CODES.INVALID_ORDER_NUMBER, '訂單編號長度需介於 4–40 字')
    }

    // ── 購買日期：不接受未來日期 ──
    const purchaseDate = (body.purchaseDate || '').trim()
    if (purchaseDate) {
      const t = new Date(purchaseDate).getTime()
      if (!Number.isFinite(t)) return fail(400, CODES.BAD_REQUEST, '購買日期格式錯誤')
      if (t > Date.now()) return fail(400, CODES.FUTURE_PURCHASE_DATE, '購買日期不可為未來日期')
    }

    // ── 訂單去重（跨帳號）：他人用過就擋；本人重用自己的可以發文 ──
    const claimRes = await payload.find({
      collection: 'group-buy-order-claims',
      where: {
        and: [
          { article: { equals: articleDoc.id } },
          { orderNumber: { equals: orderNumber } },
        ],
      } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const claim = claimRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (claim) {
      const claimUserId =
        typeof claim.user === 'object' && claim.user !== null
          ? (claim.user as Record<string, unknown>).id
          : claim.user
      if (String(claimUserId) !== String(user.id)) {
        return fail(409, CODES.ORDER_NUMBER_TAKEN, '這張訂單編號已被使用')
      }
    }

    const now = Date.now()
    const created = (await payload.create({
      collection: 'group-buy-shares',
      data: {
        user: user.id,
        article: articleDoc.id,
        articleTitle: (articleDoc.title as string) ?? '',
        purchaseDate: purchaseDate || undefined,
        orderNumber,
        content,
        photos: photoIds.map((id) => ({ image: id })),
        status: 'pending',
        rewarded: false,
        isFeatured: false,
        commentCount: 0,
        editableUntil: new Date(now + cfg.editableHours * 3600_000).toISOString(),
      } as never,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    // 訂單去重紀錄（本人重用時已存在就不重建）
    if (!claim) {
      await payload
        .create({
          collection: 'group-buy-order-claims',
          data: { article: articleDoc.id, orderNumber, user: user.id } as never,
          overrideAccess: true,
        })
        .catch((e: unknown) => {
          // 並發撞唯一索引 → 表示別人剛搶下同一組，分享已建立但去重紀錄非本人所有；
          // 記錄下來由後台處理，不擋使用者（發獎仍走 rewarded 判斷）
          console.error(
            '[app/group-buy/shares] 訂單去重紀錄建立失敗:',
            e instanceof Error ? e.message : String(e),
          )
        })
    }

    return ok({ id: created.id, status: 'pending', editableUntil: created.editableUntil })
  } catch (err) {
    console.error('[app/group-buy/shares POST] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
