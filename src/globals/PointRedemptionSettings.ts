import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 點數消耗心理學設定 Global
 * ────────────────────────────
 * 控制：點數到期通知、限時加倍、稀缺標籤、抽獎機率
 * 所有心理學參數皆可從後台即時調整
 */
export const PointRedemptionSettings: GlobalConfig = {
  slug: 'point-redemption-settings',
  label: '點數消耗設定',
  admin: {
    description: '點數到期提醒、限時活動、消耗心理學參數',
    group: '會員管理',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    // SSR consumer (since Phase 5.5 Batch B — commit b59ad6d):
    //   /account/points reads via getPayload().findGlobal({ slug: 'point-redemption-settings' })
    //   for scarcity / limited-time / expiry-reminder display params.
    afterChange: [() => safeRevalidate(['/account/points'], ['point-redemption-settings'])],
  },
  fields: [
    // ── 到期提醒（損失規避） ──
    {
      name: 'expiryNotification',
      label: '到期提醒設定',
      type: 'group',
      admin: { description: '損失規避心理：讓會員感受「即將失去」的緊迫感' },
      fields: [
        { name: 'enabled', label: '啟用到期提醒', type: 'checkbox', defaultValue: true },
        { name: 'reminderDays', label: '提醒天數', type: 'array', admin: { description: '到期前幾天發送提醒' }, fields: [
          { name: 'days', label: '天數', type: 'number', required: true },
          { name: 'emailTemplate', label: '信件主旨', type: 'text' },
          { name: 'urgencyLevel', label: '緊迫度', type: 'select', dbName: 'pts_remind_urgency', options: [
            { label: '一般提醒', value: 'normal' },
            { label: '急迫提醒', value: 'urgent' },
            { label: '最後機會', value: 'critical' },
          ]},
        ]},
        { name: 'showCountdown', label: '商城顯示倒數計時', type: 'checkbox', defaultValue: true, admin: { description: '在點數商城顯示「您的 XX 點將於 X 天後到期」' } },
      ],
    },

    // ── 稀缺性效應 ──
    {
      name: 'scarcity',
      label: '稀缺性設定',
      type: 'group',
      admin: { description: '限量標籤、搶購倒數，刺激立即行動' },
      fields: [
        { name: 'showRemainingStock', label: '顯示剩餘數量', type: 'checkbox', defaultValue: true },
        { name: 'lowStockThreshold', label: '低庫存標籤門檻', type: 'number', defaultValue: 10, admin: { description: '庫存低於此數字時顯示「即將售完」' } },
        { name: 'showRedemptionCount', label: '顯示已兌換人數', type: 'checkbox', defaultValue: true, admin: { description: '社會認同：「已有 128 人兌換」' } },
        { name: 'hotBadgeThreshold', label: '熱門標籤門檻', type: 'number', defaultValue: 50, admin: { description: '兌換數超過此值顯示🔥熱門' } },
      ],
    },

    // ── 進度感 ──
    {
      name: 'progressDisplay',
      label: '進度感設定',
      type: 'group',
      admin: { description: '「還差 XX 點即可兌換」— 推動會員持續消費' },
      fields: [
        { name: 'showProgressBar', label: '顯示進度條', type: 'checkbox', defaultValue: true },
        { name: 'showNearbyGoals', label: '顯示接近可兌換的獎品', type: 'checkbox', defaultValue: true, admin: { description: '首頁/會員中心提示「再消費 NT$200 即可兌換 XX」' } },
        { name: 'nearbyThresholdPercent', label: '接近門檻（%）', type: 'number', defaultValue: 80, admin: { description: '已達到此百分比的獎品會被標示「快達標了！」' } },
      ],
    },

    // ── 即時滿足 + 不確定性 ──
    {
      name: 'instantGratification',
      label: '即時滿足設定',
      type: 'group',
      admin: { description: '抽獎、神秘禮物等不確定性獎勵' },
      fields: [
        { name: 'enableMysteryGift', label: '啟用神秘禮物', type: 'checkbox', defaultValue: true },
        { name: 'mysteryGiftCost', label: '神秘禮物點數', type: 'number', defaultValue: 100 },
        { name: 'mysteryGiftDescription', label: '神秘禮物說明', type: 'text', defaultValue: '隨機獲得驚喜好禮！價值最高 NT$500' },
        { name: 'enableLottery', label: '啟用幸運轉盤', type: 'checkbox', defaultValue: true },
        { name: 'lotteryCost', label: '轉盤一次點數', type: 'number', defaultValue: 50 },
        { name: 'consolationPrizePoints', label: '安慰獎點數', type: 'number', defaultValue: 10, admin: { description: '沒中獎時回饋的點數（讓會員不會空手而歸）' } },
      ],
    },

    // ── 限時加倍活動 ──
    {
      name: 'boostEvents',
      label: '限時加倍活動',
      type: 'array',
      admin: { description: '限時雙倍/三倍點數活動（FOMO 效應）' },
      fields: [
        { name: 'name', label: '活動名稱', type: 'text', required: true },
        { name: 'multiplier', label: '倍率', type: 'number', required: true, defaultValue: 2, min: 1, max: 10, admin: { description: '消費點數 × 此倍率' } },
        { name: 'startDate', label: '開始時間', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endDate', label: '結束時間', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'description', label: '活動說明', type: 'text' },
        { name: 'targetItems', label: '適用兌換品', type: 'relationship', relationTo: 'points-redemptions', hasMany: true, admin: { description: '留空 = 全部適用' } },
        { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },
      ],
    },

    // ── 消耗管道設定 ──
    {
      name: 'channels',
      label: '消耗管道',
      type: 'group',
      admin: { description: '啟用/停用各點數消耗管道' },
      fields: [
        { name: 'directDiscount', label: '結帳直接折抵', type: 'checkbox', defaultValue: true },
        { name: 'freeShippingCoupon', label: '兌換免運券', type: 'checkbox', defaultValue: true },
        { name: 'movieTicketLottery', label: '電影票抽獎', type: 'checkbox', defaultValue: true },
        { name: 'mysteryGift', label: '神秘禮物', type: 'checkbox', defaultValue: true },
        { name: 'vipStylingConsult', label: 'VIP 造型諮詢', type: 'checkbox', defaultValue: true },
        { name: 'charityDonation', label: '公益捐贈', type: 'checkbox', defaultValue: true },
        { name: 'charityPointsPerUnit', label: '公益捐贈每筆點數', type: 'number', defaultValue: 100 },
        { name: 'charityDescription', label: '公益捐贈說明', type: 'text', defaultValue: '每 100 點 = NT$10 捐贈給台灣兒童福利基金會' },
      ],
    },

    // ── 訂閱會員加成 ──
    {
      name: 'subscriberBoost',
      label: '訂閱會員加成',
      type: 'group',
      admin: { description: '訂閱會員兌換時的額外優惠' },
      fields: [
        { name: 'discountPercent', label: '點數折扣（%）', type: 'number', defaultValue: 10, admin: { description: '訂閱會員兌換時少付 10% 點數' } },
        { name: 'exclusiveItems', label: '專屬兌換品', type: 'checkbox', defaultValue: true, admin: { description: '是否有訂閱會員專屬兌換品' } },
        { name: 'priorityAccess', label: '搶先兌換', type: 'checkbox', defaultValue: true, admin: { description: '限量品訂閱會員可提前 24 小時兌換' } },
      ],
    },

    // ── UGC 見證設定 ──
    {
      name: 'ugcTestimonials',
      label: 'UGC 見證',
      type: 'group',
      admin: { description: '在點數商城展示兌換見證，提升信任感' },
      fields: [
        { name: 'enabled', label: '顯示兌換見證', type: 'checkbox', defaultValue: true },
        { name: 'maxDisplay', label: '最多顯示數量', type: 'number', defaultValue: 6 },
        {
          name: 'items',
          label: '見證項目',
          type: 'array',
          maxRows: 20,
          admin: { description: '兌換見證清單。前台依 maxDisplay 決定顯示幾則；留空時前台顯示預設範例。' },
          fields: [
            { name: 'name', label: '暱稱', type: 'text', required: true, admin: { description: '遮罩後名字（如「小**」）' } },
            { name: 'text', label: '見證文字', type: 'text', required: true },
            { name: 'avatar', label: '頭像 emoji', type: 'text', defaultValue: '🎁' },
            { name: 'tier', label: '會員等級', type: 'text', admin: { description: '顯示用等級標籤' } },
          ],
        },
      ],
    },
  ],
}
