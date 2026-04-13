import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 換貨申請 Collection
 */
export const Exchanges: CollectionConfig = {
  slug: 'exchanges',
  labels: { singular: '換貨單', plural: '換貨單' },
  admin: {
    group: '訂單管理',
    description: '換貨申請管理',
    defaultColumns: ['exchangeNumber', 'order', 'status', 'createdAt'],
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
    { name: 'exchangeNumber', label: '換貨單號', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'order', label: '原始訂單', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'customer', label: '申請人', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'items',
      label: '換貨商品',
      type: 'array',
      required: true,
      fields: [
        { name: 'product', label: '商品', type: 'relationship', relationTo: 'products', required: true },
        { name: 'originalVariant', label: '原款式', type: 'text', required: true },
        { name: 'newVariant', label: '換成款式', type: 'text', required: true },
        { name: 'quantity', label: '數量', type: 'number', required: true, min: 1 },
        { name: 'reason', label: '換貨原因', type: 'select', required: true, options: [
          { label: '尺寸不合', value: 'wrong_size' },
          { label: '顏色不符', value: 'color_mismatch' },
          { label: '商品瑕疵', value: 'defective' },
          { label: '其他', value: 'other' },
        ]},
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
        { label: '退回中', value: 'returning' },
        { label: '已收到', value: 'received' },
        { label: '新品已寄出', value: 'shipped' },
        { label: '已完成', value: 'completed' },
        { label: '已拒絕', value: 'rejected' },
      ],
    },
    { name: 'priceDifference', label: '價差金額', type: 'number', defaultValue: 0, admin: { description: '正數=需補差價，負數=退差價' } },
    { name: 'newTrackingNumber', label: '新品物流單號', type: 'text' },
    { name: 'adminNote', label: '後台備註', type: 'textarea' },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          const now = new Date()
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
          data.exchangeNumber = `EXC-${dateStr}-${rand}`
        }
        return data
      },
    ],
  },
}
