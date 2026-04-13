import type { CollectionConfig, Where } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { reviewCreditScoreHook } from '../lib/crm/creditScoreHooks'

/**
 * 商品評價 Collection
 * ──────────────────
 * 星級 1-5、文字、照片、審核狀態
 */
export const ProductReviews: CollectionConfig = {
  slug: 'product-reviews',
  labels: { singular: '商品評價', plural: '商品評價' },
  admin: {
    group: '商品管理',
    description: '管理商品評價與審核',
    defaultColumns: ['product', 'rating', 'status', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return { status: { equals: 'approved' } } as Where
      if ((user as unknown as Record<string, unknown>).role === 'admin') return true
      return {
        or: [
          { status: { equals: 'approved' } },
          { reviewer: { equals: (user as unknown as Record<string, unknown>).id } },
        ],
      } as Where
    },
    create: ({ req: { user } }) => !!user,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'product', label: '商品', type: 'relationship', relationTo: 'products', required: true, index: true },
    { name: 'reviewer', label: '評價者', type: 'relationship', relationTo: 'users', required: true },
    { name: 'rating', label: '星級', type: 'number', required: true, min: 1, max: 5 },
    { name: 'title', label: '標題', type: 'text' },
    { name: 'content', label: '評價內容', type: 'textarea', required: true },
    {
      name: 'photos',
      label: '評價照片',
      type: 'array',
      maxRows: 5,
      fields: [
        { name: 'image', label: '照片', type: 'upload', relationTo: 'media', required: true },
      ],
    },
    {
      name: 'status',
      label: '審核狀態',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: '待審核', value: 'pending' },
        { label: '已通過', value: 'approved' },
        { label: '已拒絕', value: 'rejected' },
      ],
    },
    { name: 'adminNote', label: '後台備註', type: 'textarea', admin: { condition: (_, siblingData) => siblingData?.status === 'rejected' } },
    {
      name: 'orderInfo',
      label: '訂單資訊',
      type: 'group',
      fields: [
        { name: 'orderId', label: '訂單編號', type: 'text' },
        { name: 'variant', label: '購買款式', type: 'text' },
      ],
    },
  ],
  timestamps: true,
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined

        // ── 評價通過：自動發放點數 ──
        if (status === 'approved' && prevStatus !== 'approved') {
          try {
            const loyaltySettings = await req.payload.findGlobal({ slug: 'loyalty-settings' })
            const reviewReward = loyaltySettings.reviewReward as unknown as Record<string, unknown> | undefined
            const autoTriggers = loyaltySettings.autoTriggers as unknown as Record<string, unknown> | undefined

            if (autoTriggers?.awardOnReviewApproved && reviewReward?.enabled) {
              const photos = doc.photos as unknown[] | undefined
              const hasPhotos = photos && photos.length > 0
              const points = hasPhotos
                ? (reviewReward.photoReviewPoints as number) ?? 50
                : (reviewReward.textReviewPoints as number) ?? 20

              const reviewerId = typeof doc.reviewer === 'string' ? doc.reviewer : (doc.reviewer as unknown as Record<string, unknown>)?.id as unknown as string
              if (reviewerId) {
                const reviewer = await req.payload.findByID({ collection: 'users', id: reviewerId })
                const currentPoints = (reviewer.points as number) ?? 0

                // 首次評價額外加碼
                const existingReviews = await req.payload.find({
                  collection: 'product-reviews',
                  where: { reviewer: { equals: reviewerId }, status: { equals: 'approved' }, id: { not_equals: doc.id } } as never,
                  limit: 1,
                })
                const isFirstReview = existingReviews.totalDocs === 0
                const firstBonus = isFirstReview ? ((reviewReward.firstReviewBonus as number) ?? 30) : 0
                const totalPoints = points + firstBonus

                await req.payload.update({
                  collection: 'users',
                  id: reviewerId,
                  data: { points: currentPoints + totalPoints },
                })
                console.log(`[Loyalty] 評價通過，會員 ${reviewerId} 獲得 ${totalPoints} 點（${hasPhotos ? '附圖' : '文字'}評價${isFirstReview ? ' + 首評加碼' : ''}）`)
              }
            }
          } catch (err) {
            console.error('[ProductReviews Hook] 點數發放失敗:', err)
          }
        }
      },
      // ── 信用分數 Hook ──
      reviewCreditScoreHook,
    ],
  },
}
