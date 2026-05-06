import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 節慶行銷模板 Collection
 * ──────────────────
 * 管理各節慶／假日行銷模板：情人節、母親節、雙十一、黑五、聖誕等
 * 支援多階段行銷、客群差異化優惠、信用分數加碼、A/B 測試、AI 推薦、UGC 整合
 */
export const FestivalTemplates: CollectionConfig = {
  slug: 'festival-templates',
  labels: { singular: '節慶模板', plural: '節慶模板' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'festivalName',
    description: '節慶／假日行銷模板管理',
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
      name: 'festivalName',
      label: '節慶名稱',
      type: 'text',
      required: true,
    },
    {
      name: 'festivalSlug',
      label: '節慶代碼',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'festivalType',
      label: '節慶類型',
      type: 'select',
      options: [
        { label: '情人節', value: 'valentines' },
        { label: '母親節', value: 'mothers_day' },
        { label: '婦女節', value: 'womens_day' },
        { label: '端午節', value: 'dragon_boat' },
        { label: '中秋節', value: 'mid_autumn' },
        { label: '雙十一', value: 'double_eleven' },
        { label: '黑色星期五', value: 'black_friday' },
        { label: '聖誕跨年', value: 'christmas_newyear' },
        { label: '生日月', value: 'birthday_month' },
        { label: '季節性上新', value: 'seasonal_launch' },
        { label: '自訂', value: 'custom' },
      ],
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
      name: 'isRecurring',
      label: '每年循環',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'schedule',
      label: '排程設定',
      type: 'group',
      fields: [
        { name: 'typicalMonth', label: '通常月份', type: 'number', min: 1, max: 12 },
        { name: 'typicalDay', label: '通常日期', type: 'number', min: 1, max: 31 },
        {
          name: 'daysBeforeStart',
          label: '提前天數',
          type: 'number',
          defaultValue: 7,
          admin: { description: '提前幾天開始暖場' },
        },
        { name: 'durationDays', label: '活動天數', type: 'number', defaultValue: 7 },
        { name: 'useCustomDates', label: '使用自訂日期', type: 'checkbox' },
        { name: 'customStartDate', label: '自訂開始日期', type: 'date' },
        { name: 'customEndDate', label: '自訂結束日期', type: 'date' },
      ],
    },
    {
      name: 'theme',
      label: '主題設定',
      type: 'group',
      fields: [
        { name: 'primaryColor', label: '主色', type: 'text' },
        { name: 'secondaryColor', label: '副色', type: 'text' },
        { name: 'bannerImage', label: '橫幅圖片', type: 'upload', relationTo: 'media' },
        { name: 'mobileImage', label: '手機圖片', type: 'upload', relationTo: 'media' },
        { name: 'tagline', label: '標語', type: 'text' },
        { name: 'hashtag', label: 'Hashtag', type: 'text' },
      ],
    },
    {
      name: 'phases',
      label: '行銷階段',
      type: 'array',
      fields: [
        { name: 'phaseName', label: '階段名稱', type: 'text', required: true },
        { name: 'phaseSlug', label: '階段代碼', type: 'text', required: true },
        {
          name: 'phaseType',
          label: '階段類型',
          type: 'select',
          required: true,
          options: [
            { label: '暖場期', value: 'warmup' },
            { label: '高峰期', value: 'peak' },
            { label: '後續追蹤', value: 'followup' },
          ],
        },
        {
          name: 'offsetDays',
          label: '偏移天數',
          type: 'number',
          required: true,
          admin: { description: '相對活動開始日的偏移天數' },
        },
        { name: 'durationHours', label: '持續小時', type: 'number', required: true },
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
      ],
    },
    {
      name: 'segmentOffers',
      label: '客群差異化優惠',
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
        {
          name: 'discountType',
          label: '優惠類型',
          type: 'select',
          options: [
            { label: '百分比折扣', value: 'percentage' },
            { label: '固定金額折扣', value: 'fixed' },
            { label: '點數加倍', value: 'points_multiplier' },
            { label: '免運', value: 'free_shipping' },
            { label: '贈品', value: 'gift' },
          ],
        },
        { name: 'discountValue', label: '優惠數值', type: 'number', required: true },
        { name: 'couponCode', label: '優惠碼', type: 'text' },
        {
          name: 'additionalMessage',
          label: '差異化文案',
          type: 'textarea',
          admin: { description: '差異化文案' },
        },
        {
          name: 'creditScoreBonus',
          label: '信用分數加碼',
          type: 'group',
          fields: [
            {
              name: 'highCreditExtraDiscount',
              label: '高信用額外折扣%',
              type: 'number',
              admin: { description: '信用分數≥90額外折扣%' },
            },
            {
              name: 'mediumCreditExtraDiscount',
              label: '中信用額外折扣%',
              type: 'number',
              admin: { description: '信用分數70-89額外折扣%' },
            },
          ],
        },
      ],
    },
    {
      name: 'pointsConfig',
      label: '點數設定',
      type: 'group',
      fields: [
        {
          name: 'multiplier',
          label: '點數加倍倍率',
          type: 'number',
          defaultValue: 2,
          admin: { description: '點數加倍倍率' },
        },
        { name: 'bonusPoints', label: '額外獎勵點數', type: 'number', defaultValue: 0 },
        {
          name: 'flashPointsHours',
          label: '限時加倍小時數',
          type: 'number',
          defaultValue: 2,
          admin: { description: '限時加倍小時數' },
        },
      ],
    },
    {
      name: 'aiRecommendation',
      label: 'AI 推薦設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
        {
          name: 'strategy',
          label: '推薦策略',
          type: 'select',
          options: [
            { label: '趨勢商品', value: 'trending' },
            { label: '個人化推薦', value: 'personalized' },
            { label: '暢銷商品', value: 'bestseller' },
            { label: '互補商品', value: 'complementary' },
          ],
        },
        { name: 'maxProducts', label: '最大推薦數', type: 'number', defaultValue: 6 },
      ],
    },
    {
      name: 'ugcIntegration',
      label: 'UGC 整合',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
        { name: 'hashtagCampaign', label: 'Hashtag 活動', type: 'text' },
        { name: 'ugcRewardPoints', label: 'UGC 獎勵點數', type: 'number', defaultValue: 20 },
      ],
    },
    {
      name: 'abTestVariants',
      label: 'A/B 測試變體',
      type: 'array',
      minRows: 2,
      fields: [
        { name: 'variantName', label: '變體名稱', type: 'text', required: true },
        { name: 'variantSlug', label: '變體代碼', type: 'text', required: true },
        { name: 'subject', label: '主旨', type: 'text' },
        { name: 'headline', label: '標題', type: 'text' },
        { name: 'bodyContent', label: '內文', type: 'textarea' },
        { name: 'ctaText', label: 'CTA 文字', type: 'text' },
        { name: 'ctaUrl', label: 'CTA 連結', type: 'text' },
      ],
    },
    {
      name: 'kpiTargets',
      label: 'KPI 目標',
      type: 'group',
      fields: [
        { name: 'targetRevenue', label: '目標營收', type: 'number' },
        { name: 'targetConversionRate', label: '目標轉換率', type: 'number' },
        { name: 'targetOpenRate', label: '目標開信率', type: 'number' },
        { name: 'targetClickRate', label: '目標點擊率', type: 'number' },
      ],
    },
    {
      name: 'linkedJourneys',
      label: '關聯自動化旅程',
      type: 'array',
      fields: [
        {
          name: 'journey',
          label: '旅程',
          type: 'relationship',
          relationTo: 'automation-journeys',
        },
        { name: 'phase', label: '階段', type: 'text' },
      ],
    },
    {
      name: 'adminNote',
      label: '後台備註',
      type: 'textarea',
    },
  ],
}
