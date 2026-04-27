import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 行銷自動化設定 Global
 * ─────────────────────────
 * 控制行銷自動化系統的全局參數：管道設定、A/B 測試、個人化推薦、
 * 節慶活動、生日行銷等所有自動化流程的預設值
 *
 * ⚠️ 前台稱號與後台分級碼完全分離
 *    前台只顯示：優雅初遇者 / 曦漾仙子 / 優漾女神 / 金曦女王 / 星耀皇后 / 璀璨天后
 */
export const MarketingAutomationSettings: GlobalConfig = {
  slug: 'marketing-automation-settings',
  label: '行銷自動化設定',
  admin: {
    group: '④ 行銷推廣',
    description: '通道優先順序、A/B 測試、個人化、節慶、生日活動規則',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ═══════════════════════════════════════
    // ── 一般設定 ──
    // ═══════════════════════════════════════
    {
      name: 'generalConfig',
      label: '一般設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用行銷自動化', type: 'checkbox', defaultValue: true },
        { name: 'maxCampaignsPerDay', label: '每日最大活動數', type: 'number', defaultValue: 3, admin: { description: '每位會員每日最多收到的活動數' } },
        { name: 'globalQuietHoursStart', label: '免打擾開始時間', type: 'number', defaultValue: 22 },
        { name: 'globalQuietHoursEnd', label: '免打擾結束時間', type: 'number', defaultValue: 8 },
        { name: 'defaultSenderName', label: '預設寄件人名稱', type: 'text', defaultValue: 'CHIC KIM & MIU' },
        { name: 'defaultSenderEmail', label: '預設寄件人 Email', type: 'email', defaultValue: 'hello@chickimmiu.com' },
      ],
    },

    // ═══════════════════════════════════════
    // ── 管道設定 ──
    // ═══════════════════════════════════════
    {
      name: 'channelConfig',
      label: '管道設定',
      type: 'group',
      fields: [
        {
          name: 'lineOA',
          label: 'LINE 官方帳號',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            { name: 'channelAccessToken', label: 'Channel Access Token', type: 'text' },
            { name: 'channelSecret', label: 'Channel Secret', type: 'text' },
            { name: 'richMenuId', label: 'Rich Menu ID', type: 'text' },
          ],
        },
        {
          name: 'email',
          label: 'Email',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            {
              name: 'provider',
              label: '服務提供商',
              type: 'select',
              dbName: 'mkt_email_provider',
              options: [
                { label: 'Resend', value: 'resend' },
                { label: 'AWS SES', value: 'ses' },
                { label: 'SendGrid', value: 'sendgrid' },
              ],
            },
            { name: 'apiKey', label: 'API Key', type: 'text' },
            { name: 'dailyLimit', label: '每日發送上限', type: 'number', defaultValue: 10000 },
          ],
        },
        {
          name: 'sms',
          label: '簡訊',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: false },
            {
              name: 'provider',
              label: '服務提供商',
              type: 'select',
              dbName: 'mkt_sms_provider',
              options: [
                { label: 'Twilio', value: 'twilio' },
                { label: '三竹簡訊', value: 'mitake' },
              ],
            },
            { name: 'apiKey', label: 'API Key', type: 'text' },
            { name: 'dailyLimit', label: '每日發送上限', type: 'number', defaultValue: 1000 },
          ],
        },
        {
          name: 'push',
          label: '推播通知',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: false },
            { name: 'fcmServerKey', label: 'FCM Server Key', type: 'text' },
          ],
        },
        {
          name: 'edm',
          label: 'EDM',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: false },
            {
              name: 'provider',
              label: '服務提供商',
              type: 'select',
              dbName: 'mkt_edm_provider',
              options: [
                { label: 'Mailchimp', value: 'mailchimp' },
                { label: 'SendGrid', value: 'sendgrid' },
              ],
            },
            { name: 'apiKey', label: 'API Key', type: 'text' },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── A/B 測試設定 ──
    // ═══════════════════════════════════════
    {
      name: 'abTestConfig',
      label: 'A/B 測試設定',
      type: 'group',
      fields: [
        { name: 'defaultMinSampleSize', label: '預設最小樣本數', type: 'number', defaultValue: 100 },
        { name: 'defaultConfidenceThreshold', label: '預設信心水準 (%)', type: 'number', defaultValue: 95 },
        { name: 'autoSelectWinnerEnabled', label: '自動選擇勝出', type: 'checkbox', defaultValue: true },
        {
          name: 'defaultWinnerMetric',
          label: '預設勝出指標',
          type: 'select',
          dbName: 'mkt_win_metric',
          defaultValue: 'conversion_rate',
          options: [
            { label: '開信率', value: 'open_rate' },
            { label: '點擊率', value: 'click_rate' },
            { label: '轉換率', value: 'conversion_rate' },
            { label: '營收', value: 'revenue' },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── 個人化設定 ──
    // ═══════════════════════════════════════
    {
      name: 'personalizationConfig',
      label: '個人化設定',
      type: 'group',
      fields: [
        { name: 'aiRecommendationEnabled', label: 'AI 推薦', type: 'checkbox', defaultValue: true },
        { name: 'ugcIntegrationEnabled', label: 'UGC 整合', type: 'checkbox', defaultValue: true },
        { name: 'creditScorePersonalizationEnabled', label: '信用分數個人化', type: 'checkbox', defaultValue: true },
        { name: 'segmentPersonalizationEnabled', label: '客群個人化', type: 'checkbox', defaultValue: true },
        { name: 'maxRecommendedProducts', label: '最大推薦商品數', type: 'number', defaultValue: 6 },
      ],
    },

    // ═══════════════════════════════════════
    // ── 節慶活動設定 ──
    // ═══════════════════════════════════════
    {
      name: 'festivalConfig',
      label: '節慶活動設定',
      type: 'group',
      fields: [
        { name: 'autoCreateFestivalCampaigns', label: '自動建立節慶活動', type: 'checkbox', defaultValue: true },
        { name: 'daysBeforeAutoCreate', label: '提前建立天數', type: 'number', defaultValue: 14, admin: { description: '自動建立節慶活動的提前天數' } },
        {
          name: 'defaultFestivalChannels',
          label: '預設節慶管道',
          type: 'select',
          dbName: 'mkt_fest_channels',
          hasMany: true,
          defaultValue: ['line', 'email'],
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

    // ═══════════════════════════════════════
    // ── 生日行銷設定 ──
    // ═══════════════════════════════════════
    {
      name: 'birthdayConfig',
      label: '生日行銷設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用生日行銷', type: 'checkbox', defaultValue: true },
        { name: 'preNotifyDays', label: '提前通知天數', type: 'number', defaultValue: 7 },
        { name: 'midMonthDay', label: '中期推薦日', type: 'number', defaultValue: 15 },
        { name: 'lastDaysCount', label: '倒數天數', type: 'number', defaultValue: 3 },
        { name: 'postFollowupDays', label: '結束後追蹤天數', type: 'number', defaultValue: 3 },

        // T4 星耀皇后
        { name: 'vipT4Discount', label: 'T4 星耀皇后折扣 %', type: 'number', defaultValue: 18 },
        { name: 'vipT4ShoppingCredit', label: 'T4 購物金', type: 'number', defaultValue: 500 },
        { name: 'vipT4Points', label: 'T4 點數', type: 'number', defaultValue: 800 },
        { name: 'vipT4StylingMinutes', label: 'T4 造型諮詢分鐘', type: 'number', defaultValue: 30 },

        // T5 璀璨天后
        { name: 'vipT5Discount', label: 'T5 璀璨天后折扣 %', type: 'number', defaultValue: 25 },
        { name: 'vipT5ShoppingCredit', label: 'T5 購物金', type: 'number', defaultValue: 1000 },
        { name: 'vipT5Points', label: 'T5 點數', type: 'number', defaultValue: 1500 },
        { name: 'vipT5StylingMinutes', label: 'T5 造型諮詢分鐘', type: 'number', defaultValue: 60 },
        { name: 'vipT5GiftBox', label: 'T5 限量禮盒', type: 'checkbox', defaultValue: true },

        // 信用分數加碼
        { name: 'creditScoreBonusT4', label: '信用≥90 T4 額外購物金', type: 'number', defaultValue: 200 },
        { name: 'creditScoreBonusT5', label: '信用≥90 T5 額外購物金', type: 'number', defaultValue: 400 },
        { name: 'creditScoreThreshold', label: '信用加碼門檻', type: 'number', defaultValue: 90 },

        // 共通
        { name: 'freeShippingAllTiers', label: '生日月免運', type: 'checkbox', defaultValue: true },
        { name: 'vipT5PriorityShipping', label: 'T5 優先出貨', type: 'checkbox', defaultValue: true },
        { name: 'pointsMultiplier', label: '生日月點數倍率', type: 'number', defaultValue: 2 },

        // 各等級生日禮物設定
        {
          name: 'tierGifts',
          label: '各等級生日禮物設定',
          type: 'array',
          fields: [
            {
              name: 'tierCode',
              label: '等級代碼',
              type: 'select',
              dbName: 'mkt_bday_tier_code',
              required: true,
              options: [
                { label: '優雅初遇者', value: 'ordinary' },
                { label: '曦漾仙子', value: 'bronze' },
                { label: '優漾女神', value: 'silver' },
                { label: '金曦女王', value: 'gold' },
                { label: '星耀皇后', value: 'platinum' },
                { label: '璀璨天后', value: 'diamond' },
              ],
            },
            { name: 'tierLabel', label: '前台稱號', type: 'text', admin: { description: '前台稱號，例如：優雅初遇者' } },
            { name: 'discountPercent', label: '折扣 %', type: 'number' },
            { name: 'shoppingCredit', label: '購物金 NT$', type: 'number' },
            { name: 'bonusPoints', label: '贈送點數', type: 'number' },
            { name: 'couponCode', label: '優惠券代碼', type: 'text' },
            { name: 'specialGift', label: '特殊禮物描述', type: 'text' },
            { name: 'stylingMinutes', label: '造型諮詢分鐘', type: 'number', defaultValue: 0 },
            { name: 'giftBoxIncluded', label: '含限量禮盒', type: 'checkbox', defaultValue: false },
          ],
        },
      ],
    },
  ],
}
