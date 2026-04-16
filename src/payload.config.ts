import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { MembershipTiers } from './collections/MembershipTiers'
import { Products } from './collections/Products'
import { SizeCharts } from './collections/SizeCharts'
import { Orders } from './collections/Orders'
import { Affiliates } from './collections/Affiliates'
import { BlogPosts } from './collections/BlogPosts'
import { Pages } from './collections/Pages'
import { SubscriptionPlans } from './collections/SubscriptionPlans'
import { ProductReviews } from './collections/ProductReviews'
import { Returns } from './collections/Returns'
import { Exchanges } from './collections/Exchanges'
import { Refunds } from './collections/Refunds'
import { ShippingMethods } from './collections/ShippingMethods'
import { UGCPosts } from './collections/UGCPosts'
import { PointsRedemptions } from './collections/PointsRedemptions'
import { MarketingCampaigns } from './collections/MarketingCampaigns'
import { MessageTemplates } from './collections/MessageTemplates'
import { ABTests } from './collections/ABTests'
import { MarketingExecutionLogs } from './collections/MarketingExecutionLogs'
import { FestivalTemplates } from './collections/FestivalTemplates'
import { BirthdayCampaigns } from './collections/BirthdayCampaigns'
import { ConciergeServiceRequests } from './collections/ConciergeServiceRequests'
import { Invoices } from './collections/Invoices'
import { MiniGameRecords } from './collections/MiniGameRecords'
import { CardBattles } from './collections/CardBattles'
import { GameLeaderboard } from './collections/GameLeaderboard'

import { GlobalSettings } from './globals/GlobalSettings'
import { LoyaltySettings } from './globals/LoyaltySettings'
import { ReferralSettings } from './globals/ReferralSettings'
import { PointRedemptionSettings } from './globals/PointRedemptionSettings'
import { RecommendationSettings } from './globals/RecommendationSettings'
import { CRMSettings } from './globals/CRMSettings'
import { SegmentationSettings } from './globals/SegmentationSettings'
import { MarketingAutomationSettings } from './globals/MarketingAutomationSettings'
import { InvoiceSettings } from './globals/InvoiceSettings'
import { GameSettings } from './globals/GameSettings'
import { HomepageSettings } from './globals/HomepageSettings'
import { AboutPageSettings } from './globals/AboutPageSettings'
import { FAQPageSettings } from './globals/FAQPageSettings'
import { PolicyPagesSettings } from './globals/PolicyPagesSettings'
import { NavigationSettings } from './globals/NavigationSettings'

import { CreditScoreHistory } from './collections/CreditScoreHistory'
import { PointsTransactions } from './collections/PointsTransactions'
import { AutomationJourneys } from './collections/AutomationJourneys'
import { AutomationLogs } from './collections/AutomationLogs'
import { CustomerServiceTickets } from './collections/CustomerServiceTickets'
import { MemberSegments } from './collections/MemberSegments'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * CHIC KIM & MIU — Payload CMS v3 主設定
 * ────────────────────────────────────────
 * Collections（34 個）：
 *   會員管理：Users、MembershipTiers、SubscriptionPlans
 *   商品管理：Products、Categories、ProductReviews
 *   訂單管理：Orders、Returns、Refunds、Exchanges、ShippingMethods、Invoices
 *   合作夥伴：Affiliates
 *   內容管理：BlogPosts、Pages、UGCPosts
 *   行銷活動：PointsRedemptions
 *   CRM：CreditScoreHistory、PointsTransactions、AutomationJourneys、AutomationLogs、CustomerServiceTickets、MemberSegments
 *   行銷自動化：MarketingCampaigns、MessageTemplates、ABTests、MarketingExecutionLogs、FestivalTemplates、BirthdayCampaigns
 *   VIP 管家：ConciergeServiceRequests
 *   遊戲系統：MiniGameRecords、CardBattles、GameLeaderboard
 *   媒體資源：Media
 *
 * Globals（10 個）：
 *   GlobalSettings — 全站通用設定
 *   LoyaltySettings — 忠誠度計畫（點數、等級倍率、生日禮、遊戲次數、AI推薦權重）
 *   ReferralSettings — 推薦計畫 + 防濫用設定
 *   PointRedemptionSettings — 點數消耗心理學參數（到期提醒、限時加倍、稀缺性、抽獎）
 *   RecommendationSettings — AI 推薦引擎設定（權重、各階段推薦策略）
 *   CRMSettings — CRM 系統設定（信用分數權重、AI客服、自動化流程、通知模板）
 *   SegmentationSettings — 會員分群設定（權重、門檻、排程）
 *   MarketingAutomationSettings — 行銷自動化設定（通道、A/B測試、個人化、節慶、生日）
 *   InvoiceSettings — 綠界電子發票設定（API 金鑰、賣方資訊、LOGO、自動化）
 *   GameSettings — 遊戲系統設定（各遊戲免費次數、獎勵、排行榜、徽章）
 */
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '｜CHIC KIM & MIU 後台',
      description: 'CHIC KIM & MIU 靚秀國際｜品牌管理後台',
    },
    components: {
      graphics: {
        Logo: '@/components/admin/AdminLogo',
        Icon: '@/components/admin/AdminIcon',
      },
      beforeDashboard: ['@/components/admin/Dashboard'],
    },
  },
  collections: [
    Users,
    Media,
    Categories,
    SizeCharts,
    MembershipTiers,
    SubscriptionPlans,
    Products,
    ProductReviews,
    Orders,
    Returns,
    Refunds,
    Exchanges,
    ShippingMethods,
    Affiliates,
    BlogPosts,
    Pages,
    UGCPosts,
    PointsRedemptions,
    CreditScoreHistory,
    PointsTransactions,
    AutomationJourneys,
    AutomationLogs,
    CustomerServiceTickets,
    MemberSegments,
    MarketingCampaigns,
    MessageTemplates,
    ABTests,
    MarketingExecutionLogs,
    FestivalTemplates,
    BirthdayCampaigns,
    ConciergeServiceRequests,
    Invoices,
    MiniGameRecords,
    CardBattles,
    GameLeaderboard,
  ],
  globals: [GlobalSettings, LoyaltySettings, ReferralSettings, PointRedemptionSettings, RecommendationSettings, CRMSettings, SegmentationSettings, MarketingAutomationSettings, InvoiceSettings, GameSettings, HomepageSettings, AboutPageSettings, FAQPageSettings, PolicyPagesSettings, NavigationSettings],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      UploadFeature({ collections: { media: { fields: [] } } }),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./data/chickimmiu.db',
      ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
    },
  }),
  sharp,
})
