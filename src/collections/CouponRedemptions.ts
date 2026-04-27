import type { CollectionConfig, Where } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * CouponRedemptions（優惠券兌換記錄）
 * ──────────────────────────────────
 * 每張訂單套用 coupon 時寫一筆；Orders.ts beforeChange 建單時產生。
 *
 * afterChange hook：++ coupons.usageCount（保證與 redemption 筆數對得上）
 *
 * Access：admin 全權；user 可讀自己的（/account/coupons 之類前台頁面用）
 */
type LooseRecord = Record<string, unknown>

export const CouponRedemptions: CollectionConfig = {
  slug: 'coupon-redemptions',
  labels: { singular: '優惠券使用記錄', plural: '優惠券使用記錄' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['coupon', 'user', 'order', 'discountAmount', 'redeemedAt'],
    group: '④ 行銷推廣',
    description: '每次優惠券套用的紀錄；寫入時自動累加 coupon.usageCount',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { user: { equals: user.id } } as Where
    },
    create: () => true, // Orders hook 內以 overrideAccess 寫入；前台不直接 POST
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        const couponId =
          typeof doc.coupon === 'number' || typeof doc.coupon === 'string'
            ? doc.coupon
            : ((doc.coupon as LooseRecord)?.id as number | string | undefined)
        if (couponId == null) return
        try {
          const coupon = await req.payload.findByID({
            collection: 'coupons',
            id: couponId,
            overrideAccess: true,
          })
          const couponRec = coupon as unknown as LooseRecord
          const currentCount =
            typeof couponRec.usageCount === 'number' ? (couponRec.usageCount as number) : 0
          await (req.payload.update as Function)({
            collection: 'coupons',
            id: couponId,
            data: { usageCount: currentCount + 1 },
            overrideAccess: true,
          })
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: 'CouponRedemptions afterChange: usageCount 累加失敗',
            couponId,
          })
        }
      },
    ],
  },
  fields: [
    { name: 'coupon', label: '優惠券', type: 'relationship', relationTo: 'coupons', required: true },
    { name: 'user', label: '使用會員', type: 'relationship', relationTo: 'users', admin: { description: 'Guest 結帳可留空（本階段強制登入，所以通常有值）' } },
    { name: 'order', label: '訂單', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'discountAmount', label: '實際折抵金額', type: 'number', required: true, min: 0 },
    {
      name: 'redeemedAt',
      label: '套用時間',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
    },
  ],
  timestamps: true,
}
