import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 內容檢舉紀錄（App 專屬活動二：分享／留言）
 * ────────────────────────────────────────
 * 工單 2026-08-25：targetType + targetId + reporter 複合唯一索引
 * （同一會員對同一目標只能檢舉一次；重複送出回 ALREADY_REPORTED）。
 *
 * 檢舉不產生即時後果 —— 隱藏由後台人工審核後操作，端點只負責寫入紀錄。
 * review 一律填（檢舉留言時填該留言所屬的分享），後台才能一鍵跳到現場。
 */
export const ContentReports: CollectionConfig = {
  slug: 'content-reports',
  labels: { singular: '內容檢舉', plural: '內容檢舉' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'reason',
    defaultColumns: ['targetType', 'targetId', 'reason', 'targetUser', 'status', 'createdAt'],
    description: '會員對分享／留言的檢舉。處理完請把狀態改為「已處理」，否則無法分辨哪些看過了',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ['targetType', 'targetId', 'reporter'], unique: true }],
  timestamps: true,
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'targetType',
          label: '檢舉對象類型',
          type: 'select',
          required: true,
          index: true,
          options: [
            { label: '分享', value: 'review' },
            { label: '留言', value: 'comment' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'targetId',
          label: '對象 ID',
          type: 'number',
          required: true,
          index: true,
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'review',
      label: '所屬分享',
      type: 'relationship',
      relationTo: 'group-buy-shares',
      index: true,
      admin: { description: '檢舉留言時填該留言所屬的分享，供後台一鍵跳到現場' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'reporter',
          label: '檢舉人',
          type: 'relationship',
          relationTo: 'customers',
          required: true,
          index: true,
          admin: { width: '50%' },
        },
        {
          name: 'targetUser',
          label: '被檢舉內容的作者',
          type: 'relationship',
          relationTo: 'customers',
          index: true,
          admin: { width: '50%', description: '後台據此看出累犯' },
        },
      ],
    },
    {
      name: 'reason',
      label: '檢舉原因',
      type: 'select',
      required: true,
      options: [
        { label: '廣告或導流', value: 'spam' },
        { label: '不實內容', value: 'false_info' },
        { label: '人身攻擊或不當言語', value: 'harassment' },
        { label: '色情或暴力', value: 'explicit' },
        { label: '其他', value: 'other' },
      ],
    },
    {
      name: 'reasonDetail',
      label: '補充說明',
      type: 'textarea',
      defaultValue: '',
      admin: { description: '僅「其他」會有值，其餘存空字串（欄位一律存在，後台不必分辨 missing 與空值）' },
    },
    {
      name: 'status',
      label: '處理狀態',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: '待處理', value: 'pending' },
        { label: '已處理', value: 'handled' },
      ],
    },
  ],
}
