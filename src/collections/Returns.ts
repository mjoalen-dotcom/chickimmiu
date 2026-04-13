import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { returnCreditScoreHook } from '../lib/crm/creditScoreHooks'

/**
 * 退貨單 Collection
 * ────────────────
 * 會員可申請退貨，後台可審核、產生退貨單號
 */
export const Returns: CollectionConfig = {
  slug: 'returns',
  labels: { singular: '退貨單', plural: '退貨單' },
  admin: {
    group: '訂單管理',
    description: '退貨申請管理與審核',
    defaultColumns: ['returnNumber', 'order', 'status', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if ((user as unknown as Record<string, unknown>).role === 'admin') return true
      return { customer: { equals: (user as unknown as Record<string, unknown>).id } }
    },
    create: ({ req: { user } }) => !!user,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'returnNumber', label: '退貨單號', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'order', label: '原始訂單', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'customer', label: '申請人', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'items',
      label: '退貨商品',
      type: 'array',
      required: true,
      fields: [
        { name: 'product', label: '商品', type: 'relationship', relationTo: 'products', required: true },
        { name: 'variant', label: '款式', type: 'text' },
        { name: 'quantity', label: '退貨數量', type: 'number', required: true, min: 1 },
        { name: 'reason', label: '退貨原因', type: 'select', required: true, options: [
          { label: '商品瑕疵', value: 'defective' },
          { label: '尺寸不合', value: 'wrong_size' },
          { label: '顏色與圖片不符', value: 'color_mismatch' },
          { label: '收到錯誤商品', value: 'wrong_item' },
          { label: '不喜歡 / 不需要', value: 'not_wanted' },
          { label: '其他', value: 'other' },
        ]},
        { name: 'reasonDetail', label: '詳細說明', type: 'textarea' },
      ],
    },
    {
      name: 'photos',
      label: '退貨照片',
      type: 'array',
      maxRows: 5,
      fields: [
        { name: 'image', label: '照片', type: 'upload', relationTo: 'media', required: true },
      ],
    },
    {
      name: 'status',
      label: '處理狀態',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: '待審核', value: 'pending' },
        { label: '已核准', value: 'approved' },
        { label: '退貨中（寄回）', value: 'returning' },
        { label: '已收到退貨', value: 'received' },
        { label: '已退款', value: 'refunded' },
        { label: '已拒絕', value: 'rejected' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    { name: 'refundAmount', label: '退款金額', type: 'number' },
    { name: 'refundMethod', label: '退款方式', type: 'select', options: [
      { label: '原路退回', value: 'original' },
      { label: '購物金', value: 'credit' },
      { label: '銀行轉帳', value: 'bank_transfer' },
    ]},
    { name: 'adminNote', label: '後台備註', type: 'textarea' },
    { name: 'trackingNumber', label: '退貨物流單號', type: 'text' },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          const now = new Date()
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
          data.returnNumber = `RTN-${dateStr}-${rand}`
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined

        // ── 收到退貨：自動回補庫存 ──
        if (status === 'received' && prevStatus !== 'received') {
          const items = doc.items as {
            product: string | { id: string }
            variant?: string
            quantity: number
          }[]

          for (const item of items) {
            const productId = typeof item.product === 'string' ? item.product : item.product?.id
            if (!productId) continue

            try {
              const product = await req.payload.findByID({ collection: 'products', id: productId })
              const variants = product.variants as { sku?: string; colorName?: string; size?: string; stock?: number }[] | undefined

              if (variants && variants.length > 0 && item.variant) {
                // 嘗試匹配變體
                const updatedVariants = variants.map((v) => {
                  const variantStr = `${v.colorName} / ${v.size}`
                  if (variantStr === item.variant || v.sku === item.variant) {
                    return { ...v, stock: (v.stock ?? 0) + item.quantity }
                  }
                  return v
                })
                await req.payload.update({
                  collection: 'products',
                  id: productId,
                  data: { variants: updatedVariants } as unknown as Record<string, unknown>,
                })
              } else {
                const currentStock = (product.stock as number) ?? 0
                await req.payload.update({
                  collection: 'products',
                  id: productId,
                  data: { stock: currentStock + item.quantity },
                })
              }
              console.log(`[Returns Hook] 庫存回補成功 (product: ${productId}, qty: +${item.quantity})`)
            } catch (err) {
              console.error(`[Returns Hook] 庫存回補失敗 (product: ${productId}):`, err)
            }
          }
        }
      },
      // ── 信用分數 Hook ──
      returnCreditScoreHook,
    ],
  },
}
