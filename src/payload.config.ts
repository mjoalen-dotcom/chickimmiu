import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig, type EmailAdapter, type Plugin } from 'payload'
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
import { Podcasts } from './collections/Podcasts'
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
import { PrizePools } from './collections/PrizePools'

import { CollectionsPageSettings } from './globals/CollectionsPageSettings'
import { GlobalSettings } from './globals/GlobalSettings'
import { PricingFormulaSettings } from './globals/PricingFormulaSettings'
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
import { ProductListSettings } from './globals/ProductListSettings'
import { AboutPageSettings } from './globals/AboutPageSettings'
import { FAQPageSettings } from './globals/FAQPageSettings'
import { PolicyPagesSettings } from './globals/PolicyPagesSettings'
import { NavigationSettings } from './globals/NavigationSettings'
import { CheckoutSettings } from './globals/CheckoutSettings'
import { OrderSettings } from './globals/OrderSettings'
import { AdsCatalogSettings } from './globals/AdsCatalogSettings'
import { AdAudiences } from './collections/AdAudiences'
import { SearchConsoleKeywords } from './collections/SearchConsoleKeywords'
import { CompetitorPriceRecords } from './collections/CompetitorPriceRecords'
import { MarketingContentDrafts } from './collections/MarketingContentDrafts'

import { CreditScoreHistory } from './collections/CreditScoreHistory'
import { PointsTransactions } from './collections/PointsTransactions'
import { ProductViewEvents } from './collections/ProductViewEvents'
import { BehaviorEvents } from './collections/BehaviorEvents'
import { UTMCampaigns } from './collections/UTMCampaigns'
import { AutomationJourneys } from './collections/AutomationJourneys'
import { AutomationLogs } from './collections/AutomationLogs'
import { CustomerServiceTickets } from './collections/CustomerServiceTickets'
import { MemberSegments } from './collections/MemberSegments'
import { LoginAttempts } from './collections/LoginAttempts'
import { Coupons } from './collections/Coupons'
import { CouponRedemptions } from './collections/CouponRedemptions'
import { DailyHoroscopes } from './collections/DailyHoroscopes'
// 客服中心 v1 Phase 1A
import { Conversations } from './collections/Conversations'
import { Messages } from './collections/Messages'
import { MessageTags } from './collections/MessageTags'
import { ConversationActivities } from './collections/ConversationActivities'
import { CustomerServiceSettings } from './globals/CustomerServiceSettings'
import { Currencies } from './collections/Currencies'
import { WishlistItems } from './collections/WishlistItems'
import { NewsletterSubscribers } from './collections/NewsletterSubscribers'
import { WalletTransactions } from './collections/WalletTransactions'
import { WalletWithdrawals } from './collections/WalletWithdrawals'
import { InventoryTransactions } from './collections/InventoryTransactions'
import { PurchaseOrders } from './collections/PurchaseOrders'
import { StockTakes } from './collections/StockTakes'

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
 * Cloudflare R2 媒體儲存（S3-compatible）
 * ──────────────────────────────────────
 * 啟用條件：四個必填 R2_* env 全有值，且 DISABLE_R2 ≠ '1'
 *   - 任一空 → plugin 不掛載 → fallback 到 Media.ts staticDir 的 public/media
 *   - DISABLE_R2=1 → 強制本機路徑（local dev / hot-reload 不打 R2 配額）
 *
 * 上線檢查清單：
 *   1. R2_ACCOUNT_ID（Cloudflare dashboard → R2 → API tokens 上方那串 hex）
 *   2. R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY（建 token 時記下，secret 只顯示一次）
 *   3. R2_BUCKET_NAME（先在 R2 建 bucket，命名照 AWS S3 規則：小寫 + 連字號）
 *   4. R2_PUBLIC_URL（選填，custom domain 或 pub-*.r2.dev；前台 <Image> 的 src 由
 *      Payload 內部處理透過 /api/media/file/<filename>，所以這個只是給 migration
 *      script 對外顯示的 base URL，不影響 plugin 運作）
 *   5. CSP 已預先 allow `*.r2.cloudflarestorage.com`（next.config.mjs:55）— 若改
 *      用 custom domain 要在 next.config 對應 directives 增列。
 *
 * acl: 'public-read' = bucket 物件公開可讀（前台 PDP 圖直接 GET）。若要做 signed
 * URL（敏感檔案）改用 collection-level signedDownloads。
 *
 * disableLocalStorage 預設 true → upload 不再寫入 public/media；本地若還有歷史檔
 * 也不會干擾，但要遷移上去請跑 scripts/migrate-media-to-r2.ts。
 */
const r2Configured =
  !!process.env.R2_ACCOUNT_ID &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY &&
  !!process.env.R2_BUCKET_NAME &&
  process.env.DISABLE_R2 !== '1'

const plugins: Plugin[] = []

if (r2Configured) {
  plugins.push(
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.R2_BUCKET_NAME!,
      acl: 'public-read',
      config: {
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: false,
      },
    }),
  )
}

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
  //   - browseByFolder:false → 不在最上方 nav（會與「使用說明 / 會員分群分析 …」並排錯位）。
  //   - collectionOverrides → 把 auto-generated 的 payload-folders collection 改中文 label
  //     + 改 useAsTitle/defaultColumns + 設 group + 保留 views.list redirect，但
  //     **保持 admin.hidden=true**（Payload 預設）讓側欄不再出現「媒體資料夾」項目。
  //     原因：Media collection 開啟 `folders:true` 後內部已自帶「By Folder」tab，
  //     兩條 nav link 並排會讓人誤以為功能重複。視覺化樹狀瀏覽器仍可從
  //     Media list 內的 By Folder tab 進入；資料夾編輯 URL（views.edit、
  //     /admin/collections/payload-folders/<id>）也照常運作；保留 list view 的
  //     PayloadFoldersListRedirect 是給直連 /admin/collections/payload-folders 的
  //     bookmark 仍會正常 redirect 到 Media By Folder。
  //   - 對應 Media.ts `folders: true` + migration `enable_payload_folders`
  //     + components/admin/PayloadFoldersListRedirect.tsx
  folders: {
    browseByFolder: false,
    collectionOverrides: [
      ({ collection }) => ({
        ...collection,
        labels: { singular: '媒體資料夾', plural: '媒體資料夾' },
        admin: {
          ...collection.admin,
          group: '⑥ 內容與頁面',
          hidden: true,
          useAsTitle: 'name',
          defaultColumns: ['name', 'folder', 'updatedAt'],
          description:
            '管理 Media 用的資料夾樹（巢狀、可拖拉）。Sidebar 已隱藏避免與 Media 重複；' +
            '日常操作改從「Media → By Folder」tab 進入。直連此 URL 會 redirect 到視覺版。',
          components: {
            ...collection.admin?.components,
            views: {
              ...collection.admin?.components?.views,
              list: {
                Component: '@/components/admin/PayloadFoldersListRedirect',
              },
            },
          },
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
        // AdminBackButton 必須在最前面：它在 sidebar 真實 DOM 渲染（不是
        // portal），擺最後會卡在 ⓪ 數據儀表 group 與 ① 訂單與物流 group
        // 中間，看起來像孤兒。放第一位才會出現在整個 sidebar 最頂端。
        '@/components/admin/AdminBackButton',
        '@/components/admin/CKMUDashboardNavGroup',
        // 以下三個都是 portal / style / script-only，排序不影響視覺。
        '@/components/admin/AdminStyles',
        '@/components/admin/NavScrollPersist',
        '@/components/admin/AdminUserMenu',
      ],
      // afterNavLinks 掛 CKMUSystemToolsNavGroup — 該 component 本身不渲染獨立
      // 群組，而是 DOM 注入兩個工具連結（AI 部落格草稿產生器 / REST API 文件）
      // 進「⑦ 系統與安全」原生 group 的 nav 列表，視覺合而為一。
      afterNavLinks: ['@/components/admin/CKMUSystemToolsNavGroup'],
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
        consumerInsights: {
          Component: '@/components/admin/ConsumerInsightsView',
          path: '/consumer-insights',
        },
        // PR-B：UTM 商品歸因
        utmAttribution: {
          Component: '@/components/admin/UTMAttributionView',
          path: '/reports/utm-attribution',
        },
        utmBuilder: {
          Component: '@/components/admin/UTMBuilderView',
          path: '/tools/utm-builder',
        },
        // Wave 1 PR-ζ：連結完整性診斷（封測公開前掃 6 種前後台斷鏈）
        linkIntegrity: {
          Component: '@/components/admin/LinkIntegrityView',
          path: '/diagnostics/link-integrity',
        },
        // ⑦ 系統工具：AI 部落格草稿產生器（Groq llama-3.3-70b-versatile）
        // 入口在 CKMUSystemToolsNavGroup，URL 直連也可
        blogAIDraft: {
          Component: '@/components/admin/BlogAIDraftView',
          path: '/tools/blog-ai-draft',
        },
        whiteHatMarketing: {
          Component: '@/components/admin/WhiteHatMarketingView',
          path: '/tools/whitehat-marketing',
        },
        // ⑦ 系統工具：REST API 文件（自動從 payload config 產生 collection / global 端點表）
        // 給 APP / 第三方串接工程師
        apiDocs: {
          Component: '@/components/admin/APIDocsView',
          path: '/api-docs',
        },
        // ⑦ 系統工具：一鍵刪除未上架 / 草稿商品（內建 referrer 診斷）
        // 對應 endpoint：POST /api/products/admin/bulk-delete-unpublished
        bulkDeleteProducts: {
          Component: '@/components/admin/BulkDeleteProductsView',
          path: '/tools/bulk-delete-products',
        },

      },
    },
  },
  // Collections array order determines sidebar group order in admin UI.
  // Payload v3 groups by `admin.group` and sorts groups by the position of
  // the FIRST collection registered for each group. Re-order the array to
  // re-order the sidebar groups. (The ①…⑦ prefix in group names is a visual
  // hint only; it does not influence sort.)
  collections: [
    // ① 訂單與物流
    Orders,
    Returns,
    Refunds,
    Exchanges,
    ShippingMethods,
    Invoices,
    // ② 商品管理
    Categories,
    SizeCharts,
    Products,
    ProductReviews,
    InventoryTransactions, // 進銷存：庫存異動流水
    PurchaseOrders, // 進銷存：進貨單
    StockTakes, // 進銷存：盤點
    // ③ 會員與 CRM
    Users,
    MembershipTiers,
    SubscriptionPlans,
    PointsRedemptions,
    CreditScoreHistory,
    PointsTransactions,
    MemberSegments,
    UserRewards,
    WishlistItems, // Phase 2 B：會員收藏清單 DB 持久化（跨裝置）
    WalletTransactions, // Phase 2 C：購物金/儲值金帳本
    WalletWithdrawals, // Phase 2 C：儲值金退現申請
    // 客服中心 v1 Phase 1A — Conversations + Messages 是 ③ 會員 CRM 的延伸
    Conversations,
    Messages,
    MessageTags,
    ConversationActivities,
    ProductViewEvents, // PR-B：UTM 商品瀏覽事件流
    BehaviorEvents, // 消費者分析：點擊 / 加購 / 瀏覽 / 停留
    // ④ 行銷推廣
    AutomationJourneys,
    AutomationLogs,
    MarketingCampaigns,
    NewsletterSubscribers, // Phase 2 B：電子報訂閱名單（前台訂閱表單寫入）
    MessageTemplates,
    SearchConsoleKeywords,
    CompetitorPriceRecords,
    MarketingContentDrafts,
    ABTests,
    MarketingExecutionLogs,
    FestivalTemplates,
    BirthdayCampaigns,
    AddOnProducts,
    GiftRules,
    Bundles,
    Coupons,
    CouponRedemptions,
    UTMCampaigns, // PR-B：集中管理 UTM 活動 slug
    AdAudiences, // PR-E：DPA Retargeting Custom Audience 定義
    // ⑤ 互動體驗
    Affiliates,
    UGCPosts,
    CustomerServiceTickets,
    ConciergeServiceRequests,
    PrizePools,
    MiniGameRecords,
    CardBattles,
    GameLeaderboard,
    StyleSubmissions,
    StyleGameRooms,
    StyleVotes,
    StyleWishes,
    CollectibleCardTemplates,
    CollectibleCards,
    CollectibleCardEvents,
    DailyHoroscopes,
    // ⑥ 內容與頁面
    // 順序原則：核心內容（最常編輯）→ 樣式（少動）→ 資源池（最少動）。
    // Pages 放第一個 = group order 也由它決定（仍排在 ⑤ 後面 / ⑦ 前面，因
    // 整段位置沒移）；Media 移到最後因為 admin 通常透過 Products / BlogPosts
    // 上傳介面間接用 Media，少直接點 Media collection；媒體資料夾已隱藏。
    Pages,
    BlogPosts,
    Podcasts,
    SiteThemes,
    Media,
    // ⑦ 系統與安全
    LoginAttempts,
    Currencies, // 幣別與匯率（前台 CurrencySwitcher 資料源；TWD 結算實際值不受影響）
  ],
  // Globals registration order controls the sub-order of globals within each
  // group section in the sidebar. Grouped & sequenced to match collections above.
  globals: [
    // ① 訂單與物流
    CheckoutSettings,
    OrderSettings,
    InvoiceSettings,
    TaxSettings,
    // ③ 會員與 CRM
    LoyaltySettings,
    ReferralSettings,
    PointRedemptionSettings,
    CRMSettings,
    SegmentationSettings,
    CustomerServiceSettings, // 客服中心 v1 Phase 1A
    // ④ 行銷推廣
    MarketingAutomationSettings,
    RecommendationSettings,
    AdsCatalogSettings,
    // ⑤ 互動體驗
    GameSettings,
    // ⑥ 內容與頁面
    // 順序原則：全站最常動 → 各頁面設定 → 規範類靜態頁。NavigationSettings
    // 涵蓋公告 bar / 主選單 / 頁尾，幾乎每週要動，放最上面；首頁 / 合集頁
    // / 商品列表是次常動的版面設定；About / FAQ / Policy 屬內容頁面，多半
    // 設一次就少改。
    NavigationSettings,
    HomepageSettings,
    CollectionsPageSettings,
    ProductListSettings,
    AboutPageSettings,
    FAQPageSettings,
    PolicyPagesSettings,
    // ⑦ 系統與安全
    GlobalSettings,
    PricingFormulaSettings,
  ],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      UploadFeature({ collections: { media: { fields: [] } } }),
    ],
  }),
  // GraphQL 完全關閉：本專案沒有任何 client/app 在用 /api/graphql，
  // Playground 也已從後台 nav 移除。關閉可省去 schema build 時間 +
  // 縮小 prod build 體積 + 減少對外 attack surface。
  graphQL: { disable: true },
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
  plugins,
})
