# CHIC KIM & MIU — Phase 4 交接文件

> 臨時交接文件，Phase 4 完成後可刪除（或加進 .gitignore）。
> 用途：跨對話傳遞任務脈絡，避免重新解釋。
> **最後更新**: 2026-04-16 — Phase 4 完成、Phase 5.1 Batch 1 完成、加入 Cloudflare Tunnel 部署事實

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

## 🚧 Task 3 — 後台 CSS 爆版修復（TODO，下個對話做）

**根本原因（已診斷完成）**: CSS Grid `1fr` 的 implicit minimum 是 `auto`（= min-content），長 SKU / 長顏色名會撐爆 grid child 寬度，連帶把父容器推寬，導致 Payload admin 的 `.css-n9qnu9` grid 被 content 推得錯位遮字。

**修復方式**: 把以下 5 處的 `1fr` 改成 `minmax(0, 1fr)`

| # | 檔案 | Line | 原 grid | 改成 |
|---|---|---|---|---|
| 1 | `src/components/admin/ShoplineImportPanel.tsx` | 888 | `repeat(5, 1fr) auto` | `repeat(5, minmax(0, 1fr)) auto` |
| 2 | `src/components/admin/ShoplineImportPanel.tsx` | 406 | `repeat(4, 1fr)` | `repeat(4, minmax(0, 1fr))` |
| 3 | `src/components/admin/ShoplineImportPanel.tsx` | 578 | `repeat(3, 1fr)` | `repeat(3, minmax(0, 1fr))` |
| 4 | `src/components/admin/ShoplineImportPanel.tsx` | 686 | `repeat(4, 1fr)` | `repeat(4, minmax(0, 1fr))` |
| 5 | `src/components/admin/ImageMigrationPanel.tsx` | 229 | `repeat(3, 1fr)` | `repeat(3, minmax(0, 1fr))` |

最關鍵的是 **#1（line 888）** — 那是 6 欄變體 grid（顏色/尺寸/價格/庫存/SKU/移除），SKU 欄最容易長。

**不要**直接寫 custom CSS 去蓋 `.css-n9qnu9`，那是 Payload 自己的 hashed class，build 後會變。從根源修 grid 才是正解。

**驗證方式**: 改完後打開後台 `/admin/collections/products`，展開 Shopline Import Panel 填幾個長 SKU（例如 `SSM-97970160-黑色-XXXL`），觀察整個面板不再爆版。

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

**⏸️ Batch 2 — 會員/忠誠度 globals（SKIPPED 2026-04-16，等 Phase 5.5 完成後回來補）**

跳過原因：套用前置驗證原則後，4 個 global 全部不滿足條件 → 加 hook 會是 NOP 死代碼。

| Global | 原計畫對應頁 | 實際狀況 |
|---|---|---|
| `LoyaltySettings` | `/membership-benefits`, `/account/points` | `/membership-benefits` const TIERS hardcoded；`/account/points` 是 `'use client'` 整頁 hardcoded |
| `ReferralSettings` | `/account/referrals` | `'use client'` + hardcoded `DEMO_REFERRAL`/`DEMO_HISTORY`/`TIER_BONUSES` |
| `PointRedemptionSettings` | `/account/points` | 同上，client + hardcoded |
| `RecommendationSettings` | `/products` | `force-dynamic` + `getPayload().find()` 直接打 DB，不吃 Next fetch cache |

驗證證據：
- 全站 grep `slug: 'xxx-settings'` 在 `src/app/` → 4 個 global 在前台 page.tsx **零引用**
- 真實使用點僅 `Orders.ts` hook、`ProductReviews.ts` hook、`/api/v1/recommendations` API route — 都不吃 Next fetch cache

**Phase 5.5 完成後回來做**：那時前台會真的 fetch 這些 global，hook 才有實際效果。

**🚧 Batch 3 — 其餘 globals + 公開 collections（TODO，10 檔）**
動手前**必須**套用「前置驗證原則」對每個目標檔做 grep + read：
- 5 globals: `CRMSettings`, `SegmentationSettings`, `MarketingAutomationSettings`, `InvoiceSettings`, `GameSettings`
- 5 collections: `BlogPosts`, `Pages`, `UGCPosts`, `MembershipTiers`, `SubscriptionPlans`

⚠️ 預期至少有 5 個會也是 NOP（CRM/Segmentation/MarketingAutomation/Invoice/Membership 都跟 Batch 2 同 pattern：account 頁是 client + hardcoded）。BlogPosts / Pages / UGCPosts 比較可能真的是 SSR fetched，但仍要驗證。

**🚧 Batch 3 — 其餘 globals + 公開 collections（TODO，10 檔）**
- 5 globals: `CRMSettings`, `SegmentationSettings`, `MarketingAutomationSettings`, `InvoiceSettings`, `GameSettings`
- 5 collections: `BlogPosts`, `Pages`, `UGCPosts`, `MembershipTiers`, `SubscriptionPlans`

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

#### 📌 Phase 5.3 — DailyCheckIn 打卡 bug 🟡 已診斷未修

使用者反映：「打卡好像會一次打兩天卡」

**已讀 `src/components/gamification/DailyCheckIn.tsx`（2026-04-16 對話 2）**

**現有保護沒問題**：
- timezone-aware：`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })` → 'YYYY-MM-DD'
- `alreadyCheckedToday = todayTpe === lastDate` guard（[L70](src/components/gamification/DailyCheckIn.tsx:70)）
- `handleCheckIn` early return: `if (allDone || alreadyCheckedToday) return`（[L73](src/components/gamification/DailyCheckIn.tsx:73)）
- 跨午夜：modal `open` useEffect 重抓 storage + 重算 todayTpe

**真實 bug — 跳天累加（最可能就是「打兩天卡」的本體）**：

```
4/15 簽 Day 1 → days=[0], lastDate='4/15'
4/16 沒簽
4/17 開 modal → todayTpe='4/17' ≠ lastDate='4/15' → alreadyCheckedToday=false
→ 點按鈕 → days=[0,1]   (誤算為連續第 2 天，但中間斷了 1 天)
```

**修法**：在 `handleCheckIn` 開頭加：
```ts
const daysSinceLastCheckIn = state.lastDate
  ? Math.floor((Date.parse(todayTpe) - Date.parse(state.lastDate)) / 86_400_000)
  : 0
const newDays = (state.lastDate && daysSinceLastCheckIn > 1)
  ? [0]                                    // reset 連續，從 Day 1 重新算
  : [...state.days, todayIndex]            // 連續或第一次：照常 push
```

**不用查的「bug」**：
- 同一天 record 兩次：guard 已防
- React Strict Mode 重複觸發：useEffect idempotent
- 跨裝置不同步：localStorage 設計如此

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

#### 📌 Phase 5.5 — 前台 Hardcoded 接通 Global（Phase 5.1 Batch 2 的前置） 🚧 進行中

**進度 (2026-04-16)**：
- ✅ Commit 0 — schema 擴充（Users.gender + MembershipTiers.frontNameMale + PointsRedemptions type 加 styling/charity/mystery + migration `20260416_140000_add_gender_and_male_tier_name`）
- 🚧 Batch A — membership-benefits 接通 MembershipTiers collection
- 🚧 Batch B — account/points 接通 LoyaltySettings + PointRedemptionSettings + PointsRedemptions + PointsTransactions + user
- 🚧 Batch C — account/referrals 接通 ReferralSettings + user referral data

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
- `expiringPoints` 顯示為 0（完整 FIFO/LIFO 點數到期算法另做）
- `/account/referrals` 的 `totalReward` 用 `completedReferrals × (signupReward + purchaseReward)` 近似
- `UGC_TESTIMONIALS` 在 /account/points 維持硬寫（PointRedemptionSettings.ugcTestimonials 目前只有 enabled/maxDisplay）

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
