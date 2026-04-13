import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 行銷活動 Collection
 * ──────────────────
 * 管理所有行銷活動：限時特賣、節慶行銷、新品上市、會員升等、清倉、UGC 競賽等
 * 支援 A/B 測試、多管道推播、AI 個人化、信用分數篩選、預算追蹤
 */
export const MarketingCampaigns: CollectionConfig = {
  slug: 'marketing-campaigns',
  labels: { singular: '行銷活動', plural: '行銷活動' },
  admin: {
    group: '行銷自動化',
    useAsTitle: 'campaignName',
    description: '管理所有行銷活動與排程',
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
      name: 'campaignName',
      label: '活動名稱',
      type: 'text',
      required: true,
    },
    {
      name: 'campaignSlug',
      label: '活動代碼',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'campaignType',
      label: '活動類型',
      type: 'select',
      options: [
        { label: '限時特賣', value: 'flash_sale' },
        { label: '節慶行銷', value: 'festival' },
        { label: '新品上市', value: 'new_product_launch' },
        { label: '會員升等', value: 'membership_upgrade' },
        { label: '清倉特賣', value: 'clearance' },
        { label: 'UGC 競賽', value: 'ugc_contest' },
        { label: '推薦加碼', value: 'referral_boost' },
        { label: '忠誠活動', value: 'loyalty_event' },
        { label: '季節性活動', value: 'seasonal' },
        { label: '自訂', value: 'custom' },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已排程', value: 'scheduled' },
        { label: '進行中', value: 'active' },
        { label: '已暫停', value: 'paused' },
        { label: '已完成', value: 'completed' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    {
      name: 'description',
      label: '活動描述',
      type: 'textarea',
    },
    {
      name: 'targetSegments',
      label: '目標客群',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'VIP1 - 高價值忠誠', value: 'VIP1' },
        { label: 'VIP2 - 高價值成長', value: 'VIP2' },
        { label: 'POT1 - 潛力客戶', value: 'POT1' },
        { label: 'REG1 - 穩定客戶', value: 'REG1' },
        { label: 'REG2 - 一般客戶', value: 'REG2' },
        { label: 'RISK1 - 流失風險', value: 'RISK1' },
        { label: 'RISK2 - 高風險', value: 'RISK2' },
        { label: 'NEW1 - 新客戶', value: 'NEW1' },
        { label: 'SLP1 - 沉睡客戶', value: 'SLP1' },
        { label: 'BLK1 - 黑名單', value: 'BLK1' },
        { label: '全部', value: 'all' },
      ],
    },
    {
      name: 'creditScoreFilter',
      label: '信用分數篩選',
      type: 'group',
      fields: [
        { name: 'minScore', label: '最低分數', type: 'number' },
        { name: 'maxScore', label: '最高分數', type: 'number' },
      ],
    },
    {
      name: 'tierFilter',
      label: '會員等級篩選',
      type: 'select',
      hasMany: true,
      options: [
        { label: '優雅初遇者', value: 'ordinary' },
        { label: '曦漾仙子', value: 'bronze' },
        { label: '優漾女神', value: 'silver' },
        { label: '金曦女王', value: 'gold' },
        { label: '星耀皇后', value: 'platinum' },
        { label: '璀璨天后', value: 'diamond' },
        { label: '全部', value: 'all' },
      ],
    },
    {
      name: 'schedule',
      label: '排程',
      type: 'group',
      fields: [
        { name: 'startDate', label: '開始日期', type: 'date', required: true },
        { name: 'endDate', label: '結束日期', type: 'date', required: true },
        { name: 'timezone', label: '時區', type: 'text', defaultValue: 'Asia/Taipei' },
      ],
    },
    {
      name: 'channels',
      label: '推播管道',
      type: 'select',
      hasMany: true,
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
      name: 'journeyRef',
      label: '關聯自動化旅程',
      type: 'relationship',
      relationTo: 'automation-journeys',
    },
    {
      name: 'messageTemplates',
      label: '訊息模板',
      type: 'array',
      fields: [
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
          name: 'templateRef',
          label: '訊息模板',
          type: 'relationship',
          relationTo: 'message-templates',
        },
      ],
    },
    {
      name: 'abTestEnabled',
      label: '啟用 A/B 測試',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'abTestConfig',
      label: 'A/B 測試設定',
      type: 'group',
      admin: {
        condition: (data) => Boolean(data?.abTestEnabled),
      },
      fields: [
        { name: 'variantCount', label: '變體數量', type: 'number', defaultValue: 2 },
        {
          name: 'splitRatio',
          label: '流量分配',
          type: 'array',
          fields: [
            { name: 'variantName', label: '變體名稱', type: 'text' },
            { name: 'percentage', label: '百分比', type: 'number' },
          ],
        },
        {
          name: 'winnerMetric',
          label: '勝出指標',
          type: 'select',
          options: [
            { label: '開信率', value: 'open_rate' },
            { label: '點擊率', value: 'click_rate' },
            { label: '轉換率', value: 'conversion_rate' },
            { label: '營收', value: 'revenue' },
          ],
        },
        { name: 'autoSelectWinner', label: '自動選擇勝出', type: 'checkbox', defaultValue: true },
        { name: 'minSampleSize', label: '最小樣本數', type: 'number', defaultValue: 100 },
      ],
    },
    {
      name: 'budget',
      label: '預算',
      type: 'group',
      fields: [
        { name: 'totalBudget', label: '總預算', type: 'number' },
        { name: 'spentAmount', label: '已花費', type: 'number', defaultValue: 0 },
        { name: 'costPerMessage', label: '每則訊息成本', type: 'number' },
      ],
    },
    {
      name: 'performance',
      label: '成效數據',
      type: 'group',
      admin: {
        readOnly: true,
      },
      fields: [
        { name: 'sent', label: '已發送', type: 'number', defaultValue: 0 },
        { name: 'delivered', label: '已送達', type: 'number', defaultValue: 0 },
        { name: 'opened', label: '已開啟', type: 'number', defaultValue: 0 },
        { name: 'clicked', label: '已點擊', type: 'number', defaultValue: 0 },
        { name: 'converted', label: '已轉換', type: 'number', defaultValue: 0 },
        { name: 'revenue', label: '營收', type: 'number', defaultValue: 0 },
        { name: 'unsubscribed', label: '退訂', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'personalizedContent',
      label: '個人化內容',
      type: 'group',
      fields: [
        { name: 'useAIRecommendation', label: '使用 AI 推薦', type: 'checkbox', defaultValue: true },
        { name: 'useUGC', label: '使用 UGC 內容', type: 'checkbox', defaultValue: true },
        { name: 'useCreditScorePersonalization', label: '依信用分數個人化', type: 'checkbox', defaultValue: true },
        { name: 'useSegmentPersonalization', label: '依客群個人化', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'linkedFestival',
      label: '關聯節慶模板',
      type: 'relationship',
      relationTo: 'festival-templates',
      admin: {
        condition: (data) => data?.campaignType === 'festival',
      },
    },
    {
      name: 'adminNote',
      label: '後台備註',
      type: 'textarea',
    },
  ],
}
