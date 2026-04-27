import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const AutomationJourneys: CollectionConfig = {
  slug: 'automation-journeys',
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive', 'triggerType', 'triggerEvent', 'priority', 'createdAt'],
    description: '自動化旅程定義（14 種自動化流程）',
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      label: '名稱',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'description',
      label: '描述',
      type: 'textarea',
    },
    {
      name: 'isActive',
      label: '啟用',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'triggerType',
      label: '觸發類型',
      type: 'select',
      options: [
        { label: '事件觸發', value: 'event' },
        { label: '排程觸發', value: 'schedule' },
        { label: '條件觸發', value: 'condition' },
      ],
    },
    {
      name: 'triggerEvent',
      label: '觸發事件',
      type: 'select',
      options: [
        { label: '用戶註冊', value: 'user_registered' },
        { label: '首次購買', value: 'first_purchase' },
        { label: '下單', value: 'order_placed' },
        { label: '棄單', value: 'cart_abandoned' },
        { label: '等級升級', value: 'tier_upgraded' },
        { label: '等級差距提醒', value: 'tier_gap_reminder' },
        { label: '沉睡 30 天', value: 'dormant_30d' },
        { label: '沉睡 45 天', value: 'dormant_45d' },
        { label: '沉睡 60 天', value: 'dormant_60d' },
        { label: '生日月', value: 'birthday_month' },
        { label: '新品上架', value: 'new_product_launch' },
        { label: 'VIP 關懷', value: 'vip_care' },
        { label: '點數即將過期', value: 'points_expiring' },
        { label: '信用分數變動', value: 'credit_score_changed' },
        { label: '信用分數低於 60', value: 'credit_low_60' },
        { label: '信用分數低於 30', value: 'credit_low_30' },
        { label: '連續退貨', value: 'consecutive_returns' },
        { label: '優良客戶', value: 'good_customer' },
      ],
    },
    {
      name: 'conditions',
      label: '條件篩選',
      type: 'json',
      admin: {
        description: '篩選條件，如等級、信用分數範圍、標籤等',
      },
    },
    {
      name: 'steps',
      label: '步驟',
      type: 'array',
      fields: [
        {
          name: 'stepOrder',
          label: '步驟順序',
          type: 'number',
        },
        {
          name: 'action',
          label: '動作',
          type: 'select',
          options: [
            { label: '發送 LINE 訊息', value: 'send_line' },
            { label: '發送 Email', value: 'send_email' },
            { label: '發送簡訊', value: 'send_sms' },
            { label: '等待', value: 'wait' },
            { label: '條件檢查', value: 'condition_check' },
            { label: '新增標籤', value: 'add_tag' },
            { label: '移除標籤', value: 'remove_tag' },
            { label: '更新欄位', value: 'update_field' },
            { label: '發送優惠券', value: 'assign_coupon' },
          ],
        },
        {
          name: 'delayMinutes',
          label: '延遲分鐘數',
          type: 'number',
        },
        {
          name: 'templateKey',
          label: '模板 Key',
          type: 'text',
        },
        {
          name: 'content',
          label: '內容',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'priority',
      label: '優先順序',
      type: 'number',
      min: 1,
      max: 10,
    },
    {
      name: 'maxExecutionsPerUser',
      label: '每位用戶最大執行次數',
      type: 'number',
    },
    {
      name: 'cooldownHours',
      label: '冷卻時間（小時）',
      type: 'number',
    },
  ],
}
