import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 訂閱方案 Collection
 * ──────────────────
 * 可從後台 CRUD 所有訂閱方案：名稱、月/年費、折扣、點數倍率、購物金、免運門檻等
 * 多巴胺機制：連續訂閱獎勵、每月驚喜禮、限定徽章、獨家搶先購
 */
export const SubscriptionPlans: CollectionConfig = {
  slug: 'subscription-plans',
  labels: { singular: '訂閱方案', plural: '訂閱方案' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'name',
    description: '管理訂閱會員制方案（月費/年費/優惠/獎勵）',
    defaultColumns: ['name', 'monthlyPrice', 'yearlyPrice', 'isActive', 'sortOrder'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    // SSR consumer (Phase 5.5 N1):
    //   /account/subscription renders all active plans via
    //   getPayload().find('subscription-plans')
    // Any plan change invalidates that page's full-route cache.
    afterChange: [
      () => safeRevalidate(['/account/subscription'], ['subscription-plans']),
    ],
    afterDelete: [
      () => safeRevalidate(['/account/subscription'], ['subscription-plans']),
    ],
  },
  fields: [
    // ── 基本資訊 ──
    { name: 'name', label: '方案名稱', type: 'text', required: true, admin: { description: '例如：VIP 閃耀會員、尊榮鑽石會員' } },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    { name: 'description', label: '方案描述', type: 'textarea' },
    { name: 'badge', label: '專屬標籤', type: 'text', admin: { description: '例如：✨ VIP、💎 鑽石' } },
    { name: 'badgeColor', label: '標籤顏色', type: 'text', defaultValue: '#C19A5B' },
    { name: 'sortOrder', label: '排序', type: 'number', defaultValue: 0 },
    { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },
    { name: 'isFeatured', label: '推薦方案', type: 'checkbox', defaultValue: false, admin: { description: '首頁或方案列表中高亮顯示' } },

    // ── 定價 ──
    {
      name: 'pricing',
      label: '定價',
      type: 'group',
      fields: [
        { name: 'monthlyPrice', label: '月費（TWD）', type: 'number', required: true },
        { name: 'yearlyPrice', label: '年費（TWD）', type: 'number', admin: { description: '年繳優惠價，留空則不提供年繳' } },
        { name: 'trialDays', label: '免費試用天數', type: 'number', defaultValue: 0 },
      ],
    },

    // ── 購物優惠 ──
    {
      name: 'benefits',
      label: '購物優惠',
      type: 'group',
      fields: [
        { name: 'discountPercent', label: '全站折扣（%）', type: 'number', defaultValue: 0, admin: { description: '例如 10 = 打 9 折' } },
        { name: 'pointsMultiplier', label: '點數倍率', type: 'number', defaultValue: 1, admin: { description: '例如 2 = 雙倍點數' } },
        { name: 'freeShippingThreshold', label: '免運門檻（TWD）', type: 'number', admin: { description: '訂閱會員專屬免運門檻，0 = 全站免運' } },
        { name: 'monthlyCredit', label: '每月贈送購物金', type: 'number', defaultValue: 0 },
        { name: 'birthdayBonusMultiplier', label: '生日禮加成倍率', type: 'number', defaultValue: 1, admin: { description: '例如 2 = 生日月雙倍購物金' } },
        { name: 'exclusiveCouponCount', label: '每月專屬優惠券數量', type: 'number', defaultValue: 0 },
      ],
    },

    // ── 多巴胺機制（成癮誘因） ──
    {
      name: 'dopamine',
      label: '多巴胺機制',
      type: 'group',
      admin: { description: '利用間歇性獎勵、連續訂閱、驚喜禮等機制提升留存率' },
      fields: [
        { name: 'dailyLoginBonus', label: '每日登入獎勵點數', type: 'number', defaultValue: 0 },
        { name: 'consecutiveMonthBonus', label: '連續訂閱月獎勵（購物金）', type: 'number', defaultValue: 0, admin: { description: '每連續 3 個月額外贈送' } },
        { name: 'mysteryGiftEnabled', label: '每月驚喜禮盒', type: 'checkbox', defaultValue: false, admin: { description: '隨機贈品/折價券，利用不確定性提升期待感' } },
        { name: 'earlyAccessHours', label: '新品搶先購（提前小時數）', type: 'number', defaultValue: 0 },
        { name: 'exclusiveLotterySpins', label: '每月抽獎次數', type: 'number', defaultValue: 0 },
        { name: 'streakMilestones', label: '連續訂閱里程碑', type: 'array', fields: [
          { name: 'months', label: '連續月數', type: 'number', required: true },
          { name: 'reward', label: '獎勵描述', type: 'text', required: true },
          { name: 'creditAmount', label: '獎勵購物金', type: 'number', defaultValue: 0 },
        ]},
      ],
    },

    // ── 權益列表（前台顯示用） ──
    {
      name: 'featureList',
      label: '權益列表',
      type: 'array',
      admin: { description: '前台方案卡片顯示的權益項目' },
      fields: [
        { name: 'icon', label: '圖示', type: 'text', admin: { description: '例如：🎁、✨、🚚' } },
        { name: 'text', label: '權益描述', type: 'text', required: true },
        { name: 'highlight', label: '高亮顯示', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
