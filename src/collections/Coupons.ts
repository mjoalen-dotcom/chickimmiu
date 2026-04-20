import type { CollectionConfig, Where } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * Coupons Collection（優惠券 / 折扣碼）
 * ──────────────────────────────────
 * Shopline-gap P0-1：讓後台可建立優惠券、前台 /checkout 可輸入代碼套用折扣。
 *
 * 欄位重點：
 *   - `code` 唯一（如 WELCOME10）；前台輸入此 code 套用
 *   - `discountType` 支援百分比 / 固定金額 / 免運
 *   - `minOrderAmount` / `maxDiscountAmount` 用於百分比折上限
 *   - `usageLimit` 總使用次數、`usageLimitPerUser` 單用戶上限
 *   - `usageCount` 由 CouponRedemptions.afterChange 自動 ++
 *   - `conditions.productInclude/productExclude` 限定或排除商品
 *   - `conditions.tierRequired` / `firstOrderOnly` 暫留 schema，邏輯 v2 再接
 *
 * Access：admin 建 / 改 / 刪；`anyone` read（前台 apply 需要讀取驗證）
 */
export const Coupons: CollectionConfig = {
  slug: 'coupons',
  labels: { singular: '優惠券', plural: '優惠券' },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'name', 'discountType', 'discountValue', 'usageCount', 'expiresAt', 'isActive'],
    group: '行銷活動',
    description: '折扣碼 / 優惠券設定；前台 /checkout 輸入 code 套用',
    listSearchableFields: ['code', 'name'],
  },
  access: {
    // 前台需要讀取才能驗證，admin 全權；對 inactive 曝光 code 可接受（前台仍驗 isActive）
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        const d = data as Record<string, unknown>
        // code 統一大寫，避免大小寫輸入歧異
        if (typeof d.code === 'string') {
          d.code = d.code.trim().toUpperCase()
        }
        const startsAt = d.startsAt ? new Date(d.startsAt as string) : null
        const expiresAt = d.expiresAt ? new Date(d.expiresAt as string) : null
        if (startsAt && expiresAt && startsAt.getTime() > expiresAt.getTime()) {
          throw new Error('開始時間不可晚於到期時間')
        }
        const discountType = d.discountType as string
        const discountValue = typeof d.discountValue === 'number' ? d.discountValue : null
        if (discountType === 'percentage' && discountValue !== null && (discountValue <= 0 || discountValue > 100)) {
          throw new Error('百分比折扣值必須介於 1-100')
        }
        if (discountType === 'fixed' && discountValue !== null && discountValue <= 0) {
          throw new Error('固定金額折扣需大於 0')
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'code', label: '優惠代碼', type: 'text', required: true, unique: true, admin: { width: '40%', description: '大寫英數字，顧客輸入此 code 套用，如 WELCOME10' } },
        { name: 'name', label: '後台顯示名稱', type: 'text', required: true, admin: { width: '60%' } },
      ],
    },
    { name: 'description', label: '說明', type: 'textarea' },
    {
      type: 'row',
      fields: [
        {
          name: 'discountType',
          label: '折扣類型',
          type: 'select',
          required: true,
          defaultValue: 'percentage',
          admin: { width: '40%' },
          options: [
            { label: '百分比', value: 'percentage' },
            { label: '固定金額', value: 'fixed' },
            { label: '免運費', value: 'free_shipping' },
          ],
        },
        { name: 'discountValue', label: '折扣值', type: 'number', required: true, min: 0, admin: { width: '30%', description: '百分比=1-100, 固定金額=NT$; 免運券此值無效但仍需填 0' } },
        { name: 'maxDiscountAmount', label: '百分比封頂', type: 'number', min: 0, admin: { width: '30%', description: '百分比類型限制最高折抵金額；0/空 = 不限' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'minOrderAmount', label: '最低消費門檻', type: 'number', defaultValue: 0, min: 0, admin: { width: '33%' } },
        { name: 'usageLimit', label: '總使用次數上限', type: 'number', min: 0, admin: { width: '33%', description: '空=不限' } },
        { name: 'usageLimitPerUser', label: '每人使用次數', type: 'number', defaultValue: 1, min: 0, admin: { width: '34%', description: '0=不限' } },
      ],
    },
    {
      name: 'usageCount',
      label: '已使用次數',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true, description: '由 CouponRedemptions 自動累加' },
    },
    {
      type: 'row',
      fields: [
        { name: 'startsAt', label: '開始時間', type: 'date', admin: { width: '50%' } },
        { name: 'expiresAt', label: '到期時間', type: 'date', admin: { width: '50%' } },
      ],
    },
    { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },
    {
      name: 'conditions',
      label: '適用條件',
      type: 'group',
      fields: [
        {
          name: 'tierRequired',
          label: '最低會員等級（v2）',
          type: 'relationship',
          relationTo: 'membership-tiers',
          admin: { description: '目前保留 schema；邏輯 v2 接' },
        },
        {
          name: 'productInclude',
          label: '限定商品',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          admin: { description: '空=全品適用；有值時僅這些商品計入優惠' },
        },
        {
          name: 'productExclude',
          label: '排除商品',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
        },
        { name: 'firstOrderOnly', label: '僅限首次下單', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
  timestamps: true,
}
