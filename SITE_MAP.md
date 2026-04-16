# CHIC KIM & MIU — Site Map

> **用途**: 給未來 Claude 對話當開場 context。讀這個檔就能了解全站架構，不用從零挖。
> **最後更新**: 2026-04-16
> **怎麼用**: 新對話開場說「先讀 SITE_MAP.md 和 PHASE4_HANDOFF.md」即可。

---

## 1. 技術棧 & 基礎設施

- **Framework**: Next.js 15.4.11 (App Router) + Payload CMS v3
- **DB**: SQLite via `@payloadcms/db-sqlite`，位置 `file:./data/chickimmiu.db`（支援 Turso: 有 `DATABASE_AUTH_TOKEN` 則走遠端）
- **Rich text**: Lexical editor（Phase 4 已加 `UploadFeature` 支援圖片/影片）
- **Image**: 本地 `/media/` 靜態檔案（Payload API `/api/media/file/X` 被 `normalizeMediaUrl` 重寫為 `/media/X`）
- **Auth**: Payload 內建，user.role = `admin` / `partner` / `customer`（一般會員）
- **Dev server**: port 3001 via `chickimmiu-next` launch config（`preview_start chickimmiu-next`）
- **狀態管理**: Zustand (`cartStore`, `wishlistStore`)
- **部署**: 細節請讀 `DEPLOYMENT.md`（未盤點）
- **Live 站**: `https://testshop.ckmu.co`（是否從這個 repo 部署尚未確認）

---

## 2. Collections（35 個）

按後台 admin group 分類。格式：`slug` — collection 檔案名 — 一句話功能。

### 商品管理（4）
- `products` — `Products.ts` — 商品資料（含變體、庫存、分類、CSV/Excel 匯入匯出）。**最大最複雜的 collection**，5 個 tab（基本 / 媒體 / 變體 / 穿搭 / SEO）+ sidebar（狀態 / 採購 sourcing group）
- `categories` — `Categories.ts` — 多層次分類（主 > 子 > 細）
- `product-reviews` — `ProductReviews.ts` — 商品評價審核
- `size-charts` — `SizeCharts.ts` — 跨商品復用的尺寸表範本（measurements + rows + unit）

### 會員管理（7）
- `users` — `Users.ts` — 系統使用者（admin / partner / customer 分區管理介面）
- `membership-tiers` — `MembershipTiers.ts` — 6 層等級（T0 優雅初遇者 → T5 璀璨天后），前台稱號與後台分級碼分離
- `subscription-plans` — `SubscriptionPlans.ts` — 月費/年費訂閱方案
- `credit-score-history` — `CreditScoreHistory.ts` — 會員信用分數異動紀錄
- `points-transactions` — `PointsTransactions.ts` — 點數異動紀錄
- `points-redemptions` — `PointsRedemptions.ts` — 點數兌換獎品、抽獎、優惠券
- `member-segments` — `MemberSegments.ts` — 會員分群資料與歷史

### 訂單管理（6）
- `orders` — `Orders.ts` — 訂單紀錄（含出貨單列印、取貨總報表）
- `returns` — `Returns.ts` — 退貨申請審核
- `refunds` — `Refunds.ts` — 退款與折讓
- `exchanges` — `Exchanges.ts` — 換貨申請
- `shipping-methods` — `ShippingMethods.ts` — 物流商與運費規則
- `invoices` — `Invoices.ts` — ECPay 電子發票（開立/查詢/作廢/折讓）

### 內容管理（3）
- `blog-posts` — `BlogPosts.ts` — 部落格文章
- `pages` — `Pages.ts` — 活動一頁式 Section Builder，**10 種 block**：`hero-banner` / `rich-content` / `image-gallery` / `product-showcase` / `cta` / `faq` / `testimonial` / `countdown` / `video` / `divider`
- `ugc-posts` — `UGCPosts.ts` — UGC 聚合（IG / FB / 手動匯入）

### 行銷自動化（6）
- `marketing-campaigns` — `MarketingCampaigns.ts` — 行銷活動與排程
- `message-templates` — `MessageTemplates.ts` — 多管道訊息模板
- `ab-tests` — `ABTests.ts` — A/B 測試實驗
- `marketing-execution-logs` — `MarketingExecutionLogs.ts` — 發送與互動紀錄
- `festival-templates` — `FestivalTemplates.ts` — 節慶/假日模板
- `birthday-campaigns` — `BirthdayCampaigns.ts` — 會員生日月 5 階段自動化

### 行銷工具（2）
- `automation-journeys` — `AutomationJourneys.ts` — 14 種自動化流程定義
- `automation-logs` — `AutomationLogs.ts` — 自動化執行紀錄

### 客服管理（1）
- `customer-service-tickets` — `CustomerServiceTickets.ts` — AI + 真人客服工單

### VIP 管家服務（1）
- `concierge-service-requests` — `ConciergeServiceRequests.ts` — T5 璀璨天后私人生活管家請求

### 遊戲系統（3）
- `mini-game-records` — `MiniGameRecords.ts` — 小遊戲遊玩紀錄
- `card-battles` — `CardBattles.ts` — 抽卡比大小對戰房間
- `game-leaderboard` — `GameLeaderboard.ts` — 排行榜與徽章（unique: player + period + periodKey）

### 合作夥伴（1）
- `affiliates` — `Affiliates.ts` — 合作夥伴分潤資料

### 媒體資源（1）
- `media` — `Media.ts` — 圖片/影片/檔案上傳

---

## 3. Globals（15 個）

### 頁面內容（5）
- `global-settings` — 全站通用（客服、追蹤碼、金流、Cookie 同意）
- `homepage-settings` — 首頁所有區塊內容
- `navigation-settings` — 公告橫幅 + 主選單連結
- `about-page-settings` — 關於我們頁面區塊
- `faq-page-settings` — FAQ 分類與問答
- `policy-pages-settings` — 服務條款 / 隱私權 / 退換貨 / 購物說明

### 會員 / 點數 / 推薦（4）
- `loyalty-settings` — 點數計算、各等級權益、兌換規則、遊戲次數
- `referral-settings` — 推薦碼獎勵、等級加成、防濫用
- `point-redemption-settings` — 到期提醒、限時活動、消耗心理學參數
- `recommendation-settings` — 智能加購、交叉銷售、推薦權重

### CRM / 分群（2）
- `crm-settings` — 信用分數權重、自動化、AI 客服、通知模板
- `segmentation-settings` — 分群演算法權重、門檻、排程

### 行銷 / 金流 / 遊戲（3）
- `marketing-automation-settings` — （description 未抓到，待補）
- `invoice-settings` — ECPay 連線、賣方資訊、自動化
- `game-settings` — （description 未抓到，待補）

---

## 4. 前台頁面（47 個 Route）

### 商品與購物（9）
| Route | File | 備註 |
|---|---|---|
| `/` | `(frontend)/page.tsx` | 首頁（用 `homepage-settings`） |
| `/products` | `products/page.tsx` | 商品列表（ProductListClient） |
| `/products/[slug]` | `products/[slug]/page.tsx` + `ProductDetailClient.tsx` | **PDP**。Phase 4 Task 1 重點檔 |
| `/collections` | `collections/page.tsx` | 分類總覽 |
| `/collections/[slug]` | `collections/[slug]/page.tsx` | 分類頁 |
| `/cart` | `cart/page.tsx` | 購物車（用 `cartStore`） |
| `/wishlist` | `wishlist/page.tsx` | 追蹤清單（用 `wishlistStore`） |
| `/checkout` | `checkout/page.tsx` | 結帳 |
| `/checkout/success/[orderId]` | `checkout/success/[orderId]/page.tsx` | 訂單成功頁 |

### 會員中心（16）
所有在 `(frontend)/account/**` 下：`/account`、`/orders`、`/wishlist`、`/addresses`、`/settings`、`/crm-dashboard`、`/points`、`/referrals`、`/invoices`、`/subscription`、`/marketing`、`/analytics`、`/concierge`、`/returns`、`/reviews`、`/segments`

### 認證（3）
- `/login`, `/register`, `/admin-login`

### 內容（5）
- `/blog`, `/blog/[slug]` — 部落格
- `/pages/[slug]` — CMS 活動頁（用 Pages collection 的 Section Builder）
- `/about`, `/faq` — 用對應 globals

### 政策頁（5）
- `/terms`, `/privacy-policy`, `/return-policy`, `/shopping-guide`, `/packaging` — 都用 `policy-pages-settings` global

### Partner（4）
- `/partner`, `/partner/earnings`, `/partner/withdraw`, `/partner/referrals`

### 遊戲（3）
- `/games`, `/games/card-battle`, `/games/[slug]`

### 其他（2）
- `/membership-benefits`, `/diag`（診斷頁）

---

## 5. API Routes（32 個）

**注意**: Payload 本身會自動為 collection 產生 REST + GraphQL，這些是**額外**的自訂路由。

### CRM (`/api/crm/*`)
- `ai-chat`, `analytics`, `credit-score`, `dashboard`, `journeys`
- `members`, `members/[id]`
- `segments`

### 行銷 (`/api/marketing/*`)
- `ab-tests`, `campaigns`, `campaigns/[id]`
- `dashboard`, `festivals`, `send-message`, `templates`

### 發票 / 訂單 (`/api/invoices/*`, `/api/order-print`)
- `invoices`, `invoices/[id]`, `invoices/[id]/pdf`
- `order-print` — 出貨單列印

### VIP 管家 (`/api/concierge/*`)
- `concierge`, `concierge/[id]`

### 遊戲 (`/api/games/*`)
- `games`, `games/card-battle`, `games/leaderboard`

### 公開 API (`/api/v1/*`)
- `points`, `products`, `recommendations`, `ugc`

### 匯入 / 工具 (`/api/*`)
- `sinsang` — Sinsang Market 單商品抓取
- `shopline-import` — Shopline 抓取
- `migrate-images` — 圖片遷移
- `ai-dm` — AI 訊息
- `order-print` — 列印

### Payload 內建（無需自寫）
- `/api/(payload)/[...slug]` — 所有 collection 的 REST CRUD
- `/api/(payload)/graphql` + `/graphql-playground`

---

## 6. Custom Endpoints（掛在 Collections 上）

位置 `src/endpoints/`，透過 `Products.ts` 的 `endpoints: []` 陣列注入：
- `importExport.ts` — `createExportEndpoint()` + `createImportEndpoint()`，可掛到任何 collection 做 CSV/XLSX 匯入匯出（目前只掛在 Products）
- `revalidateAll.ts` — `POST /api/products/revalidate-all`，強制重新生成 `/`、`/products` 快取
- `shoplineXlsxImport.ts` — `POST /api/products/shopline-xlsx`，專門處理 Shopline BulkUpdateForm.xlsx（`dryRun=1` 預覽、`dryRun=0` 寫入）

---

## 7. Access Control（`src/access/`）

| Helper | 規則 |
|---|---|
| `isAdmin` | 只有 `user.role === 'admin'` |
| `isAdminFieldLevel` | 同上，用於 field 層級（例如限制 role 欄位） |
| `isAdminOrPartner` | admin 或 partner |
| `isAdminOrSelf` | admin 看全部，其他人只看 `id = self.id`（回傳 Where 讓 Payload 轉 SQL） |
| `isLoggedIn` | 任何登入使用者 |

**Products 的 read 規則比較特別**（在 `Products.ts` 內 inline）：admin 看全部，非 admin 只看 `status=published`。

---

## 8. 關鍵 Hooks / 機制

### Revalidate 機制（前後台同步的核心）
- `src/lib/revalidate.ts` — `revalidateProduct()` + `safeRevalidate()` 封裝
- `Products.ts` 的 `afterChange` / `afterDelete` 自動呼叫 `revalidateProduct(slug)`
- `SizeCharts.ts` 的 `afterChange` / `afterDelete` 呼叫 `safeRevalidate(['/products'], ['products', 'size-charts'])`
- `products/[slug]/page.tsx` 用 `export const dynamic = 'force-dynamic'` **強制每次 SSR**，再配合 revalidate tag 確保後台編輯即時反映前台

### Media URL 正規化
- `src/lib/media-url.ts` → `normalizeMediaUrl()` + `getMediaUrl()`
- 作用：Payload 存的 `/api/media/file/X` 改寫為 `/media/X`（Cloudflare Tunnel 下 binary response 會失敗）
- **所有前台渲染 media URL 都該走這個 util**

### Product `beforeChange` 驗證
- 特價 < 原價（否則 APIError）
- 變體 SKU 不可重複
- 自動計算 `isLowStock` + 覆蓋 `stock` 為變體總和

---

## 9. Admin 客製化（`src/components/admin/`）

### Product list 頁的 `beforeListTable` 注入（Products.ts L63-85）
6 個面板依序：
1. `ProductBulkActions` — 批次上架/下架/revalidate
2. `ShoplineXlsxImporter` — Shopline BulkUpdateForm.xlsx 匯入（dry-run + commit）
3. `SinsangImporter` — Sinsang Market 單商品抓取
4. `ShoplineImportPanel` — Shopline 一般匯入（**有 Task 3 的 grid 爆版 bug，5 處要改**）
5. `ImageMigrationPanel` — Shopline CDN 圖片遷移（**有 Task 3 的 grid 爆版 bug，1 處要改**）
6. `ImportExportButtons` — 通用 CSV/XLSX 匯入匯出

### 其他未讀的 admin component
- `Dashboard` / `FinancialDashboard` / `OrderToolsPanel` / `VariantMatrixGenerator` / `AdminLogo` / `AdminIcon`

---

## 10. Stores（Zustand）

- `src/stores/cartStore.ts` — 購物車（PDP 和 /cart 共用）
- `src/stores/wishlistStore.ts` — 追蹤清單（PDP Heart 按鈕 + /wishlist）

**注意**: 這兩個 store 本次對話沒讀過，實作細節未知。

---

## 11. 我（Claude）的理解深度圖

不是所有區塊都一樣清楚。改動前請先確認：

### ✅ 深入（可直接改）
- Products collection 所有欄位和 hooks
- SizeCharts collection
- PDP 前台（ProductDetailClient.tsx + page.tsx）
- Shopline xlsx importer
- Media URL 正規化邏輯
- Access control helpers
- Lexical RichText renderer

### 🟡 知道結構（改前要先讀）
- 其他 33 個 collection 的檔案本體（只看過 slug + description + group）
- 15 個 global 的實際 fields
- Pages 的 10 種 block 內部結構
- 47 個前台 route 的實作
- 32 個 API route 的實作
- `cartStore` / `wishlistStore`
- 其他 admin component（Dashboard / FinancialDashboard 等）

### ❌ 完全不知道
- 部署架構（testshop.ckmu.co 怎麼 build / deploy）
- `DEPLOYMENT.md` 內容
- Turso / SQLite 生產環境配置
- 任何 seed / migration 的實際內容
- 金流 / ECPay 整合
- AI 推薦引擎（`recommendationEngine.ts`）
- Next.js / Tailwind 客製化（`next.config.mjs` / `tailwind.config.ts`）

---

## 12. 改檔前的 Checklist

在這個專案動任何程式碼之前：

1. **看 group**：要改的區塊屬於哪個 admin group？對應哪個 collection / global？
2. **讀 schema**：改 UI 之前先讀對應的 `collections/*.ts` 或 `globals/*.ts` 確認 field 名稱與型別
3. **查 revalidate**：如果改後台資料會影響前台，確認有沒有 `afterChange` hook 觸發 revalidate
4. **看 access**：改 endpoint 或 collection 時，確認 `access` 規則是否合理
5. **Lexical → 走 RenderLexical**：任何用 richText 欄位的地方都用同一套 renderer
6. **Media URL → 走 normalizeMediaUrl**：不要直接用 Payload 回傳的 URL
7. **Dev server 驗證**：`preview_start chickimmiu-next` → 改 → 觀察 `preview_logs` `level: error`

---

## 13. 常用指令 / 路徑速查

```bash
# Dev server
preview_start chickimmiu-next  # port 3001

# Git
git status --short             # 先看工作區狀態
git diff <file>                # 看特定檔案的改動

# 查 schema
src/collections/*.ts           # 35 個 collection
src/globals/*.ts               # 15 個 global

# 查前台
src/app/(frontend)/**/page.tsx # 47 個 route

# 查 API
src/app/api/**/route.ts        # 32 個自訂 API
src/app/(payload)/api/         # Payload 內建

# Utils
src/lib/media-url.ts           # URL 正規化
src/lib/revalidate.ts          # Revalidate 封裝
src/access/*.ts                # 4 個 access helper
src/stores/*.ts                # cart + wishlist
```

---

## 14. 文件索引

- `PHASE4_HANDOFF.md` — Phase 4 進度與 Task 3 細節
- `DEPLOYMENT.md` — 部署（未盤點）
- `README.md` — 專案說明（未盤點）
- `SITE_MAP.md` — 本文件

---

**備註**: 這份文件是**掃描式盤點**的結果 — 我只看了每個 collection 的 slug / description / group，以及 admin group 分類。**實際欄位、hook、access、relationship 都沒有深入讀**。需要改哪個 collection 就去讀哪個，不要依賴這份 SITE_MAP 的一句話描述。
