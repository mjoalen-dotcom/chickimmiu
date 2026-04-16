# Session Handoff — 2026-04-16 (session 2)

> 接續 `HANDOFF_PHASE5.4.md`。該文件定義的 P0-P4 本次全部動過，P0/P1/P2/P3 已解，P4 做到 ~40%。

---

## ✅ 本次完成

### 改動 / commit（依序）

| Hash | 主題 | 檔案數 |
|------|------|-------|
| `908e9d5` | **[bonus]** `/terms` section 1「一、接受條款」整段文字消失 — 空 Lexical paragraph 被當有效值造成 content fallback 失效 | 1 |
| `98bdcfd` | P2 準備：`next.config.mjs` — serverExternalPackages + HTML no-store cache header | 1 |
| `4444b37` | **P1** HomepageSettings 穿搭誌「內容來源」validation — legacy `'latest'` 值自愈成 `'auto'`（beforeValidate hook） | 1 |
| `1efd0d6` | **P2** divergence decision log（你親手 commit） | 1 |
| `0b5695b` | **P3** DEPLOYMENT.md rewrite（Tunnel + SQLite reality，你親手 commit） | 1 |
| `0e11f04` | **P4 G1** Phase1 SizeCharts collection + migration + apply script | 4 |
| `cb74f85` | **P4 G2** iPad Safari 白屏 hardening（inline polyfill + /diag + global-error + BootBeacon） | 5 |
| `2e16460` | **P4 G3+G7** daily-checkin migration 補漏 + resetAdmin seed script | 3 |

### P0 webpack chunk TypeError — ✅ 解
本次開頭第一步：preview_stop + `npx rimraf .next` + preview_start chickimmiu-next。Compile 5.6s、2303 modules，`curl localhost:3001 → 200, 260KB, 120ms`。Server logs 乾淨。

### P2 Git divergence — ✅ 解
- 起點：local 23 ahead / remote 4 ahead
- 發現：遠端 4 commits 是 Vercel deployment 遺物 + 其中 `4a99a25` 是把 `src/components/home/HeroCarousel.tsx` 意外搬到根目錄的 **broken rename**，origin/main 若真的跑 build 會 import 失敗
- 本地已吸收遠端 libsql / serverExternalPackages 修正的等效內容
- 解法：force-with-lease push 覆蓋，現在 **local 0 / remote 0**，HEAD `0b5695b` → 之後又加了 `0e11f04 cb74f85 2e16460` 三個 P4 commit

### 部署側影響
無。testshop.ckmu.co 跑本機 dev server + Cloudflare Tunnel，push 是歷史線操作，使用者端零感知。

---

## ⏳ 待處理

### 🟡 Working tree 剩餘（31 M/??）
P4 還有 **G4 / G5 / G6 / G8 / G9 / G10** 沒做。下次開新對話繼續。

檔案清單（依群）：

**G4 Shopline 匯入**（3 新檔）
- `src/components/admin/ShoplineXlsxImporter.tsx`
- `src/endpoints/shoplineXlsxImport.ts`
- `src/lib/shopline/xlsxParser.ts`

**G5 Admin 商品批次工具**（2 新檔）
- `src/components/admin/ProductBulkActions.tsx`
- `src/components/admin/VariantMatrixGenerator.tsx`

**G6 revalidateAll endpoint**（1 新檔，依賴 Products.ts）
- `src/endpoints/revalidateAll.ts`

**G8 Collections schema**（5 M，大）
- `src/collections/Products.ts` (+856) — 最大，可能內部多 concerns，需先偵察再決定是否再拆
- `src/collections/Categories.ts` (+19)
- `src/collections/Media.ts` (+5)
- `src/collections/Users.ts` (+35)
- `src/migrations/index.ts`（應該已納管到 `2e16460`，再確認一次）

**G9 Frontend pages**（6 M）
- `src/app/(frontend)/about/page.tsx`
- `src/app/(frontend)/collections/[slug]/page.tsx`
- `src/app/(frontend)/pages/[slug]/page.tsx`
- `src/app/(frontend)/products/ProductListClient.tsx`
- `src/app/(frontend)/products/page.tsx`

**G10 UI / Home / 推薦 Components**（8 M）
- `src/components/home/HeroCarousel.tsx`
- `src/components/product/AlsoBoughtSection.tsx`
- `src/components/recommendation/ExitIntentPopup.tsx`
- `src/components/ugc/UGCGallery.tsx`
- `src/components/ui/CookieConsentBanner.tsx`
- `src/components/ui/FloatingChatButton.tsx`
- `src/components/ui/FloatingQuickMenu.tsx`
- `src/lib/recommendationEngine.ts`

**特 / 非分群**
- `src/app/api/games/route.ts`（M，本次盤點漏，未偵察）
- `src/app/(payload)/admin/importMap.js`（auto-generated，跟 G1/G8 一起進）
- `pnpm-lock.yaml`（跟 deps commit 一起進）
- `.claude/settings.local.json`（⚠️ **該考慮加 .gitignore**，不應進歷史）
- `PHASE5.5_PROMPT.md`（scratch 檔，Phase 5.5 做完可刪，不 commit）

### 🟢 小尾巴
- **G1 hanging thread**：`Products.ts` 的 `sizeChart` relationship 欄位還在 working tree，G8 做完才會和 collection 接上；在那之前，size-charts 功能只在 admin 側可新建，商品側未關聯。
- **HomepageSettings self-heal 驗證**：你說事後驗證。進 `/admin/globals/homepage-settings` 按儲存，檢查「穿搭誌區塊 → 內容來源」顯示為「自動（最新文章）」且 DB `mode` 變 `auto`。

---

## 🆕 新增需求 backlog（使用者收尾時追加）

### ~~N1 — 訂閱會員前台接通後端~~ ✅ DONE (2026-04-16 session 4)
**現狀偵察**：
- 後端 collection `src/collections/SubscriptionPlans.ts` **已存在**（slug `subscription-plans`，欄位含 name / slug / pricing / badge / sortOrder / isActive / isFeatured…）
- 前台 `src/app/(frontend)/account/subscription/page.tsx` 還在用 **硬寫的 `DEMO_PLANS` const**（類似 /terms 接通前的狀態）

**要做**：把 `DEMO_PLANS` 改成讀 `subscription-plans` collection（類比 `membership-benefits` 讀 `membership-tiers` 的模式，見 `499672e feat(phase5.5-a)`）。加 revalidate hook 到 SubscriptionPlans 讓後台編輯即時反映。

**邊界**：只碰 `src/app/(frontend)/account/subscription/page.tsx` + `SubscriptionPlans.ts`。不動 Users collection、不動 billing 邏輯。

**類比參考**：`/membership-benefits` 頁的接通 pattern（commit `499672e`）

**已完成**：
- `SubscriptionPlans.ts`：afterChange/afterDelete → `safeRevalidate(['/account/subscription'], ['subscription-plans'])`
- `page.tsx` 改為 async server component，`getPayload().find('subscription-plans', { where: isActive=true, sort: sortOrder, depth: 0 })`
- 新增 `SubscriptionClient.tsx` 容納 `billingCycle` / `currentPlan` 狀態 + `motion` UI（client/server 切分）
- DB 無資料時走 empty-state banner（「目前暫無訂閱方案」），避免 404 感
- 「連續訂閱里程碑」四格 + FAQ 目前仍 hardcoded（之後可接 `plan.dopamine.streakMilestones`）
- 驗證：`tsc --noEmit` 只剩 3 個 Phase 5.4/5.5 既有錯；SSR curl 200，empty-state 正確渲染
- **DB 目前沒有 active 訂閱方案** —— 需要進 admin → 會員管理 → 訂閱方案 手動建立，或日後加 seed

---

### N2 — Users collection 新增「儲值金」欄位
**概念區分**：
- **購物金 (shoppingCredit)** — 平台贈送（簽到、推薦、生日等），**不可退現**，只能抵扣。**已有欄位**在 Users.ts:257。
- **儲值金 (wallet / cashCredit / storedValue — 名字由你定)** — 使用者**真金白銀儲值進來**，**可退現**。**新欄位**。

**要做**：
1. Users collection 加欄位（建議放在 points / shoppingCredit 那一 row 旁邊，Tab 2 Membership & Points）
2. 寫 migration（參考 `20260416_193835_add_daily_checkin_streak.ts` 的 PRAGMA table_info 冪等 pattern）
3. 決定欄位名稱 —— 中文建議 `儲值金餘額`，英文欄位名建議 `storedValueBalance` 或 `cashWalletBalance`
4. （可選）考慮是否需要類比 `PointsTransactions` 的 `WalletTransactions` collection 做儲值/提領流水

**規模評估**：欄位本身很小；migration 也小；WalletTransactions 若做是中等規模（需 collection + endpoint + admin UI）。建議**先做 1+2+3 最小切片**，帳務流水之後再擴。

**⚠️ 風險提示**：退現功能牽涉金流、發票作廢、會計對帳 —— 這只是**加欄位**，不含真正退現 UI / 流程。使用者若日後要實作退現 API，要先確認金流 partner、發票對應、UI 審核 flow。當下先只加欄位 + migration。

---

## 🏗️ 架構備忘（延續前次 + 新學到的）

### 延續
- 本機 `pnpm dev -p 3001` + Cloudflare Tunnel → testshop.ckmu.co
- SQLite file `data/chickimmiu.db`（37MB）
- `.cloudflared/config.yml` 路由定義
- 新 persist store 必加 `skipHydration: true` + Providers 手動 rehydrate

### 本次新增
- **iPad Safari 白屏**的四件式防禦（inline polyfill + BootBeacon + global-error + /diag）已上線
- **next.config.mjs HTML pages 加 no-store cache header**，避免 stale HTML 對到死 chunk hash
- **Payload richText 空 paragraph 坑**：使用者在 admin 點開但沒填 richText 欄位，Payload 會存 `{ root: { children: [{ type: 'paragraph', children: [] }] } }`，這是 truthy object 但渲染出來是空白。`src/lib/getPolicySettings.ts` 的 `isLexicalEmpty()` helper 是通用防呆（三個 policy 頁共用）。未來若其他地方也做 richContent + content 雙欄位共存設計，記得 reuse 這 helper。
- **Payload field-level 自愈 hook 模式**：`hooks.beforeValidate: [({ value }) => normalize(value)]` 把 legacy 舊值在存檔前 normalize 進合法 option，比 `validate` 擋下使用者好得多。將來做 legacy enum 遷移優先考慮這個模式。

---

## 📋 下次新對話開場 prompt

```
接續 CHIC KIM & MIU 專案。請先讀 HANDOFF_PHASE5.5.md 了解上次對話完成什麼、
剩什麼。重點：P0-P3 全解，P4 做到 G1-G3+G7，剩 G4/G5/G6/G8/G9/G10 加一些雜項。

本次對話結束時新增兩個需求 N1（訂閱接通）+ N2（儲值金欄位）在 HANDOFF
「新增需求 backlog」段。

今天想做（二選一或多選，告訴我優先序）：

    A. 清 working tree —— 繼續 P4 剩下的群（G4 / G5 / G6 / G8 / G9 / G10）。
       強烈建議從 G8 Products.ts 偵察下手（856 行 diff、可能要拆子群）。

    B. 新功能 N1 —— 接通訂閱頁 DEMO_PLANS → 讀 subscription-plans collection。
       類比 membership-benefits 接通 pattern（commit 499672e）。

    C. 新功能 N2 —— Users 加儲值金欄位 + migration。
       注意：購物金（平台送、不退現）vs 儲值金（真金白銀、可退現）要區分。
       先最小切片只加欄位 + migration，不做退現 UI / 金流。

    D. 其他 —— 你自己說。

規則（同前）：
- Context 60% 警告
- 偵察優先、改動最少
- 不要自己做：git push / pull / merge / rebase / reset、pnpm build
- 大檔（>500 行 diff）先偵察邊界再決定分群，不要一口氣 commit
- richText / select field 的 legacy 值問題優先考慮 beforeValidate hook 自愈
- 新需求若會跨 working tree 的 M 檔（例如 N2 要改的 Users.ts 已是 M，
  N1 要改的 subscription/page.tsx 沒 M），動手前先確認 working tree 既有
  M 是否相關，避免我把別的 in-progress 改動誤帶進 commit
```

---

**本次對話 context 結束估 ~70%**。P0/P1/P2/P3 清算完畢 + P4 前哨 3 commit 落袋 + 1 bonus fix。
