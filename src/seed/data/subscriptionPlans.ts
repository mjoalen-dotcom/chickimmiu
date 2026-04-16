/**
 * 訂閱方案 Seed Data — 3 階漏斗 (Spark / VIP / Diamond)
 * ──────────────────────────────────────────
 * 對應 schema: src/collections/SubscriptionPlans.ts
 *
 * 行銷策略：
 *   - 訂閱方案 ≠ 會員等級（membership-tiers 是累積消費永久升級）
 *   - 訂閱方案定位為「月/年付短期租用更高等級權益」
 *   - 必須超越同級 tier benefits（+ monthlyCredit、mysteryGift、stylingConsult 等）
 *   - 3 階價格錨點：299 → 699 → 1499 (倍率 2.3x / 2.1x 平滑階梯)
 *   - 年繳均 83 折 (= 2 個月免費)，主推 VIP 方案 (isFeatured)
 *
 * featureList 行銷文案必須和 benefits/dopamine 欄位語意一致——
 * 前台只讀 featureList 渲染，benefits/dopamine 目前是 admin 備查 + 未來自動化邏輯用。
 */

export type SubscriptionPlanSeed = {
  slug: string
  name: string
  description: string
  badge: string
  badgeColor: string
  sortOrder: number
  isActive: boolean
  isFeatured: boolean
  pricing: {
    monthlyPrice: number
    yearlyPrice?: number
    trialDays: number
  }
  benefits: {
    discountPercent: number
    pointsMultiplier: number
    freeShippingThreshold?: number
    monthlyCredit: number
    birthdayBonusMultiplier: number
    exclusiveCouponCount: number
  }
  dopamine: {
    dailyLoginBonus: number
    consecutiveMonthBonus: number
    mysteryGiftEnabled: boolean
    earlyAccessHours: number
    exclusiveLotterySpins: number
    streakMilestones: { months: number; reward: string; creditAmount: number }[]
  }
  featureList: { icon: string; text: string; highlight: boolean }[]
}

export const subscriptionPlans: SubscriptionPlanSeed[] = [
  // ── Plan 1 — Spark (入門) ──
  {
    slug: 'spark',
    name: '閃耀輕奢',
    description:
      '初嘗訂閱會員尊榮感，立刻享銀級以上購物優惠，加碼每月購物金回饋——給剛開始打造自己風格的妳，最溫柔的起點。',
    badge: '🌸 Spark',
    badgeColor: '#D4A5C0',
    sortOrder: 1,
    isActive: true,
    isFeatured: false,
    pricing: {
      monthlyPrice: 299,
      yearlyPrice: 2990,
      trialDays: 7,
    },
    benefits: {
      discountPercent: 5,
      pointsMultiplier: 1.5,
      freeShippingThreshold: 1000,
      monthlyCredit: 100,
      birthdayBonusMultiplier: 1.5,
      exclusiveCouponCount: 1,
    },
    dopamine: {
      dailyLoginBonus: 5,
      consecutiveMonthBonus: 100,
      mysteryGiftEnabled: false,
      earlyAccessHours: 6,
      exclusiveLotterySpins: 1,
      streakMilestones: [
        { months: 3, reward: '🎁 贈 NT$ 100 購物金', creditAmount: 100 },
        { months: 6, reward: '🌟 限定胸針徽章（非賣品）', creditAmount: 0 },
        { months: 9, reward: '🎀 贈 NT$ 200 購物金', creditAmount: 200 },
        { months: 12, reward: '👑 升級 VIP 免費一個月（價值 NT$ 699）', creditAmount: 0 },
      ],
    },
    featureList: [
      { icon: '🛍️', text: '全站 95 折優惠', highlight: false },
      { icon: '💎', text: '點數 1.5 倍獲取', highlight: true },
      { icon: '🚚', text: 'NT$ 1,000 起享免運', highlight: false },
      { icon: '💰', text: '每月送 NT$ 100 購物金', highlight: true },
      { icon: '🎟️', text: '每月獨家 8 折券 x 1', highlight: false },
      { icon: '🎂', text: '生日月 1.5 倍購物金', highlight: false },
      { icon: '⏰', text: '新品提前 6 小時搶先購', highlight: false },
      { icon: '🎰', text: '每月 1 次抽獎資格', highlight: false },
      { icon: '📈', text: '連續訂閱享里程碑獎勵', highlight: false },
    ],
  },

  // ── Plan 2 — VIP (主推) ──
  {
    slug: 'vip',
    name: '尊寵 VIP',
    description:
      '最受歡迎的主力方案——立享金級折扣、全站免運、每月驚喜禮盒，是時尚女性最聰明的日常投資。',
    badge: '✨ VIP',
    badgeColor: '#C19A5B',
    sortOrder: 2,
    isActive: true,
    isFeatured: true,
    pricing: {
      monthlyPrice: 699,
      yearlyPrice: 6999,
      trialDays: 14,
    },
    benefits: {
      discountPercent: 10,
      pointsMultiplier: 2,
      freeShippingThreshold: 0,
      monthlyCredit: 300,
      birthdayBonusMultiplier: 2,
      exclusiveCouponCount: 2,
    },
    dopamine: {
      dailyLoginBonus: 10,
      consecutiveMonthBonus: 300,
      mysteryGiftEnabled: true,
      earlyAccessHours: 24,
      exclusiveLotterySpins: 3,
      streakMilestones: [
        { months: 3, reward: '🎁 贈 NT$ 300 購物金', creditAmount: 300 },
        { months: 6, reward: '💎 限定金色徽章 + 尊榮版邀請函', creditAmount: 0 },
        { months: 9, reward: '🌹 贈 NT$ 500 購物金 + VIP 造型小物', creditAmount: 500 },
        { months: 12, reward: '👑 年度大禮盒（價值 NT$ 2,000）', creditAmount: 0 },
      ],
    },
    featureList: [
      { icon: '🛍️', text: '全站 9 折優惠', highlight: true },
      { icon: '💎', text: '點數 2 倍獲取', highlight: true },
      { icon: '🚚', text: '全站免運費', highlight: true },
      { icon: '💰', text: '每月送 NT$ 300 購物金', highlight: true },
      { icon: '🎟️', text: '每月獨家 85 折券 x 2', highlight: false },
      { icon: '🎂', text: '生日月 2 倍購物金 + 生日禮盒', highlight: false },
      { icon: '🎁', text: '每月驚喜禮盒（隨機好禮）', highlight: true },
      { icon: '⏰', text: '新品提前 24 小時搶先購', highlight: false },
      { icon: '🎰', text: '每月 3 次抽獎資格', highlight: false },
      { icon: '📈', text: '連續訂閱享豐厚里程碑', highlight: false },
    ],
  },

  // ── Plan 3 — Diamond (頂級) ──
  {
    slug: 'diamond',
    name: '鑽石御用',
    description:
      '為追求極致品味的她——全站最高折扣、專屬 1-on-1 穿搭諮詢、未公開新品搶先預覽，每個月都是獨一無二的奢華體驗。',
    badge: '💎 Diamond',
    badgeColor: '#8B7FD8',
    sortOrder: 3,
    isActive: true,
    isFeatured: false,
    pricing: {
      monthlyPrice: 1499,
      yearlyPrice: 14999,
      trialDays: 0,
    },
    benefits: {
      discountPercent: 15,
      pointsMultiplier: 3,
      freeShippingThreshold: 0,
      monthlyCredit: 800,
      birthdayBonusMultiplier: 3,
      exclusiveCouponCount: 5,
    },
    dopamine: {
      dailyLoginBonus: 20,
      consecutiveMonthBonus: 800,
      mysteryGiftEnabled: true,
      earlyAccessHours: 48,
      exclusiveLotterySpins: 10,
      streakMilestones: [
        { months: 3, reward: '🎁 贈 NT$ 800 購物金', creditAmount: 800 },
        { months: 6, reward: '💎 鑽石徽章 + 1-on-1 線上穿搭諮詢', creditAmount: 0 },
        { months: 9, reward: '🌹 贈 NT$ 1,500 購物金 + 限量品牌禮盒', creditAmount: 1500 },
        { months: 12, reward: '👑 年度鑽石珍藏禮（專屬訂製小物，價值 NT$ 5,000）', creditAmount: 0 },
      ],
    },
    featureList: [
      { icon: '🛍️', text: '全站 85 折優惠', highlight: true },
      { icon: '💎', text: '點數 3 倍獲取', highlight: true },
      { icon: '🚚', text: '全站免運 + 每月免費退換 x 1', highlight: true },
      { icon: '💰', text: '每月送 NT$ 800 購物金', highlight: true },
      { icon: '🎟️', text: '每月獨家 8 折券 x 5', highlight: false },
      { icon: '🎂', text: '生日月 3 倍購物金 + 生日禮盒', highlight: false },
      { icon: '🎁', text: '每月驚喜精品禮盒', highlight: true },
      { icon: '⏰', text: '新品提前 48 小時搶先購（含未公開款）', highlight: false },
      { icon: '🎰', text: '每月 10 次抽獎資格', highlight: false },
      { icon: '👗', text: '1-on-1 線上穿搭諮詢', highlight: true },
      { icon: '👑', text: '連續訂閱年度珍藏禮', highlight: false },
    ],
  },
]
