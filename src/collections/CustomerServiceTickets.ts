import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const CustomerServiceTickets: CollectionConfig = {
  slug: 'customer-service-tickets',
  labels: { singular: '客服工單 (v0 已停用)', plural: '客服工單 (v0 已停用)' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'ticketNumber',
    hidden: true, // v2 由 Conversations + Messages 取代（客服中心 Phase 1A，2026-04-28）
    defaultColumns: ['ticketNumber', 'user', 'channel', 'status', 'priority', 'category', 'createdAt'],
    description: 'v0 已停用，由 Conversations + Messages 取代。資料保留供未來 backfill；不要在此新增資料',
  },
  timestamps: true,
  fields: [
    {
      name: 'ticketNumber',
      label: '工單編號',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'channel',
      label: '管道',
      type: 'select',
      options: [
        { label: 'AI 聊天', value: 'ai_chat' },
        { label: 'LINE', value: 'line' },
        { label: 'Email', value: 'email' },
        { label: '電話', value: 'phone' },
        { label: '網頁表單', value: 'web_form' },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      options: [
        { label: '開啟', value: 'open' },
        { label: 'AI 處理中', value: 'ai_handling' },
        { label: '待人工處理', value: 'pending_human' },
        { label: '人工處理中', value: 'human_handling' },
        { label: '已解決', value: 'resolved' },
        { label: '已關閉', value: 'closed' },
      ],
    },
    {
      name: 'priority',
      label: '優先度',
      type: 'select',
      options: [
        { label: '低', value: 'low' },
        { label: '一般', value: 'normal' },
        { label: '高', value: 'high' },
        { label: '緊急', value: 'urgent' },
      ],
    },
    {
      name: 'category',
      label: '分類',
      type: 'select',
      options: [
        { label: '訂單查詢', value: 'order_inquiry' },
        { label: '物流狀態', value: 'shipping_status' },
        { label: '退換貨', value: 'return_exchange' },
        { label: '尺寸建議', value: 'size_advice' },
        { label: '點數查詢', value: 'points_inquiry' },
        { label: '信用分數', value: 'credit_score' },
        { label: '商品推薦', value: 'product_recommendation' },
        { label: '優惠券查詢', value: 'coupon_inquiry' },
        { label: '等級升級', value: 'tier_upgrade' },
        { label: '客訴', value: 'complaint' },
        { label: '其他', value: 'other' },
      ],
    },
    {
      name: 'subject',
      label: '主題',
      type: 'text',
    },
    {
      name: 'messages',
      label: '訊息',
      type: 'array',
      fields: [
        {
          name: 'sender',
          label: '發送者',
          type: 'select',
          options: [
            { label: '顧客', value: 'customer' },
            { label: 'AI', value: 'ai' },
            { label: '客服人員', value: 'agent' },
          ],
        },
        {
          name: 'content',
          label: '內容',
          type: 'textarea',
        },
        {
          name: 'timestamp',
          label: '時間',
          type: 'date',
        },
        {
          name: 'metadata',
          label: '額外資料',
          type: 'json',
        },
      ],
    },
    {
      name: 'assignedAgent',
      label: '指派客服',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'aiSummary',
      label: 'AI 摘要',
      type: 'textarea',
      admin: {
        description: 'AI 自動產生的對話摘要',
      },
    },
    {
      name: 'sentiment',
      label: '情緒',
      type: 'select',
      options: [
        { label: '正面', value: 'positive' },
        { label: '中立', value: 'neutral' },
        { label: '負面', value: 'negative' },
        { label: '憤怒', value: 'angry' },
      ],
    },
    {
      name: 'escalationReason',
      label: '升級原因',
      type: 'text',
    },
    {
      name: 'relatedOrder',
      label: '相關訂單',
      type: 'relationship',
      relationTo: 'orders',
    },
    {
      name: 'resolution',
      label: '解決方案',
      type: 'textarea',
    },
    {
      name: 'resolvedAt',
      label: '解決時間',
      type: 'date',
    },
  ],
}
