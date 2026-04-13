import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const AutomationLogs: CollectionConfig = {
  slug: 'automation-logs',
  admin: {
    group: '行銷工具',
    useAsTitle: 'status',
    defaultColumns: ['journey', 'user', 'status', 'currentStep', 'createdAt'],
    description: '自動化旅程執行紀錄',
  },
  access: {
    read: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'journey',
      label: '自動化旅程',
      type: 'relationship',
      relationTo: 'automation-journeys',
    },
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      options: [
        { label: '已觸發', value: 'triggered' },
        { label: '進行中', value: 'in_progress' },
        { label: '已完成', value: 'completed' },
        { label: '失敗', value: 'failed' },
        { label: '已跳過', value: 'skipped' },
      ],
    },
    {
      name: 'currentStep',
      label: '目前步驟',
      type: 'number',
    },
    {
      name: 'executedSteps',
      label: '已執行步驟',
      type: 'json',
    },
    {
      name: 'triggerData',
      label: '觸發資料',
      type: 'json',
    },
    {
      name: 'error',
      label: '錯誤訊息',
      type: 'text',
    },
    {
      name: 'completedAt',
      label: '完成時間',
      type: 'date',
    },
  ],
}
