import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 組合商品 Bundles Collection（Shopline gap — 19D 促銷三件套）
 * ─────────────────────────────────────────────────────────
 * 把多個商品打包賣。原價 sum(product.price × qty)，套組價 bundlePrice 固定，
 * savings = originalPrice - bundlePrice（admin readOnly，儲存前自動算）。
 *
 * 加入 cart 時：展開為多個 lineItem，每行帶 bundleRef=this.id。
 * - 第 1 行 price=bundlePrice（承擔整組金額）
 * - 其餘行 price=0（避免重複計算 subtotal）
 * 這樣 subtotal 算法不變，bundle 顯示分多行（便於出貨檢貨），總額正確。
 *
 * /bundles/<slug> 可作為獨立 PDP（客戶看到完整套組說明 + 加入按鈕）。
 */
export const Bundles: CollectionConfig = {
  slug: 'bundles',
  labels: { singular: '組合商品', plural: '組合商品' },
  admin: {
    group: '促銷活動',
    useAsTitle: 'name',
    description: '多商品打包銷售（/bundles/<slug> 可獨立 PDP）',
    defaultColumns: ['name', 'slug', 'bundlePrice', 'savings', 'isActive'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', label: '套組名稱', type: 'text', required: true },
    {
      name: 'slug',
      label: '網址代稱（slug）',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: '前台 /bundles/<slug> 可獨立 PDP' },
    },
    { name: 'description', label: '套組說明', type: 'richText' },
    {
      name: 'items',
      label: '套組內容',
      type: 'array',
      required: true,
      minRows: 2,
      fields: [
        { name: 'product', label: '商品', type: 'relationship', relationTo: 'products', required: true },
        { name: 'quantity', label: '數量', type: 'number', required: true, defaultValue: 1, min: 1 },
      ],
    },
    {
      name: 'originalPrice',
      label: '原價合計（TWD）',
      type: 'number',
      admin: {
        readOnly: true,
        description: '儲存時自動以 items 各商品 price × qty 計算',
      },
    },
    { name: 'bundlePrice', label: '套組價（TWD）', type: 'number', required: true, min: 0 },
    {
      name: 'savings',
      label: '省下（TWD）',
      type: 'number',
      admin: { readOnly: true, description: 'originalPrice - bundlePrice，自動計算' },
    },
    { name: 'image', label: '套組主圖', type: 'upload', relationTo: 'media' },
    { name: 'startsAt', label: '開始時間', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'expiresAt', label: '到期時間', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (!data || !Array.isArray(data.items) || data.items.length === 0) return data
        let original = 0
        for (const row of data.items as Array<Record<string, unknown>>) {
          const rawProduct = row.product
          const qty = Number(row.quantity ?? 1) || 1
          const productId =
            typeof rawProduct === 'object' && rawProduct !== null
              ? ((rawProduct as Record<string, unknown>).id as string | number | undefined)
              : (rawProduct as string | number | undefined)
          if (!productId) continue
          try {
            const product = await req.payload.findByID({ collection: 'products', id: productId as string })
            const price =
              Number((product as unknown as { salePrice?: number }).salePrice ?? 0) ||
              Number((product as unknown as { price?: number }).price ?? 0)
            original += price * qty
          } catch {
            // 商品不存在，跳過
          }
        }
        const bundlePrice = Number(data.bundlePrice ?? 0) || 0
        return {
          ...data,
          originalPrice: original,
          savings: Math.max(0, original - bundlePrice),
        }
      },
    ],
  },
}
