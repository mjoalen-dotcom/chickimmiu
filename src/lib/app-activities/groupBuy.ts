import type { BasePayload, Where } from 'payload'

import { publicAuthor } from './common'

/**
 * 團購好物分享的共用邏輯（可見性 / 序列化 / 驗證）
 * ═══════════════════════════════════════════════
 * 工單 2026-08-25 活動二。可見性規則要在**所有查詢介面**一致遵守，
 * 所以集中在這裡，端點不各寫一份。
 */

type LooseRecord = Record<string, unknown>

/**
 * 可見性 where：
 *   ‧ 他人只能取到 approved
 *   ‧ 作者本人可額外取到自己的 pending 與 rejected
 *   ‧ deleted 一律無人看得到
 */
export function visibilityWhere(viewerId: string | number): Where {
  return {
    and: [
      { status: { not_equals: 'deleted' } },
      {
        or: [
          { status: { equals: 'approved' } },
          {
            and: [
              { user: { equals: viewerId } },
              { status: { in: ['pending', 'rejected'] } },
            ],
          },
        ],
      },
    ],
  } as Where
}

/** 回給 App 的分享形狀。orderNumber 刻意不外流（工單：僅後台對單） */
export function serializeShare(doc: unknown, viewerId: string | number): LooseRecord {
  const r = doc as LooseRecord
  const article = r.article as LooseRecord | number | null | undefined
  const photos = Array.isArray(r.photos) ? (r.photos as LooseRecord[]) : []
  const authorId =
    typeof r.user === 'object' && r.user !== null ? (r.user as LooseRecord).id : r.user

  return {
    id: r.id,
    author: publicAuthor(r.user),
    isMine: String(authorId) === String(viewerId),
    article: {
      id: typeof article === 'object' && article !== null ? article.id : article,
      title: (r.articleTitle as string) ?? '',
    },
    content: (r.content as string) ?? '',
    photos: photos
      .map((p) => {
        const img = p.image as LooseRecord | number | null | undefined
        if (img && typeof img === 'object') {
          return { mediaId: img.id, url: (img.url as string) ?? null }
        }
        return { mediaId: img ?? null, url: null }
      })
      .filter((p) => p.mediaId != null),
    purchaseDate: (r.purchaseDate as string) ?? null,
    commentCount: Number(r.commentCount ?? 0) || 0,
    isFeatured: r.isFeatured === true,
    status: (r.status as string) ?? 'pending',
    editableUntil: (r.editableUntil as string) ?? null,
    createdAt: (r.createdAt as string) ?? null,
  }
}

/** 建立/編輯時檢查照片 media id 是否都存在且屬於本站 media */
export async function validateMediaIds(
  payload: BasePayload,
  ids: Array<string | number>,
): Promise<boolean> {
  if (ids.length === 0) return true
  const res = await payload.find({
    collection: 'media',
    where: { id: { in: ids } } as Where,
    limit: ids.length,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs.length === ids.length
}

/**
 * 「同會員同文章只有第一篇發獎」的判定：
 * 查該會員在該文章是否已有任一筆 rewarded 的分享（含 status: 'deleted' 的）。
 */
export async function hasRewardedShare(
  payload: BasePayload,
  userId: string | number,
  articleId: string | number,
): Promise<boolean> {
  const res = await payload.count({
    collection: 'group-buy-shares',
    where: {
      and: [
        { user: { equals: userId } },
        { article: { equals: articleId } },
        { rewarded: { equals: true } },
      ],
    } as Where,
    overrideAccess: true,
  })
  return res.totalDocs > 0
}
