import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 會員等級 Collection
 * ──────────────────────────────────────────────
 * 6 層等級系統（前台稱號與後台分級碼完全分離）
 *
 * 後台分級碼（slug / tier_code）：
 *   ordinary → bronze → silver → gold → platinum → diamond
 *
 * 前台稱號（frontName）：
 *   T0 優雅初遇者 → T1 曦漾仙子 → T2 優漾女神
 *   T3 金曦女王  → T4 星耀皇后 → T5 璀璨天后
 *
 * ⚠️ 前台介面、LINE、EDM、通知一律只顯示 frontName
 *    絕對不可出現 bronze / silver / gold 等金屬分級名稱
 */
export const MembershipTiers: CollectionConfig = {
  slug: 'membership-tiers',
  admin: {
    useAsTitle: 'frontName',
    defaultColumns: ['frontName', 'slug', 'level', 'minSpent', 'annualSpentThreshold', 'discountPercent', 'pointsMultiplier'],
    group: '③ 會員與 CRM',
    description: '會員等級規則設定（6 層：T0 優雅初遇者 → T5 璀璨天后）前台稱號與後台分級碼完全分離',
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    // SSR consumer (since Phase 5.5 Batch A — commit 499672e):
    //   /membership-benefits renders all tiers via getPayload().find('membership-tiers')
    // Any tier change invalidates that page's full-route cache.
    afterChange: [() => safeRevalidate(['/membership-benefits'], ['membership-tiers'])],
    afterDelete: [() => safeRevalidate(['/membership-benefits'], ['membership-tiers'])],
  },
  fields: [
    // ── 核心分級識別 ──
    {
      name: 'name',
      label: '後台管理名稱',
      type: 'text',
      required: true,
      admin: { description: '後台管理用名稱（如：普通會員、銅牌會員）僅後台人員可見' },
    },
    {
      name: 'slug',
      label: '後台分級碼（tier_code）',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'ordinary / bronze / silver / gold / platinum / diamond — 資料庫與 API 使用' },
    },
    {
      name: 'frontName',
      label: '前台稱號（女性 / 預設）',
      type: 'text',
      required: true,
      admin: { description: '⚠️ 女性會員或未填性別會員看到的稱號：優雅初遇者 / 曦漾仙子 / 優漾女神 / 金曦女王 / 星耀皇后 / 璀璨天后' },
    },
    {
      name: 'frontNameMale',
      label: '前台稱號（男性版本）',
      type: 'text',
      admin: { description: '男性會員看到的稱號。留空則 fallback 至 frontName。建議：翩翩紳士 / 溫雅學者 / 雋永騎士 / 金曜貴公子 / 星耀侯爵 / 璀璨國王（依 level 0-5 對應）' },
    },
    {
      name: 'frontSubtitle',
      label: '前台副標題',
      type: 'text',
      admin: { description: '顯示於會員中心稱號下方，例如「歡迎加入 CHIC KIM & MIU 大家庭」' },
    },
    {
      name: 'tagline',
      label: '等級標語',
      type: 'text',
      admin: { description: '顯示於 /membership-benefits 等級卡片頂部的短句，例如「初次綻放的優雅」' },
    },
    {
      name: 'benefitsDescription',
      label: '等級介紹文案',
      type: 'textarea',
      admin: { description: '該等級的故事性介紹（2-4 句），顯示於 /membership-benefits 卡片與 /account 當前等級區。可留空使用 frontSubtitle 作 fallback。' },
    },
    {
      name: 'level',
      label: '等級排序',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
      admin: { description: '0 = T0（優雅初遇者），5 = T5（璀璨天后）' },
    },
    // ── 升級門檻 ──
    {
      name: 'minSpent',
      label: '升級門檻 — 累計消費（Lifetime）',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      admin: { description: '歷史累計消費達此金額即升級（新台幣）' },
    },
    {
      name: 'annualSpentThreshold',
      label: '年度消費維持門檻（Annual）',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: { description: '每年須消費此金額方可維持等級，0 = 不需年消費門檻' },
    },
    {
      name: 'nextTierSlug',
      label: '下一等級代碼',
      type: 'text',
      admin: { description: '自動升級時查找的下一等級 slug，diamond 等級留空' },
    },
    {
      name: 'nextTierFrontName',
      label: '下一等級前台稱號',
      type: 'text',
      admin: { description: '用於升級差額提醒：「距離成為『曦漾仙子』只差 NT$XXX」' },
    },
    {
      name: 'upgradeGiftPoints',
      label: '升級贈點',
      type: 'number',
      defaultValue: 0,
      admin: { description: '升級到此等級時額外贈送的點數' },
    },
    {
      name: 'upgradeGiftDescription',
      label: '升級禮物說明',
      type: 'textarea',
      admin: { description: '升級通知中顯示的禮物說明' },
    },
    {
      name: 'discountPercent',
      label: '會員折扣（%）',
      type: 'number',
      required: true,
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: { description: '該等級的購物折扣百分比，例如 5 代表打 95 折' },
    },
    {
      name: 'pointsMultiplier',
      label: '點數倍率',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
      admin: { description: '消費獲得點數的倍率，例如 2 代表雙倍點數' },
    },
    {
      name: 'freeShippingThreshold',
      label: '免運門檻（新台幣）',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      admin: { description: '訂單滿此金額即免運費，0 代表無條件免運' },
    },
    {
      name: 'lotteryChances',
      label: '每月抽獎次數',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'birthdayGift',
      label: '生日禮說明',
      type: 'textarea',
      admin: { description: '該等級會員的生日禮內容說明' },
    },
    {
      name: 'exclusiveCouponEnabled',
      label: '啟用專屬優惠券',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'exclusiveCouponDiscount',
      label: '專屬優惠券折扣（%）',
      type: 'number',
      min: 0,
      max: 100,
      admin: {
        condition: (data) => Boolean(data?.exclusiveCouponEnabled),
        description: '僅在「啟用專屬優惠券」時顯示',
      },
    },
    {
      name: 'color',
      label: '等級代表色',
      type: 'text',
      admin: { description: 'CSS 顏色值，例如 #CD7F32（銅）、#C0C0C0（銀）、#FFD700（金）' },
    },
    {
      name: 'icon',
      label: '等級圖示',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
