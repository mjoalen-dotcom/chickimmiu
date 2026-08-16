import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminFieldLevel } from '../access/isAdmin'
import { socialWallOwnerOrAdminAccess } from '../lib/social-wall/owner-access'

export const SocialWallSubscriptions: CollectionConfig = {
  slug: 'social-wall-subscriptions',
  labels: { singular: '牆聚訂閱', plural: '牆聚訂閱' },
  admin: {
    group: 'Ⓦ 牆聚 WallGather',
    useAsTitle: 'id',
    defaultColumns: ['owner', 'plan', 'status', 'currentPeriodEnd', 'paymentProvider'],
    description: '牆聚 SaaS 的獨立訂閱生命週期；不與服飾會員訂閱共用資料。',
  },
  access: {
    read: (args) => socialWallOwnerOrAdminAccess(args),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'owner', label: '訂閱客戶', type: 'relationship', relationTo: 'customers', required: true, unique: true, index: true },
    {
      type: 'row', fields: [
        { name: 'plan', label: '方案', type: 'select', required: true, defaultValue: 'free', options: [{ label: 'Free', value: 'free' }, { label: 'Creator', value: 'creator' }, { label: 'Pro', value: 'pro' }, { label: 'Agency', value: 'agency' }], admin: { width: '34%' } },
        { name: 'status', label: '狀態', type: 'select', required: true, defaultValue: 'active', index: true, options: [{ label: '試用中', value: 'trialing' }, { label: '有效', value: 'active' }, { label: '扣款失敗', value: 'past_due' }, { label: '已取消', value: 'canceled' }, { label: '已到期', value: 'expired' }], admin: { width: '33%' } },
        { name: 'billingCycle', label: '週期', type: 'select', required: true, defaultValue: 'monthly', options: [{ label: '月繳', value: 'monthly' }, { label: '年繳', value: 'yearly' }], admin: { width: '33%' } },
      ],
    },
    {
      type: 'row', fields: [
        { name: 'currentPeriodStart', label: '本期開始', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'currentPeriodEnd', label: '權益到期', type: 'date', index: true, admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'cancelAtPeriodEnd', label: '期末取消', type: 'checkbox', defaultValue: false, admin: { width: '34%' } },
      ],
    },
    {
      type: 'row', fields: [
        { name: 'priceTwd', label: '每期金額 TWD', type: 'number', required: true, defaultValue: 0, min: 0, admin: { width: '33%' } },
        { name: 'paymentProvider', label: '付款服務', type: 'select', required: true, defaultValue: 'manual', options: [{ label: '免費／人工', value: 'manual' }, { label: '綠界', value: 'ecpay' }], admin: { width: '33%' } },
        { name: 'lastPaymentAt', label: '最近付款', type: 'date', admin: { width: '34%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'providerSubscriptionRef', label: '金流訂閱參照', type: 'text',
      access: { read: isAdminFieldLevel, create: isAdminFieldLevel, update: isAdminFieldLevel },
      admin: { readOnly: true },
    },
  ],
}
