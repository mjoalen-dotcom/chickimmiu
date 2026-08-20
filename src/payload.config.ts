import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { en } from '@payloadcms/translations/languages/en'
import { zhTw } from '@payloadcms/translations/languages/zhTw'
import path from 'path'
import { buildConfig, type EmailAdapter, type Plugin } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Customers } from './collections/Customers'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { MembershipTiers } from './collections/MembershipTiers'
import { Products } from './collections/Products'
import { SizeCharts } from './collections/SizeCharts'
import { Orders } from './collections/Orders'
import { Affiliates } from './collections/Affiliates'
import { BlogPosts } from './collections/BlogPosts'
import { BlogCategories } from './collections/BlogCategories'
import { Podcasts } from './collections/Podcasts'
import { Pages } from './collections/Pages'
// 🔒 PROTECTED: CelebrityFeatures powers /pages/ckmu-on-show celebrity-grid block + /celebrity/[slug]
// 子頁。Do NOT remove this import OR the entry in the collections[] array below — 砍掉等於把
// /pages/ckmu-on-show 整頁 18 卡片牆 + 18 個藝人子頁全部砍掉（user 已抱怨 2 次）。
// 如果你做 git reset --hard origin/main 把這條 wipe 掉，立刻從 hetzner branch
// `claude/funny-haibt-a3b35a` 還原（含 banner layout + 161 圖 gallery）。
import { CelebrityFeatures } from './collections/CelebrityFeatures'
import { SubscriptionPlans } from './collections/SubscriptionPlans'
import { UserSubscriptions } from './collections/UserSubscriptions'
import { ProductReviews } from './collections/ProductReviews'
import { Returns } from './collections/Returns'
import { Exchanges } from './collections/Exchanges'
import { Refunds } from './collections/Refunds'
import { ShippingMethods } from './collections/ShippingMethods'
import { UGCPosts } from './collections/UGCPosts'
import { PointsRedemptions } from './collections/PointsRedemptions'
import { CampaignActivities } from './collections/CampaignActivities'
import { MarketingCampaigns } from './collections/MarketingCampaigns'
import { PromotionRules } from './collections/PromotionRules'
import { PromotionApplications } from './collections/PromotionApplications'
import { PromotionDropClaims } from './collections/PromotionDropClaims'
import { MessageTemplates } from './collections/MessageTemplates'
import { EmailTemplates } from './collections/EmailTemplates'
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
import { OpsActions } from './collections/OpsActions'

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
import { PromotionSettings } from './globals/PromotionSettings'
import { InvoiceSettings } from './globals/InvoiceSettings'
import { TaxSettings } from './globals/TaxSettings'
import { GameSettings } from './globals/GameSettings'
import { HomepageSettings } from './globals/HomepageSettings'
import { ProductListSettings } from './globals/ProductListSettings'
import { AboutPageSettings } from './globals/AboutPageSettings'
import { FAQPageSettings } from './globals/FAQPageSettings'
import { PolicyPagesSettings } from './globals/PolicyPagesSettings'
import { PackagingPageSettings } from './globals/PackagingPageSettings'
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
import {
  adminOnlyGlobal,
  withOperatorGlobalUpdate,
  withOperatorManage,
} from './access/operatorAccess'

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
 * Sidebar 群組架構（8 組；各 collection/global 的 admin.group 為準）：
 *   ⓪ 數據儀表        — 手刻 client group（CKMUDashboardNavGroup，分析 views）
 *   Ⓚ 兩站部落格      — BlogPosts / BlogCategories + KimBlogNavGroup 注入的
 *                        工作台 / 相簿 / AI 草稿 / 查看部落格 連結（刻意保留獨立
 *                        群組不併入 ⑥，理由見 KimBlogNavGroup.tsx 檔頭註解）
 *   ① 訂單與物流      ② 商品管理      ③ 會員與 CRM
 *   ④ 行銷推廣        ⑤ 互動體驗      ⑥ 內容與頁面（含系統設定 GlobalSettings／
 *                        PricingFormulaSettings 已併入②，及 CKMUSystemToolsNavGroup
 *                        注入的系統工具連結）
 *
 * 2026-08-15 步驟03分組整併：原「⑦ 系統與安全」（Currencies／LoginAttempts／
 * PricingFormulaSettings／GlobalSettings）已拆散併入既有群組，8組降到符合
 * DoD ≤6組目標（不含⓪／Ⓚ兩個手刻/特殊群組）。詳見
 * docs/admin-ui/AUDIT-20260814.md。
 *
 * 群組順序由 collections[] 陣列中「該 group 第一個成員」的位置決定；
 * 群組內連結順序 = 陣列內順序（globals 同理，接在 collections 之後）。
 * 排序原則：使用頻率高在前 + 同類流程相鄰。詳見 collections[] 內各段註解。
 */
// LB-08：production 缺關鍵 env 必須 fail-fast，不准靜默 fallback。
// PAYLOAD_SECRET 缺 → 空密鑰簽 auth token；DATABASE_URI 缺 → 靜默開一顆空的本地 SQLite。
// 兩者都是災難級靜默錯誤，build / migrate / payload run / 啟動任何一路 import 到本檔就直接炸。
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.PAYLOAD_SECRET || !process.env.DATABASE_URI)
) {
  const missing = [
    !process.env.PAYLOAD_SECRET ? 'PAYLOAD_SECRET' : null,
    !process.env.DATABASE_URI ? 'DATABASE_URI' : null,
  ]
    .filter(Boolean)
    .join(', ')
  throw new Error(
    `[payload.config] production 環境缺少必要 env：${missing}（拒絕以 dev fallback 啟動）`,
  )
}

export default buildConfig({
  i18n: {
    fallbackLanguage: 'zh-TW',
    supportedLanguages: {
      'zh-TW': zhTw,
      en,
    },
  },
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
    dateFormat: 'yyyy-MM-dd HH:mm',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '｜CHIC KIM & MIU 後台',
      description: 'CHIC KIM & MIU 靚秀國際｜品牌管理後台',
      defaultOGImageType: 'off',
      icons: {
        icon: '/favicon.ico',
        shortcut: '/favicon.ico',
        apple: '/apple-touch-icon.png',
      },
      openGraph: {
        images: [
          {
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: 'CHIC KIM & MIU｜韓系質感女裝',
          },
        ],
      },
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
      // afterNavLinks 掛兩個 DOM 注入元件（本身不渲染獨立群組）：
      //   - KimBlogNavGroup → 把部落格工作台 / 相簿 / AI 草稿 / 查看部落格
      //     連結注入「Ⓚ 金老佛爺部落格」原生 group
      //   - CKMUSystemToolsNavGroup → 把系統工具連結注入「⑥ 內容與頁面」
      afterNavLinks: [
        '@/components/admin/KimBlogNavGroup',
        '@/components/admin/CKMUSystemToolsNavGroup',
      ],
      views: {
        blogStudio: {
          Component: '@/components/admin/BlogStudioView',
          exact: true,
          path: '/blog-studio',
        },
        blogAlbums: {
          Component: '@/components/admin/BlogAlbumsView',
          path: '/blog-studio/albums',
        },
        help: {
          Component: '@/components/admin/HelpView',
          path: '/help',
        },
        campaignStudio: {
          Component: '@/components/admin/CampaignStudioView',
          path: '/campaign-studio',
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
        // ④ 行銷工具：Email 模板預覽 / 測試寄送（入口也在 CKMUSystemToolsNavGroup）
        // 對應 endpoint：POST /api/admin/email-templates/test
        emailTemplates: {
          Component: '@/components/admin/EmailTemplatePreviewView',
          path: '/tools/email-templates',
        },
        // 營運 AI 助理指揮艙（L2 授權：AI 提案 / admin 核准執行）
        // 對應 endpoint：/api/ops-copilot/{briefing,actions,chat}
        // 稽核軌跡在 OpsActions collection；入口連結由 CKMUSystemToolsNavGroup 注入 ⑥
        opsCopilot: {
          Component: '@/components/admin/OpsCopilotView',
          path: '/ops-copilot',
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
    // Ⓚ 金老佛爺部落格 — 旗艦內容專區，緊接 ⓪ 數據儀表之後。
    // BlogStudio 自訂 view 連結（工作台 / 相簿 / AI 草稿 / 查看部落格）由
    // KimBlogNavGroup DOM 注入同一 group，視覺上合為一站式專區。
    withOperatorManage(BlogPosts),
    withOperatorManage(BlogCategories),
    // ① 訂單與物流 — 每日營運最高頻：訂單 / 發票在前；退貨 → 換貨 → 退款
    // 照客服處理流程排列；物流方式設定極少動放最後。
    withOperatorManage(Orders),
    withOperatorManage(Invoices),
    withOperatorManage(Returns),
    withOperatorManage(Exchanges),
    withOperatorManage(Refunds),
    ShippingMethods,
    // ② 商品管理 — Products 最常用放最前；進銷存三件套殿後。
    withOperatorManage(Products),
    withOperatorManage(Categories),
    withOperatorManage(SizeCharts),
    withOperatorManage(ProductReviews),
    withOperatorManage(InventoryTransactions), // 進銷存：庫存異動流水
    withOperatorManage(PurchaseOrders), // 進銷存：進貨單
    withOperatorManage(StockTakes), // 進銷存：盤點
    // ③ 會員與 CRM — 會員核心 → 訂閱 → 點數回饋 → 錢包 → 收藏 →
    // 客服對話 → 行為事件（同類相鄰，高頻在前）。
    Users,
    // APP-API-001 步驟16：從 Users 分離出來的獨立顧客 auth collection，
    // 緊接 Users 之後方便後台對照。
    Customers,
    MembershipTiers,
    MemberSegments,
    SubscriptionPlans,
    UserSubscriptions,
    PointsTransactions,
    PointsRedemptions,
    UserRewards,
    CreditScoreHistory,
    WalletTransactions, // Phase 2 C：購物金/儲值金帳本
    WalletWithdrawals, // Phase 2 C：儲值金退現申請
    WishlistItems, // Phase 2 B：會員收藏清單 DB 持久化（跨裝置）
    // 客服中心 v1 Phase 1A — Conversations + Messages 是 ③ 會員 CRM 的延伸
    Conversations,
    Messages,
    MessageTags,
    ConversationActivities,
    ProductViewEvents, // PR-B：UTM 商品瀏覽事件流
    BehaviorEvents, // 消費者分析：點擊 / 加購 / 瀏覽 / 停留
    // ④ 行銷推廣 — 促銷工具（最常動）→ 檔期活動 → 自動化 → 訊息/名單 →
    // 廣告與市場情報（低頻查閱類殿後）。
    Coupons,
    CouponRedemptions,
    AddOnProducts,
    GiftRules,
    Bundles,
    MarketingCampaigns,
    CampaignActivities,
    PromotionRules, // Campaign Engine：版本化促銷規則（活動 Root 的子規則）
    PromotionApplications, // Campaign Engine：促銷套用不可變交易紀錄
    PromotionDropClaims, // Campaign Engine：限量券包／神秘禮物的領取憑據（每人 1 次 + 回沖依據）
    FestivalTemplates,
    BirthdayCampaigns,
    AutomationJourneys,
    AutomationLogs,
    ABTests,
    MarketingExecutionLogs,
    MessageTemplates,
    EmailTemplates, // 交易信模板（歡迎 / 訂單通知 / 驗證信）— 後台可編輯 / 預覽 / 測試寄送
    NewsletterSubscribers, // Phase 2 B：電子報訂閱名單（前台訂閱表單寫入）
    UTMCampaigns, // PR-B：集中管理 UTM 活動 slug
    AdAudiences, // PR-E：DPA Retargeting Custom Audience 定義
    SearchConsoleKeywords,
    CompetitorPriceRecords,
    MarketingContentDrafts,
    // ⑤ 互動體驗 — 客服工單 / VIP 管家在前（第一線每日處理）；
    // 聯盟與 UGC 次之；遊戲系統照玩法聚類殿後。
    CustomerServiceTickets,
    ConciergeServiceRequests,
    Affiliates,
    UGCPosts,
    PrizePools,
    MiniGameRecords,
    CardBattles,
    GameLeaderboard,
    CollectibleCardTemplates,
    CollectibleCards,
    CollectibleCardEvents,
    StyleSubmissions,
    StyleGameRooms,
    StyleVotes,
    StyleWishes,
    DailyHoroscopes,
    // ⑥ 內容與頁面
    // 順序原則：核心內容（最常編輯）→ 樣式（少動）→ 資源池（最少動）。
    // 部落格已移至 Ⓚ 金老佛爺部落格專區；Media 放最後因為 admin 通常透過
    // Products / BlogPosts 上傳介面間接用 Media，少直接點；媒體資料夾已隱藏。
    withOperatorManage(Pages),
    withOperatorManage(CelebrityFeatures),
    withOperatorManage(Podcasts),
    withOperatorManage(SiteThemes),
    withOperatorManage(Media),
    // 營運 AI 助理：行動提案稽核軌跡（AI 只能寫 pending，admin 核准後才執行）。
    // 群組落點比照 CKMUSystemToolsNavGroup 注入的系統工具連結（⑥ 底部）。
    OpsActions,
    // 2026-08-15 步驟03分組整併：原「⑦ 系統與安全」已拆散——LoginAttempts
    // 併入 ③ 會員與CRM、Currencies 併入 ① 訂單與物流（admin.group 已改，
    // 陣列位置維持不動，故在各自新群組內排序偏後，符合兩者「低頻使用」性質）。
    LoginAttempts,
    Currencies, // 幣別與匯率（前台 CurrencySwitcher 資料源；TWD 結算實際值不受影響）
  ],
  // Globals registration order controls the sub-order of globals within each
  // group section in the sidebar. Grouped & sequenced to match collections above.
  globals: [
    // ① 訂單與物流
    adminOnlyGlobal(CheckoutSettings),
    adminOnlyGlobal(OrderSettings),
    adminOnlyGlobal(InvoiceSettings),
    adminOnlyGlobal(TaxSettings),
    // ③ 會員與 CRM
    adminOnlyGlobal(LoyaltySettings),
    adminOnlyGlobal(ReferralSettings),
    adminOnlyGlobal(PointRedemptionSettings),
    adminOnlyGlobal(CRMSettings),
    adminOnlyGlobal(SegmentationSettings),
    adminOnlyGlobal(CustomerServiceSettings), // 客服中心 v1 Phase 1A
    // ④ 行銷推廣
    adminOnlyGlobal(PromotionSettings), // Campaign Engine：kill switch / 前台顯示 / 伺服器計價強制
    adminOnlyGlobal(MarketingAutomationSettings),
    adminOnlyGlobal(RecommendationSettings),
    adminOnlyGlobal(AdsCatalogSettings),
    // ⑤ 互動體驗
    adminOnlyGlobal(GameSettings),
    // ⑥ 內容與頁面
    // 順序原則：全站最常動 → 各頁面設定 → 規範類靜態頁。NavigationSettings
    // 涵蓋公告 bar / 主選單 / 頁尾，幾乎每週要動，放最上面；首頁 / 合集頁
    // / 商品列表是次常動的版面設定；About / FAQ / Policy 屬內容頁面，多半
    // 設一次就少改。
    withOperatorGlobalUpdate(NavigationSettings),
    withOperatorGlobalUpdate(HomepageSettings),
    withOperatorGlobalUpdate(CollectionsPageSettings),
    withOperatorGlobalUpdate(ProductListSettings),
    withOperatorGlobalUpdate(AboutPageSettings),
    withOperatorGlobalUpdate(FAQPageSettings),
    withOperatorGlobalUpdate(PolicyPagesSettings),
    withOperatorGlobalUpdate(PackagingPageSettings),
    // 2026-08-15 步驟03分組整併：原「⑦ 系統與安全」已拆散——GlobalSettings
    // 併入 ⑥ 內容與頁面（陣列位置維持在此，故排在其他 ⑥ globals 之後）、
    // PricingFormulaSettings 併入 ② 商品管理（會排在該群組 collections 之後，
    // 陣列位置不變）。
    adminOnlyGlobal(GlobalSettings),
    adminOnlyGlobal(PricingFormulaSettings),
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
  // DB-PG-001 Phase 1：雙軌 adapter，同一顆 DATABASE_URI 依 scheme 決定走哪個
  // adapter，不新增額外環境變數——SQLite 值維持原樣（file:...）就照舊跑
  // sqliteAdapter；把 DATABASE_URI 換成 postgres://... 才會切到 postgresAdapter。
  // 舊 SQLite 值本身就是「一鍵切回」的備援，不用另外註解保留。
  db: (() => {
    const uri = process.env.DATABASE_URI || 'file:./data/chickimmiu.db'
    const isPostgres = uri.startsWith('postgres://') || uri.startsWith('postgresql://')
    // Env-gated schema push. Default OFF because the interactive prompt
    // blocks DB writes in non-TTY stdin (observed: POST /api/users/login
    // stalls 30s then succeeds but persists nothing). Set PAYLOAD_ENABLE_PUSH=true
    // only when you explicitly want dev-mode schema drift without a migration file.
    const push = process.env.PAYLOAD_ENABLE_PUSH === 'true'
    if (isPostgres) {
      return postgresAdapter({
        pool: { connectionString: uri },
        // SQLite 原始資料是數字自增 ID（products.id=1395 這類），搬過去也要
        // 維持一樣的整數 ID 語意，不能換成 uuid（既有前台/API/外部串接
        // 到處都是數字 ID 的假設）。
        idType: 'serial',
        push,
        // ⚠️ 絕對不能跟 sqliteAdapter 共用 src/migrations——那 104 個既有檔案
        // 是 SQLite 方言（drizzle-orm/sqlite-core），直接拿去對 PG 跑
        // `payload migrate` 會整批失敗。PG 是全新 schema（見 Prompt P2：
        // 「以 Payload migration 建全新 schema，不用 pgloader 硬轉」），
        // 用獨立目錄，第一次 migrate:create 會產生一支涵蓋所有 collections
        // 的 baseline migration。
        migrationDir: './src/migrations-pg',
      })
    }
    return sqliteAdapter({
      client: {
        url: uri,
        ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
      },
      push,
    })
  })(),
  email: emailAdapter,
  sharp,
  plugins,
})
