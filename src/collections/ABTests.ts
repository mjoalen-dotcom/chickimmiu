import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * A/B 測試 Collection
 * ──────────────────
 * 記錄行銷活動的 A/B 測試實驗，包含多變體、勝出指標、信心水準與自動選擇機制
 */
export const ABTests: CollectionConfig = {
  slug: 'ab-tests',
  labels: { singular: 'A/B 測試', plural: 'A/B 測試' },
  admin: {
    group: '行銷推廣',
    useAsTitle: 'testName',
    description: 'A/B 測試實驗管理',
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
      name: 'testName',
      label: '測試名稱',
      type: 'text',
      required: true,
    },
    {
      name: 'campaign',
      label: '關聯活動',
      type: 'relationship',
      relationTo: 'marketing-campaigns',
      required: true,
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '執行中', value: 'running' },
        { label: '已完成', value: 'completed' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    {
      name: 'variants',
      label: '變體',
      type: 'array',
      required: true,
      minRows: 2,
      fields: [
        { name: 'variantName', label: '變體名稱', type: 'text', required: true },
        { name: 'variantSlug', label: '變體代碼', type: 'text', required: true },
        {
          name: 'messageTemplate',
          label: '訊息模板',
          type: 'relationship',
          relationTo: 'message-templates',
        },
        { name: 'percentage', label: '流量百分比', type: 'number', required: true, min: 0, max: 100 },
        {
          name: 'metrics',
          label: '成效指標',
          type: 'group',
          fields: [
            { name: 'sent', label: '已發送', type: 'number', defaultValue: 0 },
            { name: 'opened', label: '已開啟', type: 'number', defaultValue: 0 },
            { name: 'clicked', label: '已點擊', type: 'number', defaultValue: 0 },
            { name: 'converted', label: '已轉換', type: 'number', defaultValue: 0 },
            { name: 'revenue', label: '營收', type: 'number', defaultValue: 0 },
          ],
        },
      ],
    },
    {
      name: 'winnerMetric',
      label: '勝出指標',
      type: 'select',
      defaultValue: 'conversion_rate',
      options: [
        { label: '開信率', value: 'open_rate' },
        { label: '點擊率', value: 'click_rate' },
        { label: '轉換率', value: 'conversion_rate' },
        { label: '營收', value: 'revenue' },
      ],
    },
    {
      name: 'winnerVariant',
      label: '勝出變體',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'confidenceLevel',
      label: '信心水準',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'autoSelectWinner',
      label: '自動選擇勝出',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'minSampleSize',
      label: '最小樣本數',
      type: 'number',
      defaultValue: 100,
    },
    {
      name: 'startedAt',
      label: '開始時間',
      type: 'date',
    },
    {
      name: 'completedAt',
      label: '完成時間',
      type: 'date',
    },
    {
      name: 'analysis',
      label: '分析結果',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        { name: 'summary', label: '摘要', type: 'textarea' },
        { name: 'recommendation', label: '建議', type: 'textarea' },
      ],
    },
  ],
}
