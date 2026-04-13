import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const PointsTransactions: CollectionConfig = {
  slug: 'points-transactions',
  admin: {
    group: '會員管理',
    useAsTitle: 'description',
    defaultColumns: ['user', 'type', 'amount', 'balance', 'source', 'createdAt'],
    description: '會員點數異動紀錄',
  },
  timestamps: true,
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'type',
      label: '類型',
      type: 'select',
      options: [
        { label: '獲得', value: 'earn' },
        { label: '兌換', value: 'redeem' },
        { label: '過期', value: 'expire' },
        { label: '管理員調整', value: 'admin_adjust' },
        { label: '退款扣回', value: 'refund_deduct' },
      ],
    },
    {
      name: 'amount',
      label: '數量',
      type: 'number',
      required: true,
      admin: {
        description: '正數為獲得，負數為扣除',
      },
    },
    {
      name: 'balance',
      label: '異動後餘額',
      type: 'number',
    },
    {
      name: 'source',
      label: '來源',
      type: 'select',
      options: [
        { label: '購買', value: 'purchase' },
        { label: '評價', value: 'review' },
        { label: '推薦', value: 'referral' },
        { label: '生日', value: 'birthday' },
        { label: '月度獎勵', value: 'monthly_bonus' },
        { label: '遊戲', value: 'game' },
        { label: '兌換', value: 'redemption' },
        { label: '訂單退款', value: 'order_refund' },
        { label: '管理員', value: 'admin' },
        { label: '點數過期', value: 'points_expiry' },
        { label: '歡迎禮', value: 'welcome' },
      ],
    },
    {
      name: 'description',
      label: '說明',
      type: 'text',
    },
    {
      name: 'relatedOrder',
      label: '相關訂單',
      type: 'relationship',
      relationTo: 'orders',
    },
    {
      name: 'expiresAt',
      label: '過期時間',
      type: 'date',
    },
  ],
}
