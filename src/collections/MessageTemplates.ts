import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 訊息模板 Collection
 * ──────────────────
 * 多管道訊息模板管理：LINE、Email、簡訊、推播、站內彈窗、EDM
 * 支援客群差異化文案、信用分數分級內容、會員等級個人化
 */
export const MessageTemplates: CollectionConfig = {
  slug: 'message-templates',
  labels: { singular: '訊息模板', plural: '訊息模板' },
  admin: {
    group: '行銷自動化',
    useAsTitle: 'templateName',
    description: '多管道訊息模板管理',
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
      name: 'templateName',
      label: '模板名稱',
      type: 'text',
      required: true,
    },
    {
      name: 'templateSlug',
      label: '模板代碼',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'channel',
      label: '管道',
      type: 'select',
      required: true,
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
      name: 'category',
      label: '分類',
      type: 'select',
      options: [
        { label: '促銷', value: 'promotional' },
        { label: '交易通知', value: 'transactional' },
        { label: '生命週期', value: 'lifecycle' },
        { label: '節慶', value: 'festival' },
        { label: '信用分數', value: 'credit_score' },
        { label: '等級升等', value: 'tier_upgrade' },
        { label: '點數提醒', value: 'points_reminder' },
        { label: '歡迎', value: 'welcome' },
        { label: '喚回', value: 'winback' },
        { label: '自訂', value: 'custom' },
      ],
    },
    {
      name: 'subject',
      label: '信件主旨',
      type: 'text',
      admin: {
        condition: (data) => data?.channel === 'email' || data?.channel === 'edm',
      },
    },
    {
      name: 'content',
      label: '內容',
      type: 'richText',
      admin: {
        condition: (data) => data?.channel === 'email' || data?.channel === 'edm',
      },
    },
    {
      name: 'textContent',
      label: '文字內容',
      type: 'textarea',
      admin: {
        condition: (data) => data?.channel !== 'email' && data?.channel !== 'edm',
      },
    },
    {
      name: 'htmlContent',
      label: 'HTML 內容',
      type: 'code',
      admin: {
        language: 'html',
        condition: (data) => data?.channel === 'email' || data?.channel === 'edm',
      },
    },
    {
      name: 'lineFlexMessage',
      label: 'LINE Flex Message',
      type: 'json',
      admin: {
        condition: (data) => data?.channel === 'line',
      },
    },
    {
      name: 'variables',
      label: '變數',
      type: 'array',
      fields: [
        { name: 'variableName', label: '變數名稱', type: 'text', required: true },
        {
          name: 'variableType',
          label: '變數類型',
          type: 'select',
          options: [
            { label: '用戶名稱', value: 'user_name' },
            { label: '會員等級（前台名稱）', value: 'tier_front_name' },
            { label: '信用分數', value: 'credit_score' },
            { label: '點數餘額', value: 'points_balance' },
            { label: '客群標籤', value: 'segment_label' },
            { label: '商品名稱', value: 'product_name' },
            { label: '折扣碼', value: 'discount_code' },
            { label: '自訂', value: 'custom' },
          ],
        },
        { name: 'defaultValue', label: '預設值', type: 'text' },
        { name: 'description', label: '說明', type: 'text' },
      ],
    },
    {
      name: 'segmentVariants',
      label: '客群差異化內容',
      type: 'array',
      fields: [
        {
          name: 'segment',
          label: '客群',
          type: 'select',
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
            { label: '預設', value: 'default' },
          ],
        },
        { name: 'contentOverride', label: '內容覆寫', type: 'textarea' },
        { name: 'subjectOverride', label: '主旨覆寫', type: 'text' },
      ],
    },
    {
      name: 'creditScoreVariants',
      label: '信用分數差異化內容',
      type: 'array',
      fields: [
        { name: 'minScore', label: '最低分數', type: 'number' },
        { name: 'maxScore', label: '最高分數', type: 'number' },
        { name: 'contentOverride', label: '內容覆寫', type: 'textarea' },
        { name: 'extraDiscount', label: '額外折扣', type: 'number' },
      ],
    },
    {
      name: 'tierVariants',
      label: '會員等級差異化內容',
      type: 'array',
      admin: {
        description: '等級對照：ordinary=優雅初遇者, bronze=曦漾仙子, silver=優漾女神, gold=金曦女王, platinum=星耀皇后, diamond=璀璨天后',
      },
      fields: [
        {
          name: 'tierCode',
          label: '等級',
          type: 'select',
          options: [
            { label: '優雅初遇者 (ordinary)', value: 'ordinary' },
            { label: '曦漾仙子 (bronze)', value: 'bronze' },
            { label: '優漾女神 (silver)', value: 'silver' },
            { label: '金曦女王 (gold)', value: 'gold' },
            { label: '星耀皇后 (platinum)', value: 'platinum' },
            { label: '璀璨天后 (diamond)', value: 'diamond' },
          ],
        },
        { name: 'contentOverride', label: '內容覆寫', type: 'textarea' },
      ],
    },
    {
      name: 'isActive',
      label: '啟用',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'previewImage',
      label: '預覽圖',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'tags',
      label: '標籤',
      type: 'array',
      fields: [
        { name: 'tag', label: '標籤', type: 'text' },
      ],
    },
  ],
}
