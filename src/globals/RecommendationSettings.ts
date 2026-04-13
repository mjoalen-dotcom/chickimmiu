import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * AI 推薦引擎設定 Global
 * ───────────────────────
 * 控制各購物階段推薦策略、權重、顯示數量
 * 含 Upsell / Cross-sell / 加購優惠規則
 */
export const RecommendationSettings: GlobalConfig = {
  slug: 'recommendation-settings',
  label: 'AI 推薦引擎設定',
  admin: {
    group: '行銷工具',
    description: '智能加購、交叉銷售、各頁面推薦權重',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ── AI 推薦權重 ──
    {
      name: 'weights',
      label: '推薦演算法權重',
      type: 'group',
      admin: { description: '各因子權重（總和建議為 100%）' },
      fields: [
        { name: 'bodyMatch', label: '身形匹配度（%）', type: 'number', defaultValue: 35 },
        { name: 'purchaseHistory', label: '購買/瀏覽紀錄（%）', type: 'number', defaultValue: 25 },
        { name: 'memberTier', label: '會員等級與訂閱（%）', type: 'number', defaultValue: 15 },
        { name: 'stockAndHot', label: '庫存即時 + 熱銷度（%）', type: 'number', defaultValue: 10 },
        { name: 'ugcInteraction', label: 'UGC 互動（%）', type: 'number', defaultValue: 10 },
        { name: 'seasonTrend', label: '當季趨勢（%）', type: 'number', defaultValue: 5 },
      ],
    },

    // ── 各階段推薦設定 ──
    {
      name: 'stages',
      label: '各階段推薦設定',
      type: 'group',
      fields: [
        // 商品頁
        {
          name: 'productPage',
          label: '商品頁',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            { name: 'crossSellCount', label: '完美搭配數量', type: 'number', defaultValue: 4 },
            { name: 'upsellCount', label: '升級版推薦數量', type: 'number', defaultValue: 2 },
            { name: 'showUpgradeDiff', label: '顯示「多付 X 元即可升級」', type: 'checkbox', defaultValue: true },
          ],
        },
        // 購物車
        {
          name: 'cartPage',
          label: '購物車頁',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            { name: 'bundleCount', label: '組合加購數量', type: 'number', defaultValue: 4 },
            { name: 'addonCount', label: '小額加購數量', type: 'number', defaultValue: 3 },
            { name: 'addonMaxPrice', label: '小額加購最高價格', type: 'number', defaultValue: 500, admin: { description: '低於此價格的商品可當加購品' } },
            { name: 'showBundleDiscount', label: '顯示組合優惠', type: 'checkbox', defaultValue: true },
          ],
        },
        // 結帳頁
        {
          name: 'checkoutPage',
          label: '結帳頁',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            { name: 'lastChanceCount', label: '最後加購數量', type: 'number', defaultValue: 3 },
            { name: 'maxPricePercent', label: '最高佔訂單比例（%）', type: 'number', defaultValue: 30, admin: { description: '推薦商品價格不超過訂單金額的此百分比' } },
          ],
        },
        // 感謝頁
        {
          name: 'thankYouPage',
          label: '感謝頁',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            { name: 'nextPurchaseCount', label: '後續推薦數量', type: 'number', defaultValue: 4 },
            { name: 'showSpecialOffer', label: '顯示限時回購優惠', type: 'checkbox', defaultValue: true },
            { name: 'offerDiscountPercent', label: '回購折扣（%）', type: 'number', defaultValue: 10 },
            { name: 'offerExpiryHours', label: '限時優惠有效時數', type: 'number', defaultValue: 48 },
          ],
        },
        // 離開意圖彈窗
        {
          name: 'exitIntent',
          label: '離開意圖挽留',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            { name: 'triggerAfterSeconds', label: '最少停留秒數', type: 'number', defaultValue: 10, admin: { description: '至少停留此秒數才觸發' } },
            { name: 'showOnlyOnce', label: '每次訪問只顯示一次', type: 'checkbox', defaultValue: true },
            { name: 'recommendCount', label: '推薦數量', type: 'number', defaultValue: 3 },
            { name: 'discountPercent', label: '挽留折扣（%）', type: 'number', defaultValue: 5 },
          ],
        },
        // Email
        {
          name: 'email',
          label: 'Email 推薦',
          type: 'group',
          fields: [
            { name: 'enabled', label: '啟用', type: 'checkbox', defaultValue: true },
            { name: 'abandonCartHours', label: '棄購提醒等候時數', type: 'number', defaultValue: 2 },
            { name: 'recommendCount', label: '推薦商品數量', type: 'number', defaultValue: 4 },
          ],
        },
      ],
    },

    // ── Upsell 規則 ──
    {
      name: 'upsellRules',
      label: 'Upsell 升級推薦規則',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用 Upsell', type: 'checkbox', defaultValue: true },
        { name: 'minPriceDiffPercent', label: '最低價差比例（%）', type: 'number', defaultValue: 10, admin: { description: '推薦商品至少比當前商品貴此百分比' } },
        { name: 'maxPriceDiffPercent', label: '最高價差比例（%）', type: 'number', defaultValue: 80, admin: { description: '推薦商品不超過當前商品貴此百分比' } },
        { name: 'subscriberExtraDiscount', label: '訂閱會員加購折扣（%）', type: 'number', defaultValue: 5, admin: { description: '訂閱會員 upsell 商品額外折扣' } },
      ],
    },

    // ── Cross-sell 規則 ──
    {
      name: 'crossSellRules',
      label: 'Cross-sell 交叉銷售規則',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用 Cross-sell', type: 'checkbox', defaultValue: true },
        { name: 'bundleDiscountEnabled', label: '啟用組合優惠', type: 'checkbox', defaultValue: true },
        { name: 'bundleDiscountType', label: '組合折扣類型', type: 'select', dbName: 'rec_bundle_disc_type', defaultValue: 'third_item_off', options: [
          { label: '第三件折扣', value: 'third_item_off' },
          { label: '滿額折', value: 'threshold_off' },
          { label: '搭配贈品', value: 'gift_with_purchase' },
        ]},
        { name: 'thirdItemDiscountPercent', label: '第三件折扣（%）', type: 'number', defaultValue: 30 },
        { name: 'thresholdAmount', label: '滿額門檻', type: 'number', defaultValue: 5000 },
        { name: 'thresholdDiscount', label: '滿額折扣金額', type: 'number', defaultValue: 500 },
      ],
    },

    // ── 轉換追蹤 ──
    {
      name: 'tracking',
      label: '轉換追蹤',
      type: 'group',
      admin: { description: '追蹤每個推薦位置的點擊率與轉換率' },
      fields: [
        { name: 'enableClickTracking', label: '記錄推薦點擊', type: 'checkbox', defaultValue: true },
        { name: 'enableConversionTracking', label: '記錄推薦轉換', type: 'checkbox', defaultValue: true },
        { name: 'enableABTesting', label: '啟用 A/B 測試', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
