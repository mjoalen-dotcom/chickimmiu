import type { CollectionConfig, Access } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * Partner 只能讀取 / 更新自己的 Affiliate 資料
 */
const readOwnAffiliate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'partner') {
    return { user: { equals: user.id } }
  }
  return false
}

const updateOwnAffiliate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'partner') {
    return { user: { equals: user.id } }
  }
  return false
}

export const Affiliates: CollectionConfig = {
  slug: 'affiliates',
  labels: { singular: '合作夥伴', plural: '合作夥伴' },
  admin: {
    useAsTitle: 'referralCode',
    defaultColumns: ['user', 'referralCode', 'commissionRate', 'totalEarnings', 'withdrawableAmount', 'status'],
    group: '⑤ 互動體驗',
    description: '合作夥伴分潤資料管理',
  },
  access: {
    read: readOwnAffiliate,
    create: isAdmin,
    update: updateOwnAffiliate,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'user',
      label: '合作夥伴帳號',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
    },
    {
      name: 'referralCode',
      label: '推薦碼',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: '合作夥伴的專屬推薦碼，用於生成推廣連結' },
    },
    {
      name: 'commissionRate',
      label: '佣金比例（%）',
      type: 'number',
      required: true,
      min: 0,
      max: 100,
      defaultValue: 10,
      access: {
        update: ({ req: { user } }) => Boolean(user?.role === 'admin'),
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: '啟用中', value: 'active' },
        { label: '已停用', value: 'inactive' },
        { label: '已暫停', value: 'suspended' },
      ],
      access: {
        update: ({ req: { user } }) => Boolean(user?.role === 'admin'),
      },
    },
    // ── 收益統計（僅 Admin 可修改） ──
    {
      name: 'totalEarnings',
      label: '累計總收益',
      type: 'number',
      defaultValue: 0,
      min: 0,
      access: { update: ({ req: { user } }) => Boolean(user?.role === 'admin') },
    },
    {
      name: 'withdrawableAmount',
      label: '可提領金額',
      type: 'number',
      defaultValue: 0,
      min: 0,
      access: { update: ({ req: { user } }) => Boolean(user?.role === 'admin') },
    },
    {
      name: 'pendingAmount',
      label: '待確認金額',
      type: 'number',
      defaultValue: 0,
      min: 0,
      access: { update: ({ req: { user } }) => Boolean(user?.role === 'admin') },
    },
    {
      name: 'totalWithdrawn',
      label: '累計已提領',
      type: 'number',
      defaultValue: 0,
      min: 0,
      access: { update: ({ req: { user } }) => Boolean(user?.role === 'admin') },
    },
    // ── 銀行資訊（Partner 可自行修改） ──
    {
      name: 'bankInfo',
      label: '銀行帳戶（提款用）',
      type: 'group',
      fields: [
        { name: 'bankName', label: '銀行名稱', type: 'text' },
        { name: 'branchName', label: '分行名稱', type: 'text' },
        { name: 'accountNumber', label: '帳號', type: 'text' },
        { name: 'accountHolder', label: '戶名', type: 'text' },
      ],
    },
    // ── 提款紀錄 ──
    {
      name: 'withdrawalRequests',
      label: '提款申請紀錄',
      type: 'array',
      access: {
        update: ({ req: { user } }) => Boolean(user?.role === 'admin'),
      },
      fields: [
        { name: 'amount', label: '申請金額', type: 'number', required: true, min: 0 },
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: '待審核', value: 'pending' },
            { label: '已核准', value: 'approved' },
            { label: '已撥款', value: 'paid' },
            { label: '已拒絕', value: 'rejected' },
          ],
        },
        { name: 'requestedAt', label: '申請時間', type: 'date' },
        { name: 'processedAt', label: '處理時間', type: 'date' },
        { name: 'adminNote', label: '管理員備註', type: 'text' },
      ],
    },
    // ── 備註 ──
    {
      name: 'note',
      label: '備註',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
