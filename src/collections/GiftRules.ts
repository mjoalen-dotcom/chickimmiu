import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 贈品規則 Collection（Shopline gap — 19D 促銷三件套）
 * ────────────────────────────────────────────────────
 * 滿額 / 含特定商品時，系統自動在 cart 加上一個 price=0 的 line item
 * 並標記 isGift=true + giftRuleRef=this.id。不影響 subtotal 計算。
 *
 * triggerType:
 *   - 'min_amount'：cart 小計達 minAmount 即送 giftProduct × giftQuantity
 *   - 'product_in_cart'：cart 含 triggerProducts 任一項即送
 *
 * stackable：
 *   - false：只送一份（不管 cart 滿幾倍門檻）
 *   - true：一單滿 $3000，門檻 $1000，送 3 份（以 floor(subtotal/minAmount) 為倍數）
 *     只對 min_amount 型有效；product_in_cart 一律送一份
 */
export const GiftRules: CollectionConfig = {
  slug: 'gift-rules',
  labels: { singular: '贈品規則', plural: '贈品規則' },
  admin: {
    group: '促銷活動',
    useAsTitle: 'name',
    description: '滿額 / 指定商品自動贈送（結帳時自動加入 cart，price=0）',
    defaultColumns: ['name', 'triggerType', 'giftProduct', 'isActive', 'priority'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', label: '規則名稱', type: 'text', required: true, admin: { description: '例如：滿 $1000 送 $100 精油小樣' } },
    {
      name: 'triggerType',
      label: '觸發類型',
      type: 'select',
      required: true,
      defaultValue: 'min_amount',
      options: [
        { label: '滿額送', value: 'min_amount' },
        { label: '含指定商品送', value: 'product_in_cart' },
      ],
    },
    {
      name: 'minAmount',
      label: '最低金額（TWD）',
      type: 'number',
      admin: {
        condition: (data: Record<string, unknown>) => data?.triggerType === 'min_amount',
        description: '觸發類型=滿額送 時必填',
      },
    },
    {
      name: 'triggerProducts',
      label: '觸發商品',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        condition: (data: Record<string, unknown>) => data?.triggerType === 'product_in_cart',
        description: 'cart 含其中任一項即觸發',
      },
    },
    { name: 'giftProduct', label: '贈品商品', type: 'relationship', relationTo: 'products', required: true },
    { name: 'giftQuantity', label: '贈送數量', type: 'number', defaultValue: 1, min: 1 },
    {
      name: 'stackable',
      label: '可疊加（滿 N 倍門檻送 N 份）',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: '只對滿額送有效；含指定商品送一律送一份' },
    },
    { name: 'startsAt', label: '開始時間', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'expiresAt', label: '到期時間', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },
    { name: 'priority', label: '優先順序', type: 'number', defaultValue: 0 },
  ],
  timestamps: true,
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data
        const giftProductId = data.giftProduct
        if (!giftProductId) return data
        try {
          const rawId =
            typeof giftProductId === 'object' && giftProductId !== null
              ? ((giftProductId as Record<string, unknown>).id as string | number | undefined)
              : (giftProductId as string | number)
          if (!rawId) return data
          const product = await req.payload.findByID({ collection: 'products', id: rawId as string })
          const stock = (product as unknown as { stock?: number }).stock ?? 0
          if (stock <= 0) {
            req.payload.logger.warn({
              msg: `[GiftRules] 警告：贈品商品 ${rawId} 目前庫存 ≤ 0，結帳可能找不到贈品可送`,
              giftProductId: rawId,
            })
          }
        } catch {
          // 忽略：product 可能還沒建好或已刪除
        }
        return data
      },
    ],
  },
}
