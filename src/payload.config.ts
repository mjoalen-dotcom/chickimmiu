import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type EmailAdapter } from 'payload'
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
import { UserRewards } from './collections/UserRewards'
import { StyleSubmissions } from './collections/StyleSubmissions'
import { StyleGameRooms } from './collections/StyleGameRooms'
import { StyleVotes } from './collections/StyleVotes'
import { StyleWishes } from './collections/StyleWishes'
import { AddOnProducts } from './collections/AddOnProducts'
import { GiftRules } from './collections/GiftRules'
import { Bundles } from './collections/Bundles'
import { CollectibleCardTemplates } from './collections/CollectibleCardTemplates'
import { CollectibleCards } from './collections/CollectibleCards'
import { CollectibleCardEvents } from './collections/CollectibleCardEvents'
import { SiteThemes } from './collections/SiteThemes'

import { GlobalSettings } from './globals/GlobalSettings'
import { LoyaltySettings } from './globals/LoyaltySettings'
import { ReferralSettings } from './globals/ReferralSettings'
import { PointRedemptionSettings } from './globals/PointRedemptionSettings'
import { RecommendationSettings } from './globals/RecommendationSettings'
import { CRMSettings } from './globals/CRMSettings'
import { SegmentationSettings } from './globals/SegmentationSettings'
import { MarketingAutomationSettings } from './globals/MarketingAutomationSettings'
import { InvoiceSettings } from './globals/InvoiceSettings'
import { TaxSettings } from './globals/TaxSettings'
import { GameSettings } from './globals/GameSettings'
import { HomepageSettings } from './globals/HomepageSettings'
import { AboutPageSettings } from './globals/AboutPageSettings'
import { FAQPageSettings } from './globals/FAQPageSettings'
import { PolicyPagesSettings } from './globals/PolicyPagesSettings'
import { NavigationSettings } from './globals/NavigationSettings'
import { CheckoutSettings } from './globals/CheckoutSettings'
import { OrderSettings } from './globals/OrderSettings'

import { CreditScoreHistory } from './collections/CreditScoreHistory'
import { PointsTransactions } from './collections/PointsTransactions'
import { AutomationJourneys } from './collections/AutomationJourneys'
import { AutomationLogs } from './collections/AutomationLogs'
import { CustomerServiceTickets } from './collections/CustomerServiceTickets'
import { MemberSegments } from './collections/MemberSegments'
import { LoginAttempts } from './collections/LoginAttempts'
import { Coupons } from './collections/Coupons'
import { CouponRedemptions } from './collections/CouponRedemptions'
import { DailyHoroscopes } from './collections/DailyHoroscopes'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Email adapter 選用策略：
 *   - 有 RESEND_API_KEY → Resend（prod 預設路徑）
 *   - 沒 RESEND_API_KEY → console fallback（dev 方便；把 forgot-password /
 *     verify token 內容 log 到 server console，不 throw 擋住註冊流程）
 *
 * Resend 設定步驟：
 *   1. https://resend.com/onboarding 建 API key
 *   2. Domains → Add Domain → DNS 設 SPF/DKIM 驗證寄件 domain
 *   3. .env RESEND_API_KEY + EMAIL_FROM_ADDRESS 對應已驗證 domain
 *   4. prod 設完要 pnpm build + pm2 restart（env 會 bake）
 */
const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'no-reply@chickimmiu.com'
const fromName = 'CHIC KIM & MIU'

const consoleFallbackEmailAdapter: EmailAdapter = () => ({
  name: 'console-fallback',
  defaultFromAddress: fromAddress,
  defaultFromName: fromName,
  sendEmail: async (message) => {
    const to = Array.isArray(message.to) ? message.to.join(', ') : String(message.to || '')
    const html = String(message.html || message.text || '')
    // eslint-disable-next-line no-console
    console.log(
      '\n[email-fallback] RESEND_API_KEY not set — email content logged instead of sent:\n' +
        `  to:       ${to}\n` +
        `  from:     ${message.from || `${fromName} <${fromAddress}>`}\n` +
        `  subject:  ${message.subject || ''}\n` +
        `  preview:  ${html.slice(0, 600).replace(/\s+/g, ' ')}\n`,
    )
    return { id: `fallback-${Date.now()}` }
  },
})

const emailAdapter = process.env.RESEND_API_KEY
  ? resendAdapter({
      defaultFromAddress: fromAddress,
      defaultFromName: fromName,
      apiKey: process.env.RESEND_API_KEY,
    })
  : consoleFallbackEmailAdapter

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
 *   遊戲系統：MiniGameRecords、CardBattles、GameLeaderboard、UserRewards、StyleSubmissions、StyleGameRooms、StyleVotes、StyleWishes
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
  // 啟用 Payload 內建資料夾系統（v3 native folders，experimental but stable enough）
  //   - 自動建立 `payload-folders` collection（樹狀，自我參照 folder 欄位）
  //   - 已開 folders 的 collection（目前只有 Media）會多一個 `folder` relationship +
  //     admin 列表多一個 grid / list toggle + drag-drop 移動圖片到資料夾
  //   - collectionSpecific:true（預設）= 每個資料夾用 folderType[] 鎖定可放的 collection；
  //     將來開放更多 collection 用 folder 時不需設定每個資料夾
  //   - browseByFolder:false → 不在最上方 nav（會與「使用說明 / 會員分群分析 …」並排錯位）；
  //     入口改成「媒體資料夾」這條 collection link，跟 Media 同 group。
  //   - collectionOverrides → 把 auto-generated 的 payload-folders collection
  //     從 admin.hidden 改成 visible、放進「媒體資源」group、改成中文標籤；
  //     清單 default columns = 名稱 + 更新時間。父資料夾（folder）+ 適用 collection
  //     （folderType）原生用內部 select/relationship UI 即可。
  //   - 對應 Media.ts `folders: true` + migration `enable_payload_folders`
  folders: {
    browseByFolder: false,
    collectionOverrides: [
      ({ collection }) => ({
        ...collection,
        labels: { singular: '媒體資料夾', plural: '媒體資料夾' },
        admin: {
          ...collection.admin,
          group: '內容與頁面',
          hidden: false,
          useAsTitle: 'name',
          defaultColumns: ['name', 'folder', 'updatedAt'],
          description: '管理 Media 用的資料夾樹（巢狀、可拖拉）。也可從 Media → By Folder tab 直接拖圖。',
        },
      }),
    ],
  },
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
      beforeNavLinks: [
        '@/components/admin/HelpNavLink',
        '@/components/admin/MemberAnalyticsNavLink',
        '@/components/admin/RepeatPurchaseNavLink',
        '@/components/admin/AdminStyles',
        '@/components/admin/NavScrollPersist',
        '@/components/admin/AdminUserMenu',
      ],
      views: {
        help: {
          Component: '@/components/admin/HelpView',
          path: '/help',
        },
        memberAnalytics: {
          Component: '@/components/admin/MemberAnalyticsView',
          path: '/member-analytics',
        },
        repeatPurchase: {
          Component: '@/components/admin/RepeatPurchaseView',
          path: '/repeat-purchase',
        },
      },
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
    UserRewards,
    StyleSubmissions,
    StyleGameRooms,
    StyleVotes,
    StyleWishes,
    LoginAttempts,
    AddOnProducts,
    GiftRules,
    Bundles,
    Coupons,
    CouponRedemptions,
    CollectibleCardTemplates,
    CollectibleCards,
    CollectibleCardEvents,
    DailyHoroscopes,
    SiteThemes,
  ],
  globals: [GlobalSettings, LoyaltySettings, ReferralSettings, PointRedemptionSettings, RecommendationSettings, CRMSettings, SegmentationSettings, MarketingAutomationSettings, InvoiceSettings, TaxSettings, GameSettings, HomepageSettings, AboutPageSettings, FAQPageSettings, PolicyPagesSettings, NavigationSettings, CheckoutSettings, OrderSettings],
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
    // Env-gated schema push. Default OFF because the interactive prompt
    // blocks DB writes in non-TTY stdin (observed: POST /api/users/login
    // stalls 30s then succeeds but persists nothing). Set PAYLOAD_ENABLE_PUSH=true
    // only when you explicitly want dev-mode schema drift without a migration file.
    push: process.env.PAYLOAD_ENABLE_PUSH === 'true',
  }),
  email: emailAdapter,
  sharp,
})
