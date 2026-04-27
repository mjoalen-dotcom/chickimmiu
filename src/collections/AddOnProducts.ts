import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 加購品規則 Collection（Shopline gap — 19D 促銷三件套）
 * ──────────────────────────────────────────────────────
 * 結帳時在 cart 達到 minCartSubtotal（或含特定 appliesToProducts）後，
 * 系統顯示可加購的清單；顧客勾選後以 addOnPrice（而非原價）加入訂單。
 *
 * 核心概念：
 *   - product = 要被加購的商品（relationship）
 *   - addOnPrice = 結帳加購專價（通常低於 product.price）
 *   - conditions.minCartSubtotal = cart 小計達此金額才顯示
 *   - conditions.appliesToProducts = 若填了則 cart 需含這些商品之一
 *
 * 下單後，Order.items 對應行的 isAddOn=true + addOnRuleRef=this.id，
 * 報表可以區分正常商品 vs 加購品。
 */
export const AddOnProducts: CollectionConfig = {
  slug: 'add-on-products',
  labels: { singular: '加購品規則', plural: '加購品規則' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'name',
    description: '結帳加購（cart 達門檻後可用專價加購指定商品）',
    defaultColumns: ['name', 'product', 'addOnPrice', 'isActive', 'priority'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', label: '規則名稱', type: 'text', required: true, admin: { description: '例如：滿 $500 加購暖暖包 $99' } },
    { name: 'product', label: '加購商品', type: 'relationship', relationTo: 'products', required: true },
    {
      name: 'addOnPrice',
      label: '加購價（TWD）',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: '結帳時顯示此價格（通常低於商品原價）' },
    },
    {
      name: 'conditions',
      label: '觸發條件',
      type: 'group',
      fields: [
        { name: 'minCartSubtotal', label: '購物車最低小計（TWD）', type: 'number', defaultValue: 0 },
        {
          name: 'appliesToProducts',
          label: '需含特定商品',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          admin: { description: '若留空則任何商品都可觸發；填了則 cart 需含其中一項' },
        },
        { name: 'usageLimitPerOrder', label: '每張訂單可加購次數', type: 'number', defaultValue: 1, min: 1 },
      ],
    },
    { name: 'startsAt', label: '開始時間', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'expiresAt', label: '到期時間', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },
    {
      name: 'priority',
      label: '優先順序',
      type: 'number',
      defaultValue: 0,
      admin: { description: '多個規則同時達成時由大到小排序' },
    },
  ],
  timestamps: true,
}
