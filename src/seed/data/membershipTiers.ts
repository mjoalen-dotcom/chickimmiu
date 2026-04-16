/**
 * 會員等級 Seed Data — 6 層 T0-T5
 * ──────────────────────────────────────────
 * 對應 schema: src/collections/MembershipTiers.ts
 * 後台分級碼 (slug) 與前台稱號 (frontName) 完全分離
 *
 * ⚠️ 前台介面一律顯示 frontName，不可出現 bronze/silver/gold 等金屬名
 */

export type TierSeed = {
  slug: string
  name: string
  frontName: string
  frontSubtitle: string
  level: number
  minSpent: number
  annualSpentThreshold: number
  nextTierSlug?: string
  nextTierFrontName?: string
  upgradeGiftPoints: number
  upgradeGiftDescription?: string
  discountPercent: number
  pointsMultiplier: number
  freeShippingThreshold: number
  lotteryChances: number
  birthdayGift: string
  exclusiveCouponEnabled: boolean
  exclusiveCouponDiscount?: number
  color: string
}

export const membershipTiers: TierSeed[] = [
  // ── T0 ──
  {
    slug: 'ordinary',
    name: '普通會員',
    frontName: '優雅初遇者',
    frontSubtitle: '歡迎加入 CHIC KIM & MIU 大家庭',
    level: 0,
    minSpent: 0,
    annualSpentThreshold: 0,
    nextTierSlug: 'bronze',
    nextTierFrontName: '曦漾仙子',
    upgradeGiftPoints: 0,
    discountPercent: 0,
    pointsMultiplier: 1,
    freeShippingThreshold: 1500,
    lotteryChances: 0,
    birthdayGift: '生日當月享有購物 5% off 優惠券',
    exclusiveCouponEnabled: false,
    color: '#E5E4E2',
  },
  // ── T1 ──
  {
    slug: 'bronze',
    name: '銅牌會員',
    frontName: '曦漾仙子',
    frontSubtitle: '初次綻放的優雅',
    level: 1,
    minSpent: 5000,
    annualSpentThreshold: 3000,
    nextTierSlug: 'silver',
    nextTierFrontName: '優漾女神',
    upgradeGiftPoints: 100,
    upgradeGiftDescription: '升級銅牌禮：100 點數回饋',
    discountPercent: 3,
    pointsMultiplier: 1,
    freeShippingThreshold: 1200,
    lotteryChances: 1,
    birthdayGift: '生日當月享 8% off + 雙倍點數',
    exclusiveCouponEnabled: false,
    color: '#CD7F32',
  },
  // ── T2 ──
  {
    slug: 'silver',
    name: '銀牌會員',
    frontName: '優漾女神',
    frontSubtitle: '從容自信的姿態',
    level: 2,
    minSpent: 15000,
    annualSpentThreshold: 8000,
    nextTierSlug: 'gold',
    nextTierFrontName: '金曦女王',
    upgradeGiftPoints: 300,
    upgradeGiftDescription: '升級銀牌禮：300 點數 + 免運券 × 1',
    discountPercent: 5,
    pointsMultiplier: 1.2,
    freeShippingThreshold: 1000,
    lotteryChances: 2,
    birthdayGift: '生日當月 10% off + 免運券 × 2',
    exclusiveCouponEnabled: true,
    exclusiveCouponDiscount: 5,
    color: '#C0C0C0',
  },
  // ── T3 ──
  {
    slug: 'gold',
    name: '金牌會員',
    frontName: '金曦女王',
    frontSubtitle: '閃耀動人的風采',
    level: 3,
    minSpent: 40000,
    annualSpentThreshold: 20000,
    nextTierSlug: 'platinum',
    nextTierFrontName: '星耀皇后',
    upgradeGiftPoints: 800,
    upgradeGiftDescription: '升級金牌禮：800 點數 + 品牌限定小禮',
    discountPercent: 8,
    pointsMultiplier: 1.5,
    freeShippingThreshold: 800,
    lotteryChances: 3,
    birthdayGift: '生日當月 12% off + 限定禮盒',
    exclusiveCouponEnabled: true,
    exclusiveCouponDiscount: 8,
    color: '#FFD700',
  },
  // ── T4 ──
  {
    slug: 'platinum',
    name: '白金會員',
    frontName: '星耀皇后',
    frontSubtitle: '卓越超凡的氣質',
    level: 4,
    minSpent: 100000,
    annualSpentThreshold: 50000,
    nextTierSlug: 'diamond',
    nextTierFrontName: '璀璨天后',
    upgradeGiftPoints: 2000,
    upgradeGiftDescription: '升級白金禮：2000 點數 + VIP 專屬配飾禮',
    discountPercent: 12,
    pointsMultiplier: 2,
    freeShippingThreshold: 0,
    lotteryChances: 5,
    birthdayGift: '生日當月 15% off + 專屬配飾禮',
    exclusiveCouponEnabled: true,
    exclusiveCouponDiscount: 12,
    color: '#E5E4E2',
  },
  // ── T5 ──
  {
    slug: 'diamond',
    name: '鑽石會員',
    frontName: '璀璨天后',
    frontSubtitle: '巔峰無可取代',
    level: 5,
    minSpent: 300000,
    annualSpentThreshold: 150000,
    // 頂級 — 無下一等級
    upgradeGiftPoints: 5000,
    upgradeGiftDescription: '升級鑽石禮：5000 點數 + 手作珠寶禮 + 專屬品牌故事手札',
    discountPercent: 15,
    pointsMultiplier: 3,
    freeShippingThreshold: 0,
    lotteryChances: 10,
    birthdayGift: '生日當月 20% off + 手作珠寶禮 + VIP 祝賀花束',
    exclusiveCouponEnabled: true,
    exclusiveCouponDiscount: 15,
    color: '#B9F2FF',
  },
]
