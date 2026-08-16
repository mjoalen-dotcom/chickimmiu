import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 會員訂閱紀錄 Collection
 * ──────────────────────
 * 一筆 = 一次「訂閱購買」的完整生命週期（綠界信用卡定期定額母交易）。
 * 建立流程：/api/subscription/ecpay/create 先建 pending →
 * 綠界首期授權成功 callback 標 active → 之後每期授權由
 * PeriodReturnURL callback 延長 currentPeriodEnd + streak +1。
 *
 * Users 上的 membership.* 欄位是本 collection 的 denormalized 快照，
 * 由 lib/subscription/activate.ts 的 syncUserMembership 維護，
 * 前台與 Orders hooks 讀 user 即可，不用每次 join。
 */
export const UserSubscriptions: CollectionConfig = {
  slug: 'user-subscriptions',
  labels: { singular: '會員訂閱', plural: '會員訂閱' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'id',
    description: '訂閱購買紀錄（綠界定期定額）— 系統自動維護，勿手動改狀態',
    defaultColumns: ['user', 'plan', 'status', 'billingCycle', 'amount', 'currentPeriodEnd', 'streakMonths'],
  },
  access: {
    // 會員可查自己的訂閱（前台顯示）；寫入全走 server（overrideAccess）
    read: ({ req: { user } }) => {
      if (!user) return false
      if ((user as { role?: string }).role === 'admin') return true
      return { user: { equals: user.id } }
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'user', label: '會員', type: 'relationship', relationTo: 'customers', required: true, index: true, admin: { width: '50%' } },
        { name: 'plan', label: '方案', type: 'relationship', relationTo: 'subscription-plans', required: true, admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          required: true,
          defaultValue: 'pending',
          options: [
            { label: '待付款', value: 'pending' },
            { label: '訂閱中', value: 'active' },
            { label: '已取消（權益至期末）', value: 'cancelled' },
            { label: '已到期', value: 'expired' },
          ],
          index: true,
          admin: { width: '34%' },
        },
        {
          name: 'billingCycle',
          label: '週期',
          type: 'select',
          required: true,
          defaultValue: 'monthly',
          options: [
            { label: '月繳', value: 'monthly' },
            { label: '年繳', value: 'yearly' },
          ],
          admin: { width: '33%' },
        },
        { name: 'amount', label: '每期金額（TWD）', type: 'number', required: true, admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startedAt', label: '開通時間', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'currentPeriodEnd', label: '權益有效至', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'streakMonths', label: '連續訂閱月數', type: 'number', defaultValue: 0, admin: { width: '33%' } },
      ],
    },
    {
      name: 'ecpay',
      label: '綠界定期定額',
      type: 'group',
      admin: { description: '母交易與授權狀態（callback 自動回填）' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'merchantTradeNo', label: '母交易編號', type: 'text', index: true, admin: { width: '50%', readOnly: true } },
            { name: 'gwsr', label: '最近授權單號 (gwsr)', type: 'text', admin: { width: '50%', readOnly: true } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'periodType', label: 'PeriodType', type: 'text', admin: { width: '25%', readOnly: true } },
            { name: 'execTimes', label: 'ExecTimes', type: 'number', admin: { width: '25%', readOnly: true } },
            { name: 'totalSuccessTimes', label: '成功授權次數', type: 'number', defaultValue: 0, admin: { width: '25%', readOnly: true } },
            { name: 'lastAuthAt', label: '最近授權時間', type: 'date', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
      ],
    },
    {
      name: 'authLog',
      label: '授權紀錄',
      type: 'array',
      admin: { description: '每期授權結果（含失敗），callback 自動追加', readOnly: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'at', label: '時間', type: 'date', admin: { width: '25%', date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'amount', label: '金額', type: 'number', admin: { width: '20%' } },
            { name: 'gwsr', label: 'gwsr', type: 'text', admin: { width: '25%' } },
            { name: 'rtnCode', label: 'RtnCode', type: 'text', admin: { width: '15%' } },
            { name: 'success', label: '成功', type: 'checkbox', admin: { width: '15%' } },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'cancelledAt', label: '取消時間', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'cancelReason', label: '取消原因', type: 'text', admin: { width: '50%' } },
      ],
    },
  ],
}
