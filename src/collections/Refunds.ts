import type { CollectionConfig, Where } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 退款 / 折讓 Collection
 * ──────────────────────
 * 支援全額退款、部分退款、折讓
 * 與 Returns 不同：退款可以不涉及退貨（如商品瑕疵折讓）
 */
export const Refunds: CollectionConfig = {
  slug: 'refunds',
  labels: { singular: '退款單', plural: '退款單' },
  admin: {
    group: '訂單管理',
    description: '退款與折讓管理',
    defaultColumns: ['refundNumber', 'order', 'type', 'amount', 'status', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if ((user as unknown as Record<string, unknown>).role === 'admin') return true
      return { customer: { equals: (user as unknown as Record<string, unknown>).id } } as Where
    },
    create: ({ req: { user } }) => !!user,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'refundNumber',
      label: '退款單號',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true, description: '格式：RFD-YYYYMMDD-XXXX' },
    },
    { name: 'order', label: '原始訂單', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'customer', label: '申請人', type: 'relationship', relationTo: 'users', required: true },
    { name: 'returnRequest', label: '關聯退貨單', type: 'relationship', relationTo: 'returns', admin: { description: '若因退貨產生的退款，可關聯退貨單' } },
    {
      name: 'type',
      label: '退款類型',
      type: 'select',
      required: true,
      options: [
        { label: '全額退款', value: 'full' },
        { label: '部分退款', value: 'partial' },
        { label: '折讓', value: 'allowance' },
        { label: '商品瑕疵補償', value: 'defect_compensation' },
      ],
    },
    {
      name: 'items',
      label: '退款商品',
      type: 'array',
      admin: { description: '部分退款時，指定退款的商品項目' },
      fields: [
        { name: 'product', label: '商品', type: 'relationship', relationTo: 'products', required: true },
        { name: 'variant', label: '款式', type: 'text' },
        { name: 'quantity', label: '數量', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', label: '單價', type: 'number', required: true, min: 0 },
        { name: 'refundAmount', label: '退款金額', type: 'number', required: true, min: 0 },
      ],
    },
    { name: 'amount', label: '退款總金額', type: 'number', required: true, min: 0 },
    {
      name: 'reason',
      label: '退款原因',
      type: 'select',
      required: true,
      options: [
        { label: '客戶要求取消', value: 'customer_cancel' },
        { label: '商品瑕疵', value: 'defective' },
        { label: '商品不符描述', value: 'not_as_described' },
        { label: '物流問題', value: 'shipping_issue' },
        { label: '重複下單', value: 'duplicate_order' },
        { label: '價格調整', value: 'price_adjustment' },
        { label: '其他', value: 'other' },
      ],
    },
    { name: 'reasonDetail', label: '詳細說明', type: 'textarea' },
    {
      name: 'refundMethod',
      label: '退款方式',
      type: 'select',
      required: true,
      options: [
        { label: '原路退回（信用卡/金流）', value: 'original_payment' },
        { label: '退至購物金', value: 'store_credit' },
        { label: '銀行轉帳', value: 'bank_transfer' },
      ],
    },
    {
      name: 'status',
      label: '退款狀態',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: '待審核', value: 'pending' },
        { label: '已核准', value: 'approved' },
        { label: '處理中', value: 'processing' },
        { label: '已退款', value: 'refunded' },
        { label: '已拒絕', value: 'rejected' },
      ],
    },
    { name: 'processedAt', label: '處理時間', type: 'date' },
    { name: 'transactionId', label: '退款交易編號', type: 'text', admin: { description: '金流退款的交易 ID' } },
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
          data.refundNumber = `RFD-${dateStr}-${rand}`
        }
        return data
      },
    ],
  },
}
