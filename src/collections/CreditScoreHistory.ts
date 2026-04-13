import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const CreditScoreHistory: CollectionConfig = {
  slug: 'credit-score-history',
  admin: {
    group: '會員管理',
    useAsTitle: 'reason',
    defaultColumns: ['user', 'change', 'reason', 'newScore', 'createdAt'],
    description: '會員信用分數異動紀錄',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    delete: isAdmin,
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
      name: 'previousScore',
      label: '異動前分數',
      type: 'number',
    },
    {
      name: 'newScore',
      label: '異動後分數',
      type: 'number',
    },
    {
      name: 'change',
      label: '變動值',
      type: 'number',
    },
    {
      name: 'reason',
      label: '原因',
      type: 'select',
      options: [
        { label: '購買', value: 'purchase' },
        { label: '準時到貨', value: 'on_time_delivery' },
        { label: '好評', value: 'good_review' },
        { label: '圖片評價', value: 'photo_review' },
        { label: '推薦成功', value: 'referral_success' },
        { label: '首次註冊', value: 'first_register' },
        { label: '首次購買', value: 'first_purchase' },
        { label: '生日加分', value: 'birthday_bonus' },
        { label: '訂閱加分', value: 'subscriber_bonus' },
        { label: '一般退貨', value: 'return_general' },
        { label: '無理由退貨', value: 'return_no_reason' },
        { label: '惡意退貨', value: 'return_malicious' },
        { label: '退貨率懲罰', value: 'return_rate_penalty' },
        { label: '棄單', value: 'abandoned_cart' },
        { label: '惡意取消', value: 'malicious_cancel' },
        { label: '管理員調整', value: 'admin_adjustment' },
        { label: '月度衰減', value: 'monthly_decay' },
        { label: '優良會員獎勵', value: 'good_customer_reward' },
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
      name: 'relatedReturn',
      label: '相關退貨',
      type: 'relationship',
      relationTo: 'returns',
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
    },
  ],
}
