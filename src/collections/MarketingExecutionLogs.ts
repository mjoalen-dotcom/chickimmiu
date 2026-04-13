import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 行銷執行紀錄 Collection
 * ──────────────────
 * 記錄每一筆行銷訊息的發送與互動歷程：發送、送達、開啟、點擊、轉換
 * 保留發送當下的用戶狀態快照（客群、信用分數、等級）
 */
export const MarketingExecutionLogs: CollectionConfig = {
  slug: 'marketing-execution-logs',
  labels: { singular: '行銷執行紀錄', plural: '行銷執行紀錄' },
  admin: {
    group: '行銷自動化',
    description: '行銷訊息發送與互動紀錄',
    defaultColumns: ['campaign', 'user', 'channel', 'status', 'sentAt'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'campaign',
      label: '行銷活動',
      type: 'relationship',
      relationTo: 'marketing-campaigns',
      required: true,
      index: true,
    },
    {
      name: 'user',
      label: '用戶',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'channel',
      label: '管道',
      type: 'select',
      options: [
        { label: 'LINE', value: 'line' },
        { label: 'Email', value: 'email' },
        { label: '簡訊', value: 'sms' },
        { label: '推播通知', value: 'push' },
        { label: '站內彈窗', value: 'in_app_popup' },
        { label: 'EDM', value: 'edm' },
      ],
    },
    {
      name: 'messageTemplate',
      label: '訊息模板',
      type: 'relationship',
      relationTo: 'message-templates',
    },
    {
      name: 'abTestVariant',
      label: 'A/B 測試變體',
      type: 'text',
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: '待處理', value: 'pending' },
        { label: '已發送', value: 'sent' },
        { label: '已送達', value: 'delivered' },
        { label: '已開啟', value: 'opened' },
        { label: '已點擊', value: 'clicked' },
        { label: '已轉換', value: 'converted' },
        { label: '退件', value: 'bounced' },
        { label: '失敗', value: 'failed' },
        { label: '退訂', value: 'unsubscribed' },
      ],
    },
    {
      name: 'personalizedData',
      label: '個人化資料',
      type: 'json',
      admin: {
        description: '實際發送的個人化內容',
      },
    },
    { name: 'sentAt', label: '發送時間', type: 'date' },
    { name: 'deliveredAt', label: '送達時間', type: 'date' },
    { name: 'openedAt', label: '開啟時間', type: 'date' },
    { name: 'clickedAt', label: '點擊時間', type: 'date' },
    { name: 'convertedAt', label: '轉換時間', type: 'date' },
    { name: 'conversionOrderId', label: '轉換訂單編號', type: 'text' },
    { name: 'conversionRevenue', label: '轉換營收', type: 'number' },
    { name: 'errorMessage', label: '錯誤訊息', type: 'text' },
    {
      name: 'userSegment',
      label: '用戶客群（發送時）',
      type: 'text',
      admin: { description: '發送當下的客群標籤' },
    },
    {
      name: 'userCreditScore',
      label: '用戶信用分數（發送時）',
      type: 'number',
      admin: { description: '發送當下的信用分數' },
    },
    {
      name: 'userTier',
      label: '用戶等級（發送時）',
      type: 'text',
      admin: { description: '發送當下的會員等級' },
    },
  ],
}
