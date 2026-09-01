import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 團購好物分享 — 訂單去重（App 專屬活動二）
 * ────────────────────────────────────────
 * 工單 2026-08-25：article + orderNumber 複合唯一索引，跨帳號生效。
 * 刪除分享或被退件都不釋放此紀錄，否則換帳號即可繞過。
 *
 * user 欄位是必要的 —— 發放規則要區分「他人用過就擋下」與「本人重用自己的訂單號
 * 可以發文」，沒有記錄使用者就無法分辨這兩種情況，只能一律擋掉。
 */
export const GroupBuyOrderClaims: CollectionConfig = {
  slug: 'group-buy-order-claims',
  labels: { singular: '團購訂單去重', plural: '團購訂單去重' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'orderNumber',
    defaultColumns: ['article', 'orderNumber', 'user', 'createdAt'],
    description: '同一文章的同一張訂單編號只能被一位會員使用（刪除分享不釋放）',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ['article', 'orderNumber'], unique: true }],
  timestamps: true,
  fields: [
    {
      name: 'article',
      label: '團購文章',
      type: 'relationship',
      relationTo: 'blog-posts',
      required: true,
      index: true,
      maxDepth: 0,
    },
    {
      name: 'orderNumber',
      label: '訂單編號（正規化後）',
      type: 'text',
      required: true,
      index: true,
      admin: { description: '去頭尾空白 → 全形轉半形 → 轉大寫；長度 4–40' },
    },
    {
      name: 'user',
      label: '使用者',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
      maxDepth: 0,
      admin: { description: '用於分辨「他人用過」與「本人重用自己的訂單號」' },
    },
  ],
}
