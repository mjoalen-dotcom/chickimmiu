import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 忠誠度計畫設定 Global
 * ──────────────────────
 * 點數倍率、生日禮、評價獎勵、小遊戲、點數有效期限、兌換比例
 * 所有數字皆可從後台調整
 */
export const LoyaltySettings: GlobalConfig = {
  slug: 'loyalty-settings',
  label: '忠誠度計畫設定',
  admin: {
    group: '會員與 CRM',
    description: '會員點數計算、各等級權益、兌換規則、遊戲次數完整設定',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    // SSR consumer (since Phase 5.5 Batch B — commit b59ad6d):
    //   /account/points reads via getPayload().findGlobal({ slug: 'loyalty-settings' })
    //   for multiplier / free-shipping / birthday-bonus display.
    afterChange: [() => safeRevalidate(['/account/points'], ['loyalty-settings'])],
  },
  fields: [
    // ── 基本點數設定 ──
    {
      name: 'pointsConfig',
      label: '點數基本設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用點數系統', type: 'checkbox', defaultValue: true },
        { name: 'pointsPerDollar', label: '每消費 NT$1 獲得點數', type: 'number', defaultValue: 1, admin: { description: '基礎倍率，例如消費 NT$100 獲得 100 點' } },
        { name: 'pointsToCurrencyRate', label: '點數兌換比例', type: 'number', defaultValue: 100, admin: { description: '多少點可兌換 NT$1，例如 100 點 = NT$1' } },
        { name: 'pointsExpiryDays', label: '點數有效期限（天）', type: 'number', defaultValue: 365, admin: { description: '0 = 永不過期' } },
        { name: 'minRedeemPoints', label: '最低兌換點數', type: 'number', defaultValue: 100 },
        { name: 'maxRedeemPercentage', label: '單筆訂單最高點數折抵比例（%）', type: 'number', defaultValue: 30, admin: { description: '例如 30% 表示 NT$1000 訂單最多折 NT$300' } },
      ],
    },

    // ── 各等級點數倍率 ──
    {
      name: 'tierMultipliers',
      label: '等級點數倍率',
      type: 'group',
      admin: { description: '各會員等級的點數倍率，基礎值為 1.0x' },
      fields: [
        { name: 'bronzeMultiplier', label: '銅牌 (曦漾仙子 T1)', type: 'number', defaultValue: 1.0 },
        { name: 'silverMultiplier', label: '銀牌 (優漾女神 T2)', type: 'number', defaultValue: 1.2 },
        { name: 'goldMultiplier', label: '金牌 (金曦女王 T3)', type: 'number', defaultValue: 1.5 },
        { name: 'platinumMultiplier', label: '白金 (星耀皇后 T4)', type: 'number', defaultValue: 2.0 },
        { name: 'diamondMultiplier', label: '鑽石 (璀璨天后 T5)', type: 'number', defaultValue: 2.5 },
      ],
    },

    // ── 各等級每月贈送 ──
    {
      name: 'monthlyBonus',
      label: '每月等級贈送',
      type: 'group',
      fields: [
        { name: 'bronzeMonthlyPoints', label: '銅牌 (曦漾仙子 T1) 每月贈送點數', type: 'number', defaultValue: 0 },
        { name: 'silverMonthlyPoints', label: '銀牌 (優漾女神 T2) 每月贈送點數', type: 'number', defaultValue: 50 },
        { name: 'goldMonthlyPoints', label: '金牌 (金曦女王 T3) 每月贈送點數', type: 'number', defaultValue: 100 },
        { name: 'platinumMonthlyPoints', label: '白金 (星耀皇后 T4) 每月贈送點數', type: 'number', defaultValue: 200 },
        { name: 'diamondMonthlyPoints', label: '鑽石 (璀璨天后 T5) 每月贈送點數', type: 'number', defaultValue: 500 },
      ],
    },

    // ── 生日禮 ──
    {
      name: 'birthdayReward',
      label: '生日禮設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用生日禮', type: 'checkbox', defaultValue: true },
        { name: 'birthdayPoints', label: '生日贈送點數', type: 'number', defaultValue: 200 },
        { name: 'birthdayCreditAmount', label: '生日贈送購物金', type: 'number', defaultValue: 100, admin: { description: 'NT$' } },
        { name: 'birthdayDiscountPercent', label: '生日月折扣（%）', type: 'number', defaultValue: 10 },
        { name: 'birthdayMultiplier', label: '生日月點數加倍倍率', type: 'number', defaultValue: 3.0 },
      ],
    },

    // ── 評價獎勵 ──
    {
      name: 'reviewReward',
      label: '評價獎勵',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用評價獎勵', type: 'checkbox', defaultValue: true },
        { name: 'textReviewPoints', label: '文字評價獎勵點數', type: 'number', defaultValue: 20 },
        { name: 'photoReviewPoints', label: '附圖評價獎勵點數', type: 'number', defaultValue: 50 },
        { name: 'firstReviewBonus', label: '首次評價額外加碼點數', type: 'number', defaultValue: 30 },
      ],
    },

    // ── 推薦獎勵（簡化版，完整設定在 ReferralSettings） ──
    {
      name: 'referralPoints',
      label: '推薦相關點數',
      type: 'group',
      admin: { description: '推薦獎勵詳細設定請至「推薦計畫設定」，此處僅為點數加成' },
      fields: [
        { name: 'referralBonusPoints', label: '推薦成功額外點數', type: 'number', defaultValue: 100 },
        { name: 'refereeWelcomePoints', label: '被推薦人歡迎點數', type: 'number', defaultValue: 50 },
      ],
    },

    // ── 小遊戲 / 互動獎勵 ──
    {
      name: 'gameConfig',
      label: '小遊戲設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用好運遊戲', type: 'checkbox', defaultValue: true },
        { name: 'bronzeDailyPlays', label: '銅牌 (曦漾仙子 T1) 每日遊戲次數', type: 'number', defaultValue: 1 },
        { name: 'silverDailyPlays', label: '銀牌 (優漾女神 T2) 每日遊戲次數', type: 'number', defaultValue: 2 },
        { name: 'goldDailyPlays', label: '金牌 (金曦女王 T3) 每日遊戲次數', type: 'number', defaultValue: 3 },
        { name: 'platinumDailyPlays', label: '白金 (星耀皇后 T4) 每日遊戲次數', type: 'number', defaultValue: 5 },
        { name: 'diamondDailyPlays', label: '鑽石 (璀璨天后 T5) 每日遊戲次數', type: 'number', defaultValue: 10 },
        { name: 'subscriberExtraPlays', label: '訂閱會員額外遊戲次數', type: 'number', defaultValue: 3 },
        { name: 'dailyLoginPoints', label: '每日登入獎勵點數', type: 'number', defaultValue: 5 },
        { name: 'consecutiveLoginBonus', label: '連續登入7天額外點數', type: 'number', defaultValue: 50 },
      ],
    },

    // ── AI 推薦引擎設定 ──
    {
      name: 'recommendationConfig',
      label: 'AI 推薦引擎設定',
      type: 'group',
      admin: { description: '控制各頁面推薦邏輯權重、來源與顯示數量' },
      fields: [
        { name: 'enabled', label: '啟用 AI 推薦', type: 'checkbox', defaultValue: true },
        {
          name: 'fitScoreWeights',
          label: 'Fit Score 權重',
          type: 'group',
          admin: { description: '尺寸推薦公式權重（總和應為 100）' },
          fields: [
            { name: 'heightWeight', label: '身高權重（%）', type: 'number', defaultValue: 40 },
            { name: 'bodyWeight', label: '體重權重（%）', type: 'number', defaultValue: 30 },
            { name: 'shapeWeight', label: '身形權重（%）', type: 'number', defaultValue: 20 },
            { name: 'historyWeight', label: '歷史偏好權重（%）', type: 'number', defaultValue: 10 },
          ],
        },
        {
          name: 'placements',
          label: '各位置推薦設定',
          type: 'array',
          admin: { description: '設定每個展示位置的推薦邏輯' },
          fields: [
            { name: 'location', label: '展示位置', type: 'select', dbName: 'loy_place_location', required: true, options: [
              { label: '首頁', value: 'homepage' },
              { label: '商品頁', value: 'product_page' },
              { label: '購物車', value: 'cart' },
              { label: '結帳頁', value: 'checkout' },
              { label: '感謝頁', value: 'thank_you' },
              { label: '彈出視窗', value: 'popup' },
              { label: 'Email', value: 'email' },
            ]},
            { name: 'strategy', label: '推薦策略', type: 'select', dbName: 'loy_place_strategy', defaultValue: 'hybrid', options: [
              { label: '也買了 (Collaborative)', value: 'also_bought' },
              { label: '相似商品 (Content-based)', value: 'similar' },
              { label: '熱銷', value: 'trending' },
              { label: '個人化', value: 'personalized' },
              { label: '混合', value: 'hybrid' },
            ]},
            { name: 'maxItems', label: '最大顯示數量', type: 'number', defaultValue: 4, min: 1, max: 20 },
            { name: 'excludeOutOfStock', label: '排除無庫存商品', type: 'checkbox', defaultValue: true },
          ],
        },
      ],
    },

    // ── 自動觸發設定 ──
    {
      name: 'autoTriggers',
      label: '自動觸發設定',
      type: 'group',
      admin: { description: '點數在何時自動計算與發放' },
      fields: [
        { name: 'awardOnOrderDelivered', label: '訂單送達後自動發放點數', type: 'checkbox', defaultValue: true, admin: { description: '訂單狀態變更為「已送達」時發放' } },
        { name: 'awardOnReviewApproved', label: '評價審核通過後自動發放點數', type: 'checkbox', defaultValue: true },
        { name: 'awardOnReferralPurchase', label: '推薦人首消後自動發放點數', type: 'checkbox', defaultValue: true },
        { name: 'deductOnRefund', label: '退款時自動扣回點數', type: 'checkbox', defaultValue: true },
        { name: 'monthlyBonusDay', label: '每月贈送點數發放日', type: 'number', defaultValue: 1, admin: { description: '每月幾號發放等級月贈點數' } },
      ],
    },
  ],
}
