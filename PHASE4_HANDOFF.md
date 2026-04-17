# CHIC KIM & MIU — Phase 4 交接文件

> 臨時交接文件，Phase 4 完成後可刪除（或加進 .gitignore）。
> 用途：跨對話傳遞任務脈絡，避免重新解釋。
> **最後更新**: 2026-04-16 — Phase 5.7 完成（DailyCheckinGame UI 接通 API，消費 data.streak + 落實 streakReset/streakBonus 顯示）

---

## 🛑 每個 Phase Claude 開場必讀 + 結尾必做

### 開場必讀（依序）
1. 本檔案（尤其「部署架構」和你負責的 Phase section）
2. `SITE_MAP.md`
3. `MEMORY.md`（`.claude/` 的用戶偏好與規則）
4. 與你 Phase 直接相關的 source file

### 結尾必做（不可省略）
每個 Phase Claude 結束一個 batch 或 phase 前，**必須**：
1. 更新本檔案對應 section：把 🚧 TODO 改成 ✅ DONE，或加入「進行中的發現」
2. 若發現新事實（架構、風險、陷阱），加進「架構關鍵事實」section
3. Commit 時把 `PHASE4_HANDOFF.md` 一起 stage 進去（單一 commit 包含 code + handoff 更新）
4. 在 commit message 註明「updates PHASE4_HANDOFF.md」

**違反後果**：下個 Claude 不知道你做到哪、會重複盤點、使用者會重覆解釋一樣的背景。

---

## 🏗️ 部署架構（2026-04-16 發現，關鍵事實）

**`testshop.ckmu.co` 不是雲端部署，而是把本機電腦透過 Cloudflare Tunnel 暴露出去。**

| 項目 | 實際狀態 |
|---|---|
| Prod host | 使用者本機電腦（Windows） |
| Prod URL | `https://testshop.ckmu.co` |
| Tunnel 軟體 | `cloudflared`（已裝在 `C:\Program Files (x86)\cloudflared\`） |
| Tunnel 憑證 | `C:\Users\mjoal\.cloudflared\49879c4b-691b-4698-b48b-f6a990055494.json` |
| Tunnel 設定 | `C:\Users\mjoal\.cloudflared\config.yml` |
| Tunnel 路由到 | `http://localhost:3001`（Next.js dev / start server） |
| Git remote | `github.com/mjoalen-dotcom/chickimmiu.git` — **只是備份用，沒接 auto-deploy** |
| Prod DB | 尚未確認（Phase 5.4 要查 `.env` 的 `DATABASE_URI`，可能是 Turso 或本機 SQLite） |

**重要推論：**
- 「testshop.ckmu.co Host Error」的真實原因 = 本機 dev server 死掉 → tunnel 找不到 listener → CF 回 Host Error
- **不需要「部署」任何東西** — git commit 不會觸發任何外部 build/deploy
- Prod 要更新 = 本機 dev/start server 持續跑 + tunnel 持續跑，就自動反映最新 code
- Push 到 GitHub 不影響 prod 內容（GitHub 只是備份）

**歷史痕跡（確認之後不要清除）：**
- `next.config.mjs` 有 `serverExternalPackages: ['libsql', '@libsql/client']` — Vercel 時期加的，但對 Turso runtime 仍然需要，**不要刪**
- `package.json` 有 `libsql` / `@libsql/client` 依賴 — 如果 prod DB 是 Turso 就需要，**不要刪**
- commit `55d8aa0` / `71cd250` 提到 Vercel — **不要 rewrite history**
- `DEPLOYMENT.md` 有舊 Vercel 章節 — **Phase 5.4 負責更新**，其他 Phase 不動

**絕對不要做：**
- ❌ `git pull/push/rebase/reset` —— local 與 origin/main 已 diverged（local 多 3 commits、origin 多 4 commits）
- ❌ 改 `.claude/launch.json`（已配成 `next dev`，未 tracked）
- ❌ 清 Vercel / libsql 相關 code 或 deps
- ❌ rewrite git history

---

## 專案

- 路徑: `C:\Users\mjoal\ally-site\chickimmiu`
- 技術: Payload CMS v3 + Next.js 15.4.11
- Dev server: port 3001（`preview_start` with `chickimmiu-next`，launch.json 已配 `next dev`）

## 目前進度

- ✅ Stage 1-5 完成
- ✅ Phase 3 Shopline xlsx importer（已 wire 到 `Products.ts`，dry-run 測試 1488 rows → 500 products OK）
- 🚧 **Phase 4** — Task 1 + 2 完成、Task 3 待做

---

## ✅ Task 1 — PDP 前台對齊（DONE）

**檔案**: `src/app/(frontend)/products/[slug]/ProductDetailClient.tsx`

改動摘要：
- 刪除 `fabricInfo` 解構（原本讀 `product.fabricInfo` — 路徑根本是錯的，實際 schema 是 `product.sourcing.fabricInfo`，內部欄位不該露到前台）
- 改解構 Phase 1 公開欄位：`material` / `careInstructions` / `stylingTips` / `modelInfo` / `sizeChart`
- `sizeChart` 用 `typeof === 'object'` 守衛（page.tsx 用 `depth: 2` populate，有可能是 object / id / null）
- **尺寸表動態化**：讀 `sizeChart.measurements[].label` + `sizeChart.rows[].values[]`，表頭會跟著 `sizeChart.unit`（cm/inch）顯示單位，空的時候顯示「尚未設定尺寸表」提示
- **商品資訊表格**：移除 `fabricInfo.thickness/transparency/elasticity/madeIn` 這 4 個內部欄位；`fabricInfo.material` 換成 `product.material`；新增 `productOrigin` + `brand` 兩行
- **洗滌說明動態化**：有 `careInstructions` 就用 `whitespace-pre-line` 渲染；沒有就 fallback 到原本的 4 條預設文字
- **新增 modelInfo 卡片**：height / weight / wearingSize / bodyShape，4 格 grid，任一欄位有值才顯示整張卡
- **新增 stylingTips 卡片**：單段文字，whitespace-pre-line

---

## ✅ Task 2 — RichText Upload feature（DONE）

**檔案 1**: `src/payload.config.ts`
```ts
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
// ...
editor: lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
    UploadFeature({ collections: { media: { fields: [] } } }),
  ],
}),
```

**檔案 2**: `src/app/(frontend)/products/[slug]/ProductDetailClient.tsx`
- `LexicalNodeRenderer` 新增 `case 'upload'`（L97-143）
- 自動判斷 `mimeType?.startsWith('video/')` 決定 `<video>` 或 `<Image>`
- 用 `normalizeMediaUrl(value.url)` 處理 CDN URL
- 安全 fallback：`!value || !src` 直接 return null

---

## ✅ Task 3 — 後台 CSS 爆版修復（DONE 2026-04-16，Phase 5.6.1）

**根本原因**: CSS Grid `1fr` 的 implicit minimum 是 `auto`（= min-content），長 SKU / 長顏色名會撐爆 grid child 寬度，連帶把父容器推寬，導致 Payload admin 的 `.css-n9qnu9` grid 被 content 推得錯位遮字。

**修復方式（已執行）**: 以下 5 處 `1fr` → `minmax(0, 1fr)`

| # | 檔案 | Line | 改動 |
|---|---|---|---|
| 1 | `src/components/admin/ShoplineImportPanel.tsx` | 888 | `repeat(5, minmax(0, 1fr)) auto` — **6 欄變體 grid（顏色/尺寸/價格/庫存/SKU/移除），SKU 欄最容易長，最關鍵** |
| 2 | `src/components/admin/ShoplineImportPanel.tsx` | 406 | `repeat(4, minmax(0, 1fr))` — 解析結果 4 格 StatCard |
| 3 | `src/components/admin/ShoplineImportPanel.tsx` | 578 | `repeat(3, minmax(0, 1fr))` — 3 step InstructionCard |
| 4 | `src/components/admin/ShoplineImportPanel.tsx` | 686 | `repeat(4, minmax(0, 1fr))` — 展開列的 4 格 metadata（摘要/重量/SEO/…） |
| 5 | `src/components/admin/ImageMigrationPanel.tsx` | 229 | `repeat(3, minmax(0, 1fr))` — Summary Stats 3 格 |

**驗證**:
- `preview_start chickimmiu-next` → `/admin/collections/products` GET 200（4823 modules 編譯通過，含 ShoplineImportPanel + ImageMigrationPanel）
- Grep `repeat\([0-9]+,\s*1fr\)` 在 `src/components/admin` 無殘留
- 視覺驗證由使用者自己在 `/admin/collections/products` 展開 Shopline Import Panel 填長 SKU（例如 `SSM-97970160-黑色-XXXL`）觀察

**Commit**: `fix(admin): prevent grid blowout from long SKUs (updates HANDOFF)` — 本對話單一 commit，含 2 code 檔 + PHASE4_HANDOFF.md

**刻意不做**:
- 沒寫 custom CSS 蓋 `.css-n9qnu9`（Payload 自己的 hashed class，build 後會變）—— 從根源修 grid 才是正解
- 沒碰 Phase 5.4 P4 的 41 個 untracked/modified（另一條工作線）

---

## 關鍵檔案（全部用 Read tool 打開就可以接續）

- `src/app/(frontend)/products/[slug]/ProductDetailClient.tsx` — PDP 主檔（Task 1 改動位置）
- `src/app/(frontend)/products/[slug]/page.tsx` — 已用 `depth: 2`
- `src/payload.config.ts` — Task 2 已改
- `src/collections/Products.ts` — schema（Tab 4 穿搭資訊有 material/careInstructions/modelInfo/stylingTips/sizeChart）
- `src/collections/SizeCharts.ts` — sizeChart 結構（measurements[] + rows[] + unit）
- `src/components/admin/ShoplineImportPanel.tsx` — Task 3 主要改動位置
- `src/components/admin/ImageMigrationPanel.tsx` — Task 3 次要改動位置

## Commit 紀錄

- Task 1 + Task 2 已 commit（詳見 `git log` 最新 commit）

## 下個對話的開場白範例

> 接續 Phase 4 Task 3。讀 `PHASE4_HANDOFF.md` 裡的「Task 3」section，用 Edit tool 改那 5 處 `1fr` → `minmax(0, 1fr)`，然後 `preview_start chickimmiu-next` 驗證 compile。完成後我會自己開後台驗證視覺。

---

## 🚧 Phase 5 — 全站同步機制大補（TODO，開新對話做）

### 診斷（2026-04-16 發現）

整個專案的 revalidate 覆蓋率嚴重不足：
- **35 個 Collections，只有 7 個有 revalidate hook**（Products, Media, Categories, SizeCharts, Orders, Returns, ProductReviews）
- **15 個 Globals，0 個有 revalidate hook** 🚨

結果：使用者改後台 → DB 有新值 → 但 Next.js Server Component fetch cache **永遠不失效** → 前台顯示舊資料。

這就是本次對話使用者反覆抱怨「前後台不同步」的**真正結構根因**。

### Phase 5 分四個子階段（建議各別一個對話處理）

#### 📌 Phase 5.1 — Revalidate 覆蓋率修復（進行中）

**前置發現（2026-04-16）**:
- 全站 fetch 零使用 `next:{tags:[...]}` → `revalidateTag` 無效，全改 `revalidatePath`
- `/packaging` 是純靜態頁（hardcoded const），不從 policy global 讀 → 不 revalidate
- NavigationSettings / GlobalSettings 影響全站 layout → 需 `revalidatePath('/', 'layout')` 才會失效子路由的 HTML cache，為此在 `src/lib/revalidate.ts` 新增 `revalidateLayout()` helper

**🔑 前置驗證原則（每個 Batch 必做）**:
動手前先 grep + read 對應前台 page.tsx，確認：
1. 該 global / collection 的 slug 真的有被前台 SSR page 引用（`Grep "slug:\s*['\"]xxx-settings"` in `src/app`）
2. 引用方式是吃 Next.js fetch cache 的（`fetch()` 走 cache；`getPayload().find()` 直接打 DB **不吃** cache）
3. 頁面 render mode（`force-dynamic` + `getPayload` = 不需要 revalidate；ISR + fetch = 需要）
4. 不是 `'use client'` 整頁 hardcoded const

若 (1)-(4) 任一不滿足 → 加 hook 是 NOP 死代碼，**跳過並記錄原因**，等前台真正接通再回來補。

**✅ Batch 1 — 公開頁面 globals（DONE，6 檔）**
| Global | revalidate |
|---|---|
| `HomepageSettings` | `safeRevalidate(['/'])` |
| `AboutPageSettings` | `safeRevalidate(['/about'])` |
| `FAQPageSettings` | `safeRevalidate(['/faq'])` |
| `PolicyPagesSettings` | `safeRevalidate(['/terms','/privacy-policy','/return-policy','/shopping-guide'])` |
| `NavigationSettings` | `revalidateLayout()` |
| `GlobalSettings` | `revalidateLayout()` |

驗證：6 路徑全部 200，TS compile 零錯，Payload schema 正常載入。

**✅ Batch 2 — 會員/忠誠度 globals（DONE 2026-04-16 對話 5，3/4 加 hook / 1 跳過）**

原 2026-04-16 對話 1 套用前置驗證原則後，4 個 global 全部為 NOP → 全部跳過。Phase 5.5 Batch B/C 把前台接通後，3 個 global 升級成真實 SSR consumer，本對話補上 hook。

| Global | 前台 consumer | 狀態 |
|---|---|---|
| `LoyaltySettings` | `/account/points` 走 `getPayload().findGlobal({ slug: 'loyalty-settings' })` | ✅ 加 hook（本對話完成） |
| `PointRedemptionSettings` | `/account/points` 走 `getPayload().findGlobal({ slug: 'point-redemption-settings' })` | ✅ 加 hook（本對話完成） |
| `ReferralSettings` | `/account/referrals` 走 `getPayload().findGlobal({ slug: 'referral-settings' })`（Phase 5.5 Batch C） | ✅ 加 hook（本對話完成） |
| `RecommendationSettings` | `/products` 仍是 `force-dynamic` + `getPayload().find()` | ⏸️ 繼續跳過（`force-dynamic` 模式下 revalidatePath 無效；若將來改成 ISR 再補） |

**加 hook 內容**（3 檔皆相同 pattern）：
- `LoyaltySettings.ts` — `afterChange: [() => safeRevalidate(['/account/points'], ['loyalty-settings'])]`
- `PointRedemptionSettings.ts` — `afterChange: [() => safeRevalidate(['/account/points'], ['point-redemption-settings'])]`
- `ReferralSettings.ts` — `afterChange: [() => safeRevalidate(['/account/referrals'], ['referral-settings'])]`

**驗證**：preview server 啟動，3 個 SSR consumer 路由全部編譯 + GET 200：`/membership-benefits`（MembershipTiers + 順帶非 consumer 但 sanity 用）、`/account/points`（LoyaltySettings + PointRedemptionSettings）、`/account/referrals`（ReferralSettings）— 無 TS / hook import 錯。

**原始跳過證據（保留參考）**：
- 當時全站 grep `slug: 'xxx-settings'` 在 `src/app/` → 4 個 global 在前台 page.tsx **零引用**
- 真實使用點僅 `Orders.ts` hook、`ProductReviews.ts` hook、`/api/v1/recommendations` API route — 都不吃 Next fetch cache

**✅ Batch 3 — 其餘 globals + 公開 collections（DONE 2026-04-16 對話 3，10 檔驗證、2 加 hook / 8 跳過）**

10 個目標都套用前置驗證原則（grep `src/app` + read SSR page fetch mode）後的分類：

| # | 目標 | SSR 引用 | 決策 | 原因 |
|---|---|---|---|---|
| 1 | `BlogPosts` | `/blog`、`/blog/[slug]`、`/`（home 穿搭誌）全走 `getPayload().find()` | ✅ 加 hook | 真實 SSR consumer；slug-aware（`revalidateBlog(slug)` 含 prevSlug rename 路徑） |
| 2 | `Pages` | `/pages/[slug]` 走 `getPayload().find()` | ✅ 加 hook | 真實 SSR consumer；slug-aware（`revalidateCustomPage(slug)` 含 prevSlug rename 路徑） |
| 3 | `UGCPosts` | 只有 `/api/v1/ugc` + `gameActions.ts` ；home 的 `<UGCGallery>` 是 `'use client'` 靠該 API | ❌ 跳過 | hook 無法 invalidate client fetch；沒有 SSR consumer |
| 4 | `MembershipTiers` | Phase 5.5 Batch A (`499672e`) 接通 `/membership-benefits` 走 `getPayload().find()` | ✅ 加 hook（follow-up commit） | Batch A ship 後 Batch 3 做 follow-up；非 slug-aware（整頁列全部 tiers） |
| 5 | `SubscriptionPlans` | 全站零引用 | ❌ 跳過 | 沒有 consumer |
| 6 | `CRMSettings` | `src/app` 零引用 | ❌ 跳過 | 沒有 SSR consumer |
| 7 | `SegmentationSettings` | `src/app` 零引用 | ❌ 跳過 | 沒有 SSR consumer |
| 8 | `MarketingAutomationSettings` | `src/app` 零引用 | ❌ 跳過 | 沒有 SSR consumer |
| 9 | `InvoiceSettings` | `src/app` 零引用 | ❌ 跳過 | 沒有 SSR consumer |
| 10 | `GameSettings` | `src/app` 零引用 | ❌ 跳過 | 沒有 SSR consumer |

**加 hook 檔案**：
- `src/collections/BlogPosts.ts` — `revalidateBlog(slug)` helper（paths: `/`, `/blog`, `/blog/[slug]`；tag: `blog-posts`），`afterChange` + `afterDelete` 含 prevSlug 處理
- `src/collections/Pages.ts` — `revalidateCustomPage(slug)` helper（paths: `/pages/[slug]`；tag: `pages`），`afterChange` + `afterDelete` 含 prevSlug 處理
- `src/collections/MembershipTiers.ts` — follow-up commit（Batch A ship 後補）；paths: `/membership-benefits`；tag: `membership-tiers`；non-slug-aware

**驗證**：preview server 編譯 `/blog` (621ms) + `/pages/[slug]` (1036ms) + `/membership-benefits` (306-567ms) 成功，GET 200 無 TS / import error。

**Phase 5.1 整體進度**：
- ✅ Batch 1：6 檔（公開 globals）
- ✅ Batch 2：3/4 檔加 hook（LoyaltySettings / PointRedemptionSettings / ReferralSettings），1 檔跳過（RecommendationSettings — `/products` 仍是 `force-dynamic`，hook NOP）
- ✅ Batch 3：3/10 檔加 hook（BlogPosts、Pages、MembershipTiers），7 檔跳過（NOP）
- 📝 **未來再做**：剩 8 個跳過目標等相關前台接通再補（4 個無 SSR consumer + 1 force-dynamic / RecommendationSettings + UGCPosts 改 SSR / SubscriptionPlans 接通即可）

**刻意不加 hook 的 collections**（純後台 / log / 私有資料）：
Users, Exchanges, Refunds, Invoices, CreditScoreHistory, PointsTransactions, PointsRedemptions, MemberSegments, ConciergeServiceRequests, CustomerServiceTickets, MarketingCampaigns, MessageTemplates, ABTests, MarketingExecutionLogs, FestivalTemplates, BirthdayCampaigns, AutomationJourneys, AutomationLogs, MiniGameRecords, CardBattles, GameLeaderboard, ShippingMethods, Affiliates

#### 📌 Phase 5.2 — 關鍵 Collection 的 Seed Data ✅ DONE (2026-04-16 對話 3)

**實際寫入結果**：
- `pnpm seed:core` 執行成功 — 無 error
- `MembershipTiers`: 6 updated（6 層 T0-T5 都已存在於 DB，被 seed 覆蓋為官方值）
- `ShippingMethods`: 8 created（全新建立）
- DB 檔 `data/chickimmiu.db` mtime = 2026-04-16 16:41，與 seed log 時間戳一致

**交付檔案**：

| 檔案 | 內容 |
|---|---|
| `src/seed/data/membershipTiers.ts` | 6 層 T0-T5 完整資料：slug / frontName / 升級門檻（5k → 300k）/ 折扣（0-15%）/ 點數倍率（1-3x）/ 抽獎（0-10 次/月）/ 升級贈點（0-5000）/ 生日禮 / 專屬優惠券 / 色碼 |
| `src/seed/data/shippingMethods.ts` | 8 種運送：711 / 全家 / 萊爾富 / 黑貓 / 新竹 / 郵政 / 自取 / DHL（含 trackingFlow 步驟）。DHL `isActive:false` 預設關閉 |
| `src/seed/seedCore.ts` | runner，**upsert by unique key**（tiers by slug、shipping by name），`--dry-run` flag |
| `package.json` | 新增 `pnpm seed:core` + `pnpm seed:core:dry` |

**🔥 關鍵 bug 修復 — top-level await（2026-04-16 對話 3）**

**原始症狀**：`pnpm seed:core:dry` 印完 `initializing payload...` 就靜默 exit(0)，沒有 error / stack。`unhandledRejection` / `uncaughtException` / `main().catch()` 全沒觸發。

**根因**（從 `node_modules/payload/dist/bin/index.js` 實際讀出）：

- `payload run` 的 `run` 子指令內部只做 `await import(scriptPath)`（L74）—— 這**只等** module 的 top-level 同步執行與 top-level `await`，**不等** fire-and-forget 的 promise。
- `bin()` 在 `runBinScript` return 後，在 L51 直接 `process.exit(0)`。
- 原 seedCore.ts 末尾是 `main().catch(...)` —— module top-level 同步跑完、`main()` 被 kick off 回傳 pending promise、沒人等 → import resolve → payload exit(0) → `main()` 的 `await getPayload()` 被半路殺掉。

**修法**（src/seed/seedCore.ts 最末尾一行）：
```ts
// 錯誤（fire-and-forget）：
main().catch((e) => { ... })

// 正確（top-level await，讓 payload run 的 await import() 等 main 跑完）：
await main().catch((e) => { ... })
```

此修法**通用於所有用 `payload run` 跑的 custom script** — 未來寫 seed / migration / one-off script 時務必用 top-level await，否則會遇到一樣的靜默 exit。

**設計決策（不要重新討論）**：
- ❌ 不走 afterInit auto-seed（每次 dev 重啟會跑 + 覆蓋手改）
- ✅ upsert by unique key，再跑安全
- ⚠️ 後台手改某筆後**不要再跑 seed**（會被覆蓋回 seed 值）

**後續相關 phase**：
- Phase 5.5 要接通 `MembershipTiers` 到 `/membership-benefits` 前台頁，現在 seed 完有真實資料可以接

#### 📌 Phase 5.3 — DailyCheckIn 打卡 bug ✅ DONE（2026-04-16 對話 3）

使用者反映：「打卡好像會一次打兩天卡」

**修復前的元件實況**（澄清前次交接的誤述）：
原版 `src/components/gamification/DailyCheckIn.tsx` **完全沒有時區判斷**，localStorage schema 只有 `[0, 1, 2]` 一個純 index 陣列，沒有 `lastDate`。守門只有元件內 `justChecked` flag，這個 flag 只活在 modal 當前 open 期間 —— 關掉 modal 重開就重設 → 同一天可以連續打到 7 天滿。

**修法（已實作）**：
- 加入 `getTaipeiDateString()` 用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })` 取「今日 (Taipei) YYYY-MM-DD」
- localStorage schema 改為 `{ days: number[], lastDate: string }`，舊的純 array 自動相容（讀為 `lastDate=''`，使用者下次按鈕點擊就會寫入新格式）
- `useEffect` deps 從 `[]` 改成 `[open]`：每次開 modal 重抓 storage + 重算 today，解決 23:59→00:01 重開的 stale-state
- 按鈕 disable 條件改為 `alreadyCheckedToday = todayTpe !== '' && state.lastDate === todayTpe`
- UI 加上「今日已簽到」+「明日 Asia/Taipei 00:00 後再來」提示

**驗證（preview_eval 模擬狀態機）**：
- 同日連點 3 次 → 只記 1 天 ✅
- 跨日（昨天 `[0]` + 今天）→ `days=[0,1]`，`lastDate` 更新 ✅
- 跨午夜 UTC 16:30 → Taipei 00:30 隔天，formatter 正確 ✅
- 舊 array schema → 讀為 `{days, lastDate:''}`，可立刻打卡 ✅
- 7 天滿後 → `reason='all_done'` ✅

**架構發現（2026-04-16）— `gamification/` 5 個元件全部 orphaned，只 `CardBattle` 有被 import**：
```
src/components/gamification/
├── CardBattle.tsx         ← 唯一被掛載的（/games/card-battle/page.tsx）
├── DailyCheckIn.tsx       ← orphan（本次修復對象，但目前無 user path 觸發）
├── FashionChallenge.tsx   ← orphan
├── ScratchCard.tsx        ← orphan
└── SpinWheel.tsx          ← orphan
```
真正在 `/games/[slug]` 跑的是 `src/components/games/DailyCheckinGame.tsx`，**那個是純 demo（每次 refresh streak 重設為 3，連 localStorage 都沒有）**。所以使用者報的「打兩天卡」**現實中沒有 user path 會觸發**——可能是 code review 推測，或從 `DailyCheckinGame` 看到 streak 跳數誤認。

**Phase 5 後續決策（待用戶決定）**：
- 是否要把 `gamification/DailyCheckIn` 接到 `/games/daily-checkin` 取代純 demo 版？
- 或反過來，把 `DailyCheckinGame` 改成接 `/api/games` checkin action（需先修 gameEngine 的 UTC bug）？

#### 📌 Phase 5.3.1 — 跳天 streak reset ✅ DONE（2026-04-16 對話 6）

`DailyCheckIn` 跳天累加但不重設 streak 的行為問題：

```
4/14 簽 Day 1 → days=[0], lastDate='2026-04-14'
4/15 沒簽
4/16 開 modal → alreadyCheckedToday=false（不同日）→ 可以按
→ days=[0, 1]，但這應該算「連續中斷重來」=> Day 1，不是 Day 2
```

**最終修法（commit pending）**：採「render-time derived state」而非 mutation 分支，讓按鈕 label / 日曆格在使用者按下前就反映重設：

```ts
const dayDiff = state.lastDate && todayTpe
  ? Math.floor((Date.parse(todayTpe) - Date.parse(state.lastDate)) / 86_400_000)
  : 0
const willResetStreak = state.lastDate !== '' && dayDiff > 1
const effectiveDays = willResetStreak ? [] : state.days

const todayIndex = effectiveDays.length        // 用 effective 而非 state
const handleCheckIn = () => {
  if (allDone || alreadyCheckedToday) return
  const wasReset = willResetStreak
  const newDays = [...effectiveDays, effectiveDays.length]
  ...
  setShowStreakReset(wasReset)                // UI flash
}
```

**為何選 derived state 而非簡單 `[0]` 寫死**：handoff 原本提示在 `handleCheckIn` 內計算，但這樣會出現 UX bug — 按鈕在按下前還顯示「簽到 Day 3」（用舊 `state.days.length`），點下去卻變 Day 1。改用 derived `effectiveDays`，render 階段就把舊 streak 視為清空，按鈕直接顯示「簽到 Day 1」、日曆格不再 highlight 之前的勾，按下去也對。

**新增 UI**：alreadyCheckedToday 區塊在 `showStreakReset === true` 時顯示一行紅字「連續中斷，已從 Day 1 重新開始」。`showStreakReset` 是元件 state（非 storage），每次 modal open 重置（`useEffect(open)`），所以只有「剛剛那次按下因 reset」的 modal session 才看得到。

**驗證**：preview_eval 跑 8 個 scenarios 全綠（first-time / consecutive / **skip→reset** / same-day reopen / Day 7 後連續日仍鎖 / Day 7 後跳天可開新 cycle / legacy bare array 向後相容 / 長期沒簽 reset）。`tsc --noEmit` 維持原 3 個 Phase 5.4/5.5 遺留錯誤，`DailyCheckIn.tsx` 沒新錯。

**副作用（pre-existing 問題的意外修復）**：完成 Day 7 後若 2+ 天沒簽，現在會自動 reset 開新 cycle（之前是「本週已全部簽到」永久鎖）。連續日（Day 7→Day 8）仍維持鎖，留給未來 weekly-cycle reset 機制。

**不用查的「bug」**：
- 同一天 record 兩次：✅ 已防（Phase 5.3 修復）
- React Strict Mode 重複觸發：useEffect idempotent
- 跨裝置不同步：localStorage 設計如此
- 元件仍是 orphan：無 user path 觸發，留待未來決定接 `/games/daily-checkin` 或刪

#### 📌 Phase 5.4 — Cloudflare Tunnel 部署健檢

**⚠️ 若 Prompt 4 跟這裡不一致，以本檔案為準**（Prompt 4 發出後才有以下新發現）。

**前置發現（2026-04-16，Phase 5.4 開工前已釐清）：**

1. **`testshop.ckmu.co` 不是雲端部署** —— 是 Cloudflare Tunnel 指到本機 port 3001。**原 Prompt 4 假設「Vercel / VPS / Fly.io」都錯**，看本檔頂部「部署架構」section 的正確資訊。
2. **「Host Error」真相**: 本機 dev server 被誤殺（前次對話刪了 `.next/` + 切 `next start`→`next dev` 時掛了）→ tunnel 找不到 listener → CF 回 Host Error。**不是 prod 掛了，是 tunnel target 空了。**
3. **Git remote = GitHub 備份**（`github.com/mjoalen-dotcom/chickimmiu.git`），**沒接 auto-deploy**。push 不會觸發 prod 更新。
4. **使用者本機 Phase 4 commits 已自動「上線」** —— 只要 dev server 一跑 + tunnel 一跑，testshop.ckmu.co 就會看到 `b2374ba` 的改動（richContent 圖片渲染、14 天鑑賞期、etc.）。
5. **Cloudflared 已裝且已設定**：`C:\Program Files (x86)\cloudflared\cloudflared` + `C:\Users\mjoal\.cloudflared\config.yml` + tunnel ID `49879c4b-691b-4698-b48b-f6a990055494`。

**Phase 5.4 真正要做的事：**

| # | 任務 |
|---|---|
| 1 | 讀 `C:\Users\mjoal\.cloudflared\config.yml` 確認 tunnel 路由（是否真的指 `http://localhost:3001`） |
| 2 | 讀 `.env` / `.env.example` 的 `DATABASE_URI` — 是本機 `file:./data/chickimmiu.db` 還是 Turso URL？ |
| 3 | 跑 `tasklist \| findstr cloudflared` + `netstat -ano \| findstr :3001` 確認 tunnel / dev server 進程 |
| 4 | 跑 `curl -I https://testshop.ckmu.co` 確認對外 200 |
| 5 | 重寫 `DEPLOYMENT.md`：刪 Vercel 章節、加 tunnel 實際架構 + runbook（dev server 如何常駐、tunnel 如何自動啟動、斷線怎麼復原） |
| 6 | 評估：是否該把 cloudflared + next dev 做成 Windows 服務，避免使用者登出後掛掉 |

**絕對不要做：**
- 不要 rewrite git history 清 Vercel commits（55d8aa0 / 71cd250）
- 不要刪 `libsql` / `@libsql/client` deps
- 不要動 `next.config.mjs` 的 `serverExternalPackages`
- 不要 `git pull/push`（diverged 狀態，需使用者親自決定策略）
- 不要動 `.claude/launch.json`（本機用，已配 `next dev`）

**交付：**
- DEPLOYMENT.md 更新版
- 健檢報告：tunnel / dev server / prod DB 狀態
- Runbook：開機自動啟動方案（Task Scheduler / NSSM / pm2-windows-service）
- 在本檔 Phase 5.4 section 標記 `✅ DONE` 並寫進發現

#### 📌 Phase 5.5 — 前台 Hardcoded 接通 Global（Phase 5.1 Batch 2 的前置） ✅ DONE (2026-04-16 對話 4)

**進度 (2026-04-16)**：
- ✅ Commit 0 `22fad0f` — schema 擴充（Users.gender + MembershipTiers.frontNameMale + PointsRedemptions type 加 styling/charity/mystery + migration `20260416_140000_add_gender_and_male_tier_name`）
- ✅ Batch A `499672e` — membership-benefits 接通 MembershipTiers collection（SSR 驗證通過，6 tier 正確讀出）
- ✅ Batch B `b59ad6d` — account/points 接通 5 source（未登入正確 redirect，SSR 清淨）
- ✅ Batch C `<下一個>` — account/referrals 接通 ReferralSettings + user referral data（SSR 清淨，redirect 正常）

**⏭️ 下個對話要做（未完成）**：
- ~~`MembershipTiers` 加 revalidate hook~~ ✅ 已完成於 commit `7f09c22`
- ~~Phase 5.1 Batch 2（3 個 global hook × 5 行）~~ ✅ 已完成於 2026-04-16 對話 5（LoyaltySettings / PointRedemptionSettings / ReferralSettings）
- ~~**手填男性稱號**~~ ✅ 已完成於 2026-04-16 對話 5：6 個 `frontNameMale` 加進 `src/seed/data/membershipTiers.ts` + `pnpm seed:core` upsert 全 6 筆 update 成功（翩翩紳士 / 溫雅學者 / 雋永騎士 / 金曜貴公子 / 星耀侯爵 / 璀璨國王）
- `RecommendationSettings` 繼續跳過（`/products` 仍是 `force-dynamic` + `getPayload`，hook 無效）
- Client hydration webpack error 是 pre-existing P0，見 `HANDOFF_PHASE5.4.md`

**Batch A 接通欄位對照**（`/membership-benefits`）：
| UI 顯示 | DB 欄位 |
|---|---|
| 稱號（女/預設） | `frontName` |
| 稱號（男性登入） | `frontNameMale` fallback `frontName` |
| Lv.N | `level + 1`（DB 0-5 → UI 1-6） |
| 累計消費 | `minSpent` |
| 購物折扣 | `discountPercent` |
| 點數倍率 | `pointsMultiplier` |
| 免運門檻 | `freeShippingThreshold` |
| 月抽獎次數 | `lotteryChances` |
| 生日禮（顯示「專屬好禮」） | `Boolean(birthdayGift)` |
| 專屬優惠券 | `exclusiveCouponEnabled` |
| Tailwind 顏色 | 前端 lookup map by `slug`（不進 DB） |

**Batch B 接通欄位對照**（`/account/points`）：
| UI | Source |
|---|---|
| 會員點數 | `user.points` |
| 購物金 | `user.shoppingCredit` |
| 當前等級顯示名 | `user.memberTier.frontName / frontNameMale`（gender-aware） |
| 當前倍率 | `user.memberTier.pointsMultiplier` |
| 即將到期點數 | **先 0**（TODO：FIFO/LIFO aggregation） |
| 商城商品 | `points-redemptions` where `isActive=true` sort `sortOrder` |
| Badge（限量/熱門/驚喜/…） | 依 `point-redemption-settings.scarcity` 動態計算 |
| 紀錄 | `points-transactions` where `user=self` sort `-createdAt` limit 20 |
| 等級權益表 | `membership-tiers` sort `level` |
| UGC 見證 | 前端硬寫（schema 未擴 ugcTestimonials.items） |

**Auth 模式**（`/account/**` 共用）：
```ts
const { user } = await payload.auth({ headers: await nextHeaders() })
if (!user) redirect('/login?redirect=/account/X')
```

**Batch C 接通欄位對照**（`/account/referrals`）：
| UI | Source |
|---|---|
| 推薦碼 | `user.referralCode` |
| 推薦連結 | client 端 `window.location.origin + linkSettings.linkPrefix + code`（避免 server host detection） |
| 等級顯示名 | `user.memberTier.frontName / frontNameMale`（gender-aware） |
| 等級加成倍率 | `referral-settings.tierBonus.{slug}Multiplier` |
| 推薦人數 | `users.totalDocs` where `referredBy=self` |
| 累計獎勵 | ✅ Phase 5.5.2：`SUM(points-transactions.amount)` where `user=self AND source='referral'`，net SUM 內含 refund_deduct 抵扣 |
| 本月剩餘次數 | `monthlyReferralLimit - count(referredBy=self, createdAt >= 月初)` |
| 推薦紀錄清單 | `users` where `referredBy=self` sort `-createdAt` limit 20（名字遮罩 `王**`） |
| 獎勵規則文案 | `referral-settings.rewards.*` |
| 等級加成表 | `membership-tiers` level > 0 ＋ `tierBonus.{slug}Multiplier` |

**關鍵設計決策**：
- 男性稱號：`MembershipTiers.frontNameMale` 獨立欄位，綁定 level / slug（後台隨時可改名，不只是文字替換）
- 性別 fallback：`user.gender === 'male' && tier.frontNameMale` → 男性稱號；其他一律 `frontName`（含 female / other / 未填）
- 前台禁用金屬分級名（「銅牌/銀牌/…」）— 全部顯示 frontName 或 frontNameMale
- Tailwind 顏色 lookup map by slug 放前端（不進 DB）

**建議男性稱號**（需你到後台手填，seed 卡關不碰）：
| slug | level | frontName (女/預設) | frontNameMale (建議值) |
|---|---|---|---|
| ordinary | 0 | 優雅初遇者 | 翩翩紳士 |
| bronze | 1 | 曦漾仙子 | 溫雅學者 |
| silver | 2 | 優漾女神 | 雋永騎士 |
| gold | 3 | 金曦女王 | 金曜貴公子 |
| platinum | 4 | 星耀皇后 | 星耀侯爵 |
| diamond | 5 | 璀璨天后 | 璀璨國王 |

**本 Phase 簡化（TODO 留給未來）**：
- ~~`expiringPoints` 顯示為 0（完整 FIFO/LIFO 點數到期算法另做）~~ ✅ Phase 5.5.4 — FIFO 到期點數計算（見下方 section）
- ~~`/account/referrals` 的 `totalReward` 用 `completedReferrals × (signupReward + purchaseReward)` 近似~~ ✅ Phase 5.5.2 已改為 SUM real PointsTransactions（見下方 Phase 5.5.2 section）
- ~~`UGC_TESTIMONIALS` 在 /account/points 維持硬寫~~ ✅ Phase 5.5.3 — schema 擴 `ugcTestimonials.items[]` + 前端接通（見下方 section）

#### 📌 Phase 5.5.4 — FIFO 到期點數計算 ✅ DONE（2026-04-17 對話 7）

Phase 5.5 Batch B 把 `/account/points` 接通 PointsTransactions collection，但 `userProfile.expiringPoints` / `expiringDays` 硬寫 0（TODO 留著）。Closed beta 上線後補上真正的 FIFO 算法。

**業務規則（user 2026-04-17 確認）**：
1. 點數有效期 = **createdAt + 365 天**（從 `LoyaltySettings.pointsConfig.pointsExpiryDays` 讀，fallback 365，0 = 永不過期）
2. **忽略** `PointsTransactions.expiresAt` 欄位（保留在 schema 但不參與計算）
3. Warning window = `PointRedemptionSettings.expiryNotification.reminderDays[].days` 的最大值（fallback 30 天）
4. `expiryNotification.enabled === false` 或 `showCountdown === false` → 回傳 {0, 0}

**FIFO 演算法（`computeExpiringPoints(txns, validityDays, windowDays)`）**：
- 交易按 `createdAt` ASC 排序
- `amount > 0`（earn / positive admin_adjust）→ 新 batch 入池 `{ createdAtMs, remaining }`
- `amount < 0`（redeem / expire / refund_deduct / negative admin_adjust）→ 從最舊 batch 開始 FIFO 扣除
- 篩選 live batches：`remaining > 0` **且** `createdAtMs + validity > now`（仍未實際過期）
- 篩選 window 內 batches：`createdAtMs + validity <= now + window`
- `expiringPoints` = window 內 batches 的 remaining 總和
- `expiringDays` = 最早 batch 距今的到期天數（`Math.ceil`）

**修法（1 檔）**：

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `src/app/(frontend)/account/points/page.tsx` | 加 `computeExpiringPoints` 本地 helper；Promise.all 加第 6 個 query（`points-transactions` where `user=self AND createdAt >= now-730d`，`sort: 'createdAt'`，`pagination: false`）；讀 `LoyaltySettings.pointsConfig.pointsExpiryDays` + `PointRedemptionSettings.expiryNotification.reminderDays/enabled/showCountdown`；填入 `userProfile.expiringPoints/expiringDays` |

**設計決策**：
- **730 天 cutoff**：只拉近 2×validity 天的交易（365 天前的點數已過期，保 2 倍餘量）。避免老帳號 10 年歷史全拉出來
- **`pagination: false`**：一次拉完 < 730 天全部 txns。活躍會員一年幾百筆，兩年千餘筆可接受
- **讀 admin settings 而非 hardcode**：closed beta 期間 admin 可調整 `pointsExpiryDays` / `reminderDays`，不用改 code
- **Helper 放 inline 在 page.tsx**（與 `pickTierName` / `computeBadge` / `formatDate` 同檔）而非抽 `src/lib/points/`：目前只有此頁使用，抽 lib 是過早抽象。未來若 admin panel 或 email 通知要用，再抽
- **不動 `expiresAt` schema**：user 說用 createdAt + 固定天數推導。`expiresAt` 欄位繼續存在（往後若要按 batch 寫明確過期日可接）但 UI 算法不依賴它 → 單一 source of truth

**驗證**：
- `tsc --noEmit` 0 error
- Preview `GET /account/points` → 200，SSR HTML 含「點數中心」，server logs 無 error
- FIFO 算法 5 個測試案例 via preview_eval：
  - T1: 2 earn (1 in-window, 1 fresh), 無 spend → `{100, 25}` ✓
  - T2: 同 T1 + 50 spend（FIFO 扣最舊）→ `{50, 25}` ✓
  - T3: `validityDays=0` 永不過期 → `{0, 0}` ✓
  - T4: 只有 fresh batch → `{0, 0}` ✓
  - T5: spend > 最舊 batch（zeroed out）→ `{0, 0}` ✓

**注意事項**：
- 使用者 admin 帳號（admin@chickimmiu.com）本身沒有 points transactions → SSR 回傳 `expiringPoints=0`，UI 隱藏 banner（PointsClient.tsx:157 `{expiringPoints > 0 && ...}`）→ 正確行為
- `/account/points` 客戶端 hydration 錯誤 = **B5 BootBeacon 預先存在的 bug**（`/account/subscription` 也重現），不是本 Phase 造成。B5 待另案偵察
- 效能考量：活躍會員 2 年內 ~1000 筆 txns；Array.sort + 單次 for-loop = O(n log n) 可接受

#### 📌 Phase 5.5.3 — UGC 見證 schema 擴充 + 前端接通 ✅ DONE（2026-04-17 對話 6）

`PointRedemptionSettings.ugcTestimonials` 原本只有 `enabled` + `maxDisplay`，前台 PointsClient.tsx 用 4 筆硬寫 `UGC_TESTIMONIALS` const。

**修法（3 檔）**：

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `src/globals/PointRedemptionSettings.ts` | `ugcTestimonials.items` array field（maxRows 20，每筆 name/text/avatar/tier）。admin 描述提示「留空時前台顯示預設範例」 |
| 2 | `src/app/(frontend)/account/points/page.tsx` | 從 `redemptionRaw.ugcTestimonials` 提取 items，依 `enabled` + `maxDisplay` 切片，傳 `testimonials` prop 給 PointsClient |
| 3 | `src/app/(frontend)/account/points/PointsClient.tsx` | 新增 `TestimonialItem` type + `testimonials` prop；原硬寫改為 `FALLBACK_TESTIMONIALS`，render 用 `testimonials.length > 0 ? testimonials : FALLBACK_TESTIMONIALS` |

**設計決策**：
- **Fallback 策略**：server 端 items 為空時傳空陣列 → client 端 fallback 到 4 筆預設範例。這確保 admin 還沒填見證內容時頁面不會空白，admin 填入真實見證後自動替換。
- **不用 migration**：Global 在 dev-push（= 本專案的 prod）自動建子表。無需手動 ALTER TABLE。
- **不用 seed script**：fallback 取代了 seed 需求；admin 可隨時從後台 → 會員管理 → 點數消耗設定 → UGC 見證 → 新增見證項目。
- **ugcEnabled=false 時**：server 傳空陣列 → client 不顯示（`.map()` on empty = nothing rendered，連 fallback 也不顯示）

**驗證**：`tsc --noEmit` 乾淨、preview SSR `GET /account/points` → 200 編譯成功。

#### 📌 Phase 5.5.2 — `/account/referrals` totalReward 改為精確 SUM ✅ DONE（2026-04-17 對話 6）

**前一階段近似算法的兩個 bug**：
1. `history.slice(0, 20)` 把計算 base 卡在前 20 筆 referrals，後面的 completed 沒進累計
2. 用「現在的」settings reward 數值，不是當時實際發放給使用者的金額（settings 改了，歷史會被追溯）

**修法**：在 `Promise.all` 加第 6 個 query —— `points-transactions` where `user=self AND source='referral'`，limit 1000；`totalReward = docs.reduce((s, tx) => s + (tx.amount ?? 0), 0)`。

**為什麼用 net SUM 而非只算正數 earn**：`amount` 內建正負，refund_deduct 透過 source=referral 紀錄負數扣回（推薦人退款時推薦獎勵被收回的場景）→ net SUM 反映「目前實際入袋」。若需要顯示「累計總發放（不扣回）」可另開 query 加 `type=earn` filter。

**驗證**：
- `tsc --noEmit` 乾淨（沒新增 error）
- preview SSR `GET /account/referrals` → 200 編譯成功，新 query + reduce 無 runtime error
- preview_eval 跑 6 case reduce 邏輯全 pass：empty / single / multiple / 含負數 / amount missing fallback / 1000 docs 上限

**未來進一步**（不在 5.5.2 scope）：
- 想顯示「累計獎勵」與「淨獎勵」雙欄位 → 加 `type=earn` filter 取 gross
- limit:1000 達上限的高階使用者 → 分頁 SUM 或 raw SQL aggregate

#### 📌 Phase 5.6 — DailyCheckIn server-side streak + gameEngine TZ fix ✅ DONE (2026-04-16 對話 5)

**scope 決策（對話開頭 Q&A）**：
- Q1 Orphan 處理 → **B：升級 demo 接 API** 的**子集**：本批只做 server 端（Q1 選 B 原本含 UI，但 Q3 選「只修 server + schema, UI 不動」→ 最後 scope = B server-only）
- Q2 Streak 規格 → **保留 total + 重設 consecutive**
- Q3 UTC bug → **本批一起修**

UI (`DailyCheckinGame.tsx` 純 demo) 本批**完全不動**。使用者前台體驗維持現狀，下批才接 UI。

**實作清單**：

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `src/collections/Users.ts` | 新增 3 欄位 row：`totalCheckIns` / `consecutiveCheckIns` / `lastCheckInDate`（都 `access.update = isAdminFieldLevel`） |
| 2 | `src/migrations/20260416_193835_add_daily_checkin_streak.ts` | ALTER TABLE 加 3 欄位（`total_check_ins` INTEGER DEFAULT 0 / `consecutive_check_ins` INTEGER DEFAULT 0 / `last_check_in_date` TEXT）。**冪等**：用 PRAGMA table_info 判斷，dev-pushed 時 skip |
| 3 | `src/migrations/index.ts` | 註冊新 migration |
| 4 | `src/lib/games/gameEngine.ts` | 新增 `getTpeDateString()` / `getTpeWeeklyKey()` / `getTpeMonthlyKey()` 使用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })`。改寫 `getStartOfDay()` / `getEndOfDay()` 用 TPE。`updateLeaderboard` 的 `dailyKey` / `weeklyKey` / `monthlyKey` 改用 TPE helpers（**修前是 UTC，台灣 8 點以後 dailyKey 會切到隔天**） |
| 5 | `src/lib/games/gameEngine.ts` | 新增 `computeCheckinOutcome()` 純函式 + `performDailyCheckin()` async（分工：pure decision vs DB side-effects） |
| 6 | `src/app/api/games/route.ts` | `action: 'checkin'` 改呼叫 `performDailyCheckin`，response 多帶 `data.streak` |
| 7 | `src/seed/verifyPhase56CheckIn.ts` / `verifyPhase56Tz.ts` | 純邏輯驗證腳本（8 case streak + 5 case TZ，全 pass） |

**修復前的 UTC bug 細節**（現場考古）：
```ts
// BEFORE — gameEngine.ts L108-118
function getStartOfDay(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return start.toISOString() // ← 用 server 本機時區
}

// BEFORE — updateLeaderboard L392
const dailyKey = now.toISOString().split('T')[0] // ← 強制 UTC
// UTC 16:00 = Taipei 00:00 次日 → dailyKey 會切到昨天（台灣視角）
```

**本機在 Asia/Taipei 目前沒炸**（Phase 5.4 的 Cloudflare Tunnel 架構 = 本機就是 prod），但：
- `updateLeaderboard` 的 `dailyKey` 用 `toISOString()` 強制 UTC，**每天 UTC 16:00 開始 = Taipei 00:00 隔天**，Leaderboard `daily_` 紀錄會被歸到「前一天」的 periodKey（實際上 bug 存在但從 leaderboard UI 看不出來——對 consistency 無感）
- 未來搬雲端（e.g. Vercel US region）會更明顯

**Streak 邏輯決策（computeCheckinOutcome）**：
```
first time          (lastDate === '')           → consec=1, total=1
same day            (lastDate === todayTpe)     → throw '今日已簽到'
next day            (dayDiff === 1)             → consec=prev+1, total=prev+1
gap >= 2 days       (dayDiff >= 2)              → consec=1 RESET, total=prev+1, streakReset=true
7 th consecutive    (newConsec === 7)           → streakBonus=true, prize=50
else                                            → prize=10
```

**決策依據（針對 Q2 的「保留總數 + 重設 consecutive」）**：
- `totalCheckIns` 永遠累加（user 歷史總貢獻，對忠誠度有意義）
- `consecutiveCheckIns` 中斷就 reset 為 1（算當日）
- `streakReset: boolean` 回傳給 API，未來 UI 可顯示「連續中斷了」訊息
- 7 天獎勵僅在 `consec === 7` 的那一天觸發（consec >= 8 不會重複獎）

**驗證結果**（`verifyPhase56CheckIn.ts` / `verifyPhase56Tz.ts`）：
- 8 case streak 全 pass（first time / same day / next day / gap=2 / gap=3 / 7 th consec / 8 th consec / format）
- 5 case TZ 全 pass（UTC 16:00 / 15:59 / 00:00 / 年初 / 跨年）

**DB schema 套用方式**（重要）：
- SQLite `ALTER TABLE users ADD COLUMN ...` 已直接 apply 到 `data/chickimmiu.db`（via @libsql/client，避開 Payload dev-push 的 `users_avatar_idx` conflict bug）
- Migration file 寫成冪等（PRAGMA 判斷），之後 `payload migrate` 跑到會 skip
- ~~`payload_migrations` table 尚未寫入 ...~~ ✅ 已 backfill（2026-04-17，見下方 Phase 5.5.1）。`20260416_140000_add_gender_and_male_tier_name` (id=3, batch=2) + `20260416_193835_add_daily_checkin_streak` (id=4, batch=2) 補進 `payload_migrations`，prod deploy 時兩支 migration 都會 skip（既有 idempotent guard 也會二度防呆）。

#### 📌 Phase 5.5.1 — `payload_migrations` 表 backfill ✅ DONE（2026-04-17 對話 6）

兩支 migration 之前是 dev-push / `@libsql/client` 直接 apply 到 `data/chickimmiu.db`，從未經由 Payload migrate runner，所以 `payload_migrations` 沒有對應紀錄。雖然兩支現在都已冪等（PRAGMA-guarded ADD COLUMN），prod 重跑會 skip，但會留下「prod 今天才跑這兩支」的誤導性 audit trail。

**修法**：新增 `scripts/backfill-payload-migrations.mjs`，one-shot script，特性：

| 特性 | 說明 |
|---|---|
| 冪等 | `SELECT ... WHERE name = ?` 已存在就 SKIP |
| Schema-checked | INSERT 前用 PRAGMA 確認 migration 該加的欄位「實際存在」DB，否則 REFUSE。避免「假裝跑過但 schema 沒套用」的撒謊狀態 |
| 範圍最小 | 只動 `payload_migrations`，不碰任何業務 schema |
| 可參考 | 同檔案 `apply-phase1-migration.mjs` 是執行 + 紀錄合一版；這個是純紀錄版 |

**驗證**：
- 首次跑：`INSERT 20260416_140000_... (batch=2)` + `INSERT 20260416_193835_... (batch=2)` → DB 從 2 筆變 4 筆
- 二次跑：兩條都顯示 `SKIP ... already recorded as id=N` ✓

**現在 `payload_migrations` 內容**：
```
id=1  name='dev'                                       batch=-1   ← Payload dev-push sentinel
id=2  name='20260415_112142_add_size_charts'           batch=1    ← apply-phase1-migration.mjs
id=3  name='20260416_140000_add_gender_and_male_...'   batch=2    ← 本次 backfill
id=4  name='20260416_193835_add_daily_checkin_streak'  batch=2    ← 本次 backfill
```

**未來 deploy SOP**：
- 既有 prod DB（schema 已 dev-push、`payload_migrations` 也已 backfill）→ `pnpm payload migrate` 看到 0 pending → 不執行
- 全新 prod DB → `pnpm payload migrate` 會把目前 3 支照順序執行，每支 INSERT 自己的 row（batch 由 Payload 分配，與本次手 backfill 的 batch=2 編號不同無妨）

**下批要做（Phase 5.7 候選）**：
1. ~~UI 接入~~ ✅ Phase 5.7 DONE（見下方 section）
2. ~~Streak UI enhancements (streakReset / streakBonus)~~ ✅ Phase 5.7 DONE
3. ~~其他 3 個 orphan gamification/*（SpinWheel / ScratchCard / FashionChallenge）—— 同樣決定是否接 API 或刪掉~~ 🗃️ ARCHIVED（2026-04-17 對話 6）：三個檔頂部加 JSDoc `ARCHIVED` 區塊說明「無 import、與 `components/games/*Game.tsx` 全頁版的對照關係、保留理由、Phase 5.8 再定」。不 delete、不接 API。DailyCheckIn.tsx 因 Phase 5.3.1 剛修完留 inline，也暫不加 archive header（同待 Phase 5.8 決定是否 Modal surface）。
4. ~~Phase 5.5 的 `20260416_140000_add_gender_and_male_tier_name` migration 在 prod deploy 前要改成冪等~~ ✅ DONE（2026-04-17 對話 6）：rewrite 為 `columnExists` guard（PRAGMA table_info），pattern 與同日 `20260416_193835_add_daily_checkin_streak` 一致。驗證：in-memory clean DB 連跑兩次 up() 不 error + 欄位數不增；real DB（gender + front_name_male 已 dev-pushed）會 skip 兩個 ALTER。`tsc --noEmit` 僅 3 個 pre-existing Phase 5.4/5.5 error，migration 檔 type-clean。

#### 📌 Phase 5.7 — DailyCheckinGame UI 接通 API ✅ DONE (2026-04-16 對話 6)

把純 demo 的 `DailyCheckinGame.tsx`（`useState(3)` 硬寫 streak + `setCheckedIn(true)` 假動作）改成真正接 `/api/games` 的 streak 狀態 + POST checkin flow，並落實 Phase 5.3.1 留下來的 `streakReset` / `streakBonus` UI 規格。

**實作清單**：

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `src/app/api/games/route.ts` | GET handler 多回 `data.checkinState: { totalCheckIns, consecutiveCheckIns, lastCheckInDate, alreadyCheckedToday }`，從 `payload.auth` 拿到的 user 欄位直接讀出。`alreadyCheckedToday` server-side 推導（`lastCheckInDate === getTpeDateString()`），client 不用再做 TZ 判斷 |
| 2 | `src/components/games/DailyCheckinGame.tsx` | 全面重寫：初始 `useEffect` fetch GET → set streak / totalCheckIns / alreadyCheckedToday；`handleCheckin` POST `{action:'checkin'}`，消費 `data.streak.{consecutiveCheckIns,totalCheckIns,streakReset,streakBonus}` + `data.prize.amount`；新增 loading / submitting / errorMsg state；按鈕 `disabled` 條件綁 submitting 或 alreadyCheckedToday；`today 已簽到` error → set `alreadyCheckedToday=true` 鎖 UI |

**UI 分支落實**：
- **載入中**：`loading=true` → cream 灰色圓角「載入中…」（避免 FOUC，首次 GET 完成前不顯示按鈕或狀態）
- **未簽到**：`alreadyCheckedToday=false && !loading` → 金橘漸層「立即簽到」按鈕（`disabled` 綁 submitting + opacity-60）
- **剛簽到**：`alreadyCheckedToday=true && justCheckedIn=true` → 綠色卡片「今日簽到成功！獲得 N 點，連續 X 天」+ scale animation
- **已簽到（重新進入頁面）**：`alreadyCheckedToday=true && justCheckedIn=false` → 綠色卡片「今日已完成簽到 — 連續 X 天，明天再來」
- **Streak 中斷 banner** (`streakReset=true`)：金黃警示條，顯示「您中斷了連續簽到（原本 N 天），從 Day 1 重新開始」，`previousStreakBeforeReset` 在 POST 前先存下 `prevStreak`
- **7 天達成祝賀** (`streakBonus=true`)：amber 漸層卡片 + `Sparkles` icon「連續 7 天達成！獎勵 50 點」（跟 server `computeCheckinOutcome` 的 `prize.amount=50` 對齊）
- **錯誤**：非「今日已簽到」的 error 顯示在按鈕下方紅字；今日已簽到的 error 靜默 + 鎖定 UI

**週進度格子調整**：
```
streak=0 (未開始)    → 週一是「今天目標」虛線框，其他 dim
streak=3 未簽今日    → 週一二三打勾（金），週四是「今天目標」，其他 dim
streak=3 已簽今日    → 週一二三四全打勾
streak=7 已簽      → 7 天全打勾（下個 streak=8 會進下一週）
```
用 `dayOfWeekIdx = streak===0 ? -1 : ((streak-1) % 7)` 算；`alreadyCheckedToday` flag 決定目標格在當天還是次日。

**驗證**：
- `tsc --noEmit`：只剩 3 個 pre-existing errors（account/points、account/referrals、shoplineXlsxImport），本次無新增
- `GET /api/games`：回傳 `data.checkinState = { totalCheckIns:0, consecutiveCheckIns:0, lastCheckInDate:'', alreadyCheckedToday:false }`（user 剛啟用 schema，還沒簽過）
- SSR `/games/daily-checkin`：HTML 內含 `連續簽到 <!-- -->0<!-- --> 天`（real value，不是 demo 3）、`本週簽到進度`、`連續簽到獎勵` 區塊、`載入中…` 初始載入狀態
- 客戶端互動未能直接 exercise：preview 環境的 `BootBeaconCleanup` 在 FrontendLayout hydration 時遇 webpack "Cannot read properties of undefined (reading 'call')" 錯誤（layout.tsx:283），此 bug 在本 Phase 之前就存在（同 commit 前 snapshot 已復現），與本批改動無關。Server 端 API 契約 + SSR 渲染兩頭都驗過，client 邏輯 code-review 正確

**本 Phase 不做（out-of-scope）**：
- BootBeaconCleanup / layout.tsx hydration bug —— 不是本 Phase scope
- 剩下 3 個 orphan 遊戲 UI（SpinWheel / ScratchCard / FashionChallenge）
- migration idempotency 修法（Phase 5.5 gender column）

**本 Phase 不做（明確 out-of-scope）**：
- `/games/*` UI（Q3 明確）
- 3 個其他 orphan gamification/* 元件
- ~~`gameEngine.ts` 的 weekly `getDay()` 仍用 UTC 換算 TPE...~~ ✅ Phase 5.7.1 DONE（2026-04-17 對話 6）：抽出 `getTpeDayOfWeek()` Intl helper（純 TPE，無 UTC parse），`getTpeWeeklyKey()` 改用它 + 純 ms 算術。**output 完全一致**（preview_eval 跑 365 天 + 邊界時 + leap day = 369/369 match），但邏輯路徑單一化。同一 `now` Date 實例傳兩個 helper 避免 race。

#### 📌 Phase 5.7.1 — gameEngine.ts weekly getDay() 路徑統一 ✅ DONE（2026-04-17 對話 6）

純 refactor，零行為變更。原本 `getTpeWeeklyKey()` 把 TPE 日期字串硬塞回 UTC 拿 `getUTCDay()`，輸出對但邏輯混淆（TPE 字串 → UTC parse → UTC getter）。改為：

```ts
function getTpeDayOfWeek(date: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', weekday: 'short' }).format(date)
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(wd)
}

function getTpeWeeklyKey(): string {
  const now = new Date()
  const todayTpe = getTpeDateString(now)
  const dayOfWeek = getTpeDayOfWeek(now)
  const sundayMs = Date.parse(todayTpe) - dayOfWeek * 86_400_000
  return new Date(sundayMs).toISOString().slice(0, 10)
}
```

**為什麼這麼寫**：
- Day-of-week 直接走 Intl（純 TPE，不用 UTC parse 騙身分）
- 日期減法用純 ms 算術（任何 server TZ 等價，ISO date-only string 規格定義為 UTC midnight）
- 同一 `now` Date 同時傳給 `getTpeDateString` + `getTpeDayOfWeek`，避免午夜瞬間 race

**驗證**：
- preview_eval 跑舊 vs 新 impl 在 365 天 + 邊界時（23:59:59 / 00:00:01 TPE）+ 2024 leap day = **369/369 完全一致**
- 6 個 spot check（Sun→Sun / Mon→prev Sun / Sat→that week Sun / next Sun / 跨年 / 跨 leap day）全對到預期
- `tsc --noEmit` 乾淨
- `GET /api/games`（unauth）回 401 正常，無 module load error

**沒順手改的**（明確 out-of-scope）：
- Line 374 `dayDiff` 算 `Date.parse(`${todayTpe}T00:00:00Z`)` 的 `T00:00:00Z` 後綴是冗餘（ISO date-only 本來就 parse 為 UTC midnight），但 handoff 的抱怨明確只指 `getDay()`，這個算 cosmetic 不在 5.7.1 scope。

---

**原計畫（保留作參考）：**

**為什麼要做**：Phase 5.1 Batch 2 發現 4 個會員/忠誠度 global 在前台「零引用」，所有相關頁面用 hardcoded const 假資料。先做這件事，Phase 5.1 Batch 2 才有意義；否則加 hook 也是死代碼。

**Scope（3 個前台檔）：**

| 前台檔 | 目前 hardcoded const | 該接通的 source |
|---|---|---|
| `src/app/(frontend)/membership-benefits/page.tsx` | `const TIERS = [...]`（6 層會員） | `MembershipTiers` collection |
| `src/app/(frontend)/account/points/page.tsx` | `TIERS` / `SHOP_ITEMS` / `DEMO_HISTORY` | `LoyaltySettings` (multipliers/freeShipping) + `PointRedemptionSettings` (兌換規則) + `PointsRedemptions` collection (商城商品) + 登入會員的 `PointsTransactions` (歷史) |
| `src/app/(frontend)/account/referrals/page.tsx` | `DEMO_REFERRAL` / `DEMO_HISTORY` / `TIER_BONUSES` | `ReferralSettings` (各等級加成) + 登入會員的 referral 資料 |

**前置工作（每個檔開工前必做）：**
1. 讀對應 global / collection 的 schema 確認 field 名稱與型別
2. 確認 hardcoded 結構 vs DB schema 是否一致；不一致就要決定誰遷就誰
3. /account/** 頁面要 auth — 查 `getPayload().auth({ headers })` pattern（`SITE_MAP.md` 第 7 節 access 規則）

**執行步驟（每檔重複）：**
1. 把 `'use client'` 拆成 server page.tsx (fetch) + 子 client component (互動 UI)
2. server 端用 `getPayload().findGlobal(...)` / `find(...)` 拉真實資料，傳 props 給 client
3. 清掉 hardcoded const
4. 驗證：登入會員、改後台 global → 重整頁面看到新值
5. 完成後回頭跑 Phase 5.1 Batch 2 加 hook（只剩 4 個 global 加 import + hook 5 行）

**已知陷阱：**
- `/products` 是 `force-dynamic` + `getPayload` 模式 → 該模式**不吃** Next fetch cache，意味著 hook 是 NOP，除非改成 `fetch()` + ISR 才有 hook 效果。要先決定 Phase 5.5 也順便把 fetch 模式統一成可被 revalidate 的（複雜）還是維持 `force-dynamic`（不需要 hook）
- `MembershipTiers` 在 Phase 5.2 會 seed — 順序上應該 5.2 先（資料先存在）再 5.5（前台接資料）

**絕對不要做：**
- 不要把 `/products` 從 `force-dynamic` 改成 ISR — 那是另一個重構決策，需單獨討論
- 不要動 cart / wishlist / checkout（那些是 client store 模式，不歸這個 phase 管）
- 不要 push（diverged 狀態未解）

**交付：**
- 3 個前台檔接通 global / collection
- 在本檔 Phase 5.5 section 標記 `✅ DONE` 並列出每檔接通的欄位對照
- 同步在 Phase 5.1 Batch 2 section 註明「Phase 5.5 完成於 X commit，Batch 2 現在可以做了」
- 完成後若 context 還夠，順手做 Phase 5.1 Batch 2（4 個 hook 5 行 × 4 檔）
- Runbook：開機自動啟動方案（Task Scheduler / NSSM / pm2-windows-service）
- 在本檔 Phase 5.4 section 標記 `✅ DONE` 並寫進發現

### Phase 5 前置資訊（共用）

- 部署架構見本檔頂部「🏗️ 部署架構」section —— **所有 Phase 都要讀**
- 本機 dev server 已切成 `next dev`（`.claude/launch.json` 未 tracked）
- Git diverged（local 多 3 commits、origin 多 4 commits，**push 前先問使用者**）
- Context 用量超過 60% 須主動提醒使用者（規則已存 MEMORY.md）

### 交接紀律（不可省略）

每個 Phase Claude 的對話結束前**必做**：

1. **更新本檔**：把 Batch/Task 的 🚧 TODO 改成 ✅ DONE（附上 commit hash）
2. **記錄新發現**：若發現新事實或陷阱，補進本檔相關 section
3. **Commit handoff 更新**：`PHASE4_HANDOFF.md` 跟 code 改動**同一個 commit**（單次 commit 包含兩者），message 加 `(updates HANDOFF)`
4. **若 Phase 未完**：明確寫「下一步要做什麼」讓下個 Claude 接得上

**範例 commit message**：
```
feat(phase5.1-batch2): revalidate hooks for loyalty/referral globals (updates HANDOFF)
```

### Phase 5 開場白範例

> 接續 Phase 5.X。先讀 `PHASE4_HANDOFF.md` 頂部「部署架構」+ 你負責的 Phase section，然後讀 `SITE_MAP.md` + `MEMORY.md`。做完一個 batch 就更新本檔 + commit。遵守「交接紀律」four 步。
