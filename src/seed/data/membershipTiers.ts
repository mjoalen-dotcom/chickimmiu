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
  frontNameMale?: string
  frontSubtitle: string
  tagline?: string
  benefitsDescription?: string
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
    frontNameMale: '翩翩紳士',
    frontSubtitle: '歡迎加入 CHIC KIM & MIU 大家庭',
    tagline: '優雅旅程的起點',
    benefitsDescription: '加入 CHIC KIM & MIU 的第一步，享有點數累積、會員專屬活動與新品搶先看。每一次消費都在為下一個等級鋪路，我們期待與你一起走過每一段優雅時刻。',
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
    frontNameMale: '溫雅學者',
    frontSubtitle: '初次綻放的優雅',
    tagline: '初次綻放的優雅',
    benefitsDescription: '累積消費滿 NT$ 5,000 即成為銅牌會員，享有 3% 購物折扣、每月一次幸運抽獎機會，以及生日月 8% 專屬優惠券。你的優雅旅程，從這裡開始被看見。',
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
    frontNameMale: '雋永騎士',
    frontSubtitle: '從容自信的姿態',
    tagline: '從容自信的姿態',
    benefitsDescription: '銀牌會員享有 5% 折扣、1.2 倍點數回饋、每月兩次抽獎，以及專屬 5% 優惠券。從容自信，來自於你每一次精心的選擇；我們以免運門檻降至 NT$ 1,000 回饋你的信賴。',
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
    frontNameMale: '金曜貴公子',
    frontSubtitle: '閃耀動人的風采',
    tagline: '閃耀動人的風采',
    benefitsDescription: '金牌會員是品牌的閃耀核心：8% 購物折扣、1.5 倍點數、每月三次抽獎、免運門檻 NT$ 800，以及生日月 12% 專屬優惠加上限定禮盒。你的風采，值得被我們用心呈現。',
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
    frontNameMale: '星耀侯爵',
    frontSubtitle: '卓越超凡的氣質',
    tagline: '卓越超凡的氣質',
    benefitsDescription: '白金會員享有 12% 購物折扣、2 倍點數、無條件免運、每月五次抽獎，以及 VIP 專屬配飾禮。卓越超凡的氣質，來自於你對細節的執著；我們以品牌最高規格的禮遇回應你的選擇。',
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
    frontNameMale: '璀璨國王',
    frontSubtitle: '巔峰無可取代',
    tagline: '巔峰無可取代',
    benefitsDescription: '鑽石會員是 CHIC KIM & MIU 金字塔頂端的象徵：15% 折扣、3 倍點數、無條件免運、每月十次抽獎，以及手作珠寶級生日禮與 VIP 祝賀花束。巔峰無可取代，因為你就是品牌故事裡最重要的主角。',
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
