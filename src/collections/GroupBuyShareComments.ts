import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 團購好物分享 — 留言（App 專屬活動二）
 * ────────────────────────────────────
 * 工單 2026-08-25：留言不再發放任何獎勵（共通規則 #1），功能保留。
 *
 * 最多兩層：頂層留言，以及掛在頂層留言底下的回覆。
 * parentCommentId 若指向的本身是一則回覆，端點會解析為它的頂層留言 ID 再存 ——
 * 這樣「回覆別人的回覆」仍掛在同一個頂層留言下，留言串不會無限往下疊。
 *
 * status：published（送出即為此值，留言不經審核）／hidden（檢舉後的人工處置，
 * 不回傳前台）。沒有這個欄位，後台遇到檢舉只能整篇分享刪掉。
 *
 * commentCount 由本檔 hook 維護（只計 published）。
 */
export const GroupBuyShareComments: CollectionConfig = {
  slug: 'group-buy-share-comments',
  labels: { singular: '分享留言', plural: '分享留言' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'content',
    defaultColumns: ['review', 'user', 'content', 'status', 'createdAt'],
    description: '團購好物分享的留言（兩層）。檢舉後可改為「已隱藏」，前台不再顯示',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  timestamps: true,
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // 只計 published 的留言：新增 published、或狀態在 published 與 hidden 間切換時重算
        const was = previousDoc?.status
        const now = doc.status
        const changedVisibility =
          operation === 'create' ? now === 'published' : was !== now
        if (!changedVisibility) return doc
        await recount(req.payload, doc.review)
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await recount(req.payload, (doc as Record<string, unknown>).review)
      },
    ],
  },
  fields: [
    {
      name: 'review',
      label: '所屬分享',
      type: 'relationship',
      relationTo: 'group-buy-shares',
      required: true,
      index: true,
      maxDepth: 0,
    },
    {
      name: 'user',
      label: '留言者',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    { name: 'content', label: '內容', type: 'textarea', required: true },
    {
      name: 'parentCommentId',
      label: '回覆的頂層留言',
      type: 'relationship',
      relationTo: 'group-buy-share-comments',
      index: true,
      maxDepth: 0,
      admin: {
        description: '空 = 頂層留言；有值 = 該頂層留言的回覆。端點會把「回覆的回覆」解析回頂層',
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'published',
      index: true,
      options: [
        { label: '顯示中', value: 'published' },
        { label: '已隱藏', value: 'hidden' },
      ],
    },
  ],
}

/** 重算某篇分享的 published 留言數 */
async function recount(payload: unknown, review: unknown): Promise<void> {
  const reviewId =
    typeof review === 'object' && review !== null
      ? (review as { id?: string | number }).id
      : (review as string | number | undefined)
  if (reviewId == null) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any
    const res = await p.count({
      collection: 'group-buy-share-comments',
      where: {
        and: [{ review: { equals: reviewId } }, { status: { equals: 'published' } }],
      },
      overrideAccess: true,
    })
    await p.update({
      collection: 'group-buy-shares',
      id: reviewId,
      data: { commentCount: res.totalDocs },
      overrideAccess: true,
    })
  } catch (e) {
    console.error(
      '[group-buy-share-comments] commentCount 重算失敗:',
      e instanceof Error ? e.message : String(e),
    )
  }
}
