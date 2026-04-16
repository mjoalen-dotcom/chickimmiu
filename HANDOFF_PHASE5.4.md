# Phase 5.4 Handoff — 2026-04-16

## ✅ 本次對話已完成

### 1. 診斷：testshop.ckmu.co 502 Bad Gateway 根因
- **部署架構**：本機 `pnpm dev -p 3001` + **Cloudflare Tunnel (cloudflared named tunnel)** → `testshop.ckmu.co`
  - Tunnel config: `C:\Users\mjoal\.cloudflared\config.yml`
  - hostname `testshop.ckmu.co` → `service: http://127.0.0.1:3001`（正確對應）
- **502 根因**：跑 `pnpm dev -p 3001` 的 terminal 意外被關，port 3001 空著 → cloudflared 連不到本機 → 502
- **修復方式**：重新啟動 dev server（已由 preview_start 啟動，serverId `7f4b76d9-19eb-483b-8040-e6e91c226e7c`）

### 2. Fix：Navbar 購物車徽章 Hydration Mismatch（方案 B：skipHydration + 手動 rehydrate）
- **改動檔案**（3 個）：
  - `src/stores/cartStore.ts` — 加 `skipHydration: true`
  - `src/stores/wishlistStore.ts` — 加 `skipHydration: true`
  - `src/components/layout/Providers.tsx` — 加 `useEffect` 手動 rehydrate
- **驗證結果**：
  - Console **沒有** "Hydration failed" / "didn't match" 訊息
  - `hydrationErrors: 0`（DOM 無 Next.js hydration error overlay）
  - SSR 輸出不變（cart server-side 本來就是空）
- **Commit（建議）**：見下方 commit 指令

---

## ⏳ 待處理項目（優先序）

### 🔴 P0：Webpack chunk Runtime TypeError（尚未解決）
**症狀**：Claude Desktop webview 看到 `Runtime TypeError: Cannot read properties of undefined (reading 'call')` @ `_next/static/chunks/webpack.js:704`，React mounted: NO，顯示 `src/app/global-error.tsx` fallback。

**已驗證不是什麼**：
- ❌ 不是 code bug（dev server compile 成功、no red in logs）
- ❌ 不是 hydration mismatch（本次已修，console 乾淨）

**強烈懷疑是**：
- `.next` cache stale。dev server 跑很久、HMR 多次 "unrecoverable error → full reload"，chunk manifest 和 chunk 檔對不上
- Claude Desktop Electron webview 的 HTTP cache 殘影（`next.config.mjs` 已改 HTML `no-store` 但 Electron 不吃）

**建議修法**（下個對話第一步）：
1. `preview_stop` serverId `7f4b76d9-19eb-483b-8040-e6e91c226e7c`
2. `rimraf .next` 或 `pnpm devsafe`（package.json 有定義）
3. 重新啟動 dev server
4. 換 **標準 Chrome / Edge** 開 `http://localhost:3001` 和 `https://testshop.ckmu.co` hard reload（Ctrl+Shift+R）→ 確認是否就是 Claude Desktop webview 的 cache 問題

⚠️ **注意**：重啟期間 `testshop.ckmu.co` 會 502 大約 30-60 秒（dev server compile 時間）。

### ✅ P1：HomepageSettings Global — 穿搭誌區塊「內容來源」validation 已修（2026-04-16 已驗證）

**原症狀**：Payload admin 更新任何 HomepageSettings 欄位時報 `The following field is invalid: 穿搭誌區塊 → 內容來源`。

**根因**：`c98919a` 加了 custom `validate` 把非 `auto/manual` 當 error，但 DB 舊資料 `style_journal_section_mode` 是 legacy 值 `'latest'`，導致每次存檔都被擋。

**修法**：commit `4444b37 fix(homepage-settings): self-heal legacy styleJournalSection.mode values` 把 `validate` 換成 field-level `beforeValidate` hook，任何非 `auto/manual` 值自動 normalize 成 `'auto'`。

**驗證**（2026-04-16，本次對話用 Local API 跑 `payload.updateGlobal` round-trip 測試）：
- Identity save（等同後台改其他欄位後存）→ ✓ OK，無 validation error
- 注入 legacy `mode: 'latest'` 後 save → ✓ hook 成功 coerce → DB 值變 `"auto"`
- DB 目前值已是 `"auto"`（過去某次 save 時就被 hook 治好了）

剩下要做：無。若後台 UI 仍顯示錯誤，清瀏覽器 cache / hard reload 即可。

### 🟡 P2：Git divergence 未解（diverged state）
- **Local 6 ahead**（本次對話 commit `cfe26ba` 之後；原 git status snapshot 顯示 3 ahead 不完整）:
  - `cfe26ba fix(phase5): resolve cart/wishlist hydration mismatch via skipHydration` ← 本對話新增
  - `16dfa4f docs(handoff): add Cloudflare Tunnel deployment architecture + handoff discipline`
  - `c542786 feat(phase5.1): add revalidate hooks to 6 page-level globals`
  - `b2374ba fix(policy): render richContent (images/video) on terms + privacy-policy`
  - `c98919a fix: return policy 7->14 days + HomepageSettings validation + Phase 5 plan`
  - `3b80ee0 feat(phase4): PDP field alignment + RichText upload support`
  - **建議用 `git log --oneline origin/main..HEAD` 確認實際清單，不要依賴此文件**
- **Remote 4 ahead**（全是 Vercel 部署修正，可能已不相關）:
  - `4a99a25 fix: remove duplicate content in HeroCarousel.tsx causing build failure`
  - `421a405 fix: HeroCarousel fallback images + total count when no CMS banners`
  - `55d8aa0 Add libsql + @libsql/client deps and onlyBuiltDependencies for Vercel`
  - `71cd250 Fix libsql module not found on Vercel - add serverExternalPackages`

**建議處理順序**：
1. `git fetch`（不 merge）
2. `git log -p origin/main..HEAD` 和 `git log -p HEAD..origin/main` 比對兩邊
3. 本地 `next.config.mjs` (M) 和 `package.json` (M) 檢查是否已含遠端 Vercel fix 的等價內容
4. 決定策略：`rebase` / `merge` / 直接 force-with-lease push（**需要使用者授權**）

⚠️ **重要**：遠端那 4 個 Vercel commits 是「從 Vercel 部署策略遺留」。既然現已改走 Cloudflare Tunnel + 本機 dev server，那些 commits 可能技術上仍然無害但概念上不再相關。

### 🟢 P3：DEPLOYMENT.md 與實際架構嚴重不符
**問題**：
- DEPLOYMENT.md 說 PostgreSQL + Vercel
- 實際 `src/payload.config.ts:158` 用 `@payloadcms/db-sqlite` + `libsql`（本機檔案 `data/chickimmiu.db`）
- 實際部署是本機 + Cloudflare Tunnel

**建議**：改 DEPLOYMENT.md 反映真實架構 — 但這是文件整理，優先度最低。

### 🟢 P4：還有一堆 untracked / modified 檔案未納管
從 `git status` 看：
- `?? src/app/(frontend)/diag/` — Boot fallback 診斷頁（本次對話派上用場）
- `?? src/app/global-error.tsx` — global error boundary
- `?? src/collections/SizeCharts.ts` — Phase 1 尺寸表 collection
- `?? src/components/admin/ProductBulkActions.tsx` / `ShoplineXlsxImporter.tsx` / `VariantMatrixGenerator.tsx`
- `?? src/components/layout/BootBeaconCleanup.tsx`
- `?? src/endpoints/revalidateAll.ts` / `shoplineXlsxImport.ts`
- `?? src/lib/revalidate.ts` / `shopline/xlsxParser.ts`
- `?? src/migrations/20260415_112142_add_size_charts.{json,ts}`
- `?? src/seed/resetAdmin.ts`
- `?? scripts/apply-phase1-migration.mjs`
- 一堆 `M` 檔案（Categories.ts / Media.ts / Products.ts / 各種 page.tsx…）

這些是 Phase 1/4/5 累積未 commit 的工作。**建議**：把相關的分群組 commit（例如 Phase 1 尺寸表一組、admin 工具一組、Shopline 匯入一組），不要全部一包。

---

## 🏗️ 架構備忘（從這次偵察學到的）

### Production 部署實際長相
```
瀏覽器 → testshop.ckmu.co (Cloudflare DNS)
         ↓
      Cloudflare Edge (Tunnel ingress)
         ↓
      cloudflared (本機 daemon, tunnel UUID 49879c4b-...)
         ↓
      http://127.0.0.1:3001 (Next.js dev server)
         ↓
      SQLite file: data/chickimmiu.db (37 MB, 本機)
```

### 關鍵設定位置
- `C:\Users\mjoal\.cloudflared\config.yml` — Tunnel 路由（含 ally / group / testshop / stocks 四個 hostname）
- `C:\Users\mjoal\.cloudflared\49879c4b-691b-4698-b48b-f6a990055494.json` — Tunnel credentials
- `.claude/launch.json` — preview server 設定（`runtimeArgs: ["dev", "-p", "3001"]`，**務必 `dev` 不能是 `start`**）
- `data/chickimmiu.db` — Prod DB 本尊（37 MB）
- `data/chickimmiu.db.pre-phase1-bak` — Phase 1 前備份（37 MB）
- `.env` — 6 個 key：`PAYLOAD_SECRET`, `DATABASE_URI`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, `AUTH_SECRET`, `AUTH_URL`（**沒有** `DATABASE_AUTH_TOKEN` — 所以目前是 SQLite file mode，不是 Turso cloud）

### 已知的 fragile 行為
- HMR 多次 "performing full reload because your application had an unrecoverable error" 會累積 `.next` cache 污染 → webpack chunk error → `pnpm devsafe` 清才會好
- Claude Desktop 內建 webview (Electron 41) 有獨立 HTTP cache，即使 `next.config.mjs` 加了 `Cache-Control: no-store` 也可能被 Electron 繞過 → 驗證時優先用標準 Chrome/Edge
- `persist(zustand)` store 預設同步 hydrate → 和 SSR content 不同 → mismatch。新的 persist store 都要加 `skipHydration: true` + 在 Providers 手動 rehydrate

---

## 📋 新對話推薦開場 prompt

```
接續 CHIC KIM & MIU 專案。請先讀 HANDOFF_PHASE5.4.md 了解上一個對話的結論和 pending work。

立刻要做的（P0）：
修 webpack chunk Runtime TypeError — 症狀和修法在 HANDOFF 文件 P0 段。

步驟：
1. preview_stop 目前的 preview server（serverId 見 preview_list）
2. 跑 `rimraf .next`
3. preview_start chickimmiu-next
4. 等 compile 完，跑 `curl localhost:3001` 確認 200
5. 回報結果給我，我自己用 Chrome hard reload testshop.ckmu.co 驗證

做完這個再看下一個 P1（HomepageSettings 穿搭誌區塊 validation）。

規則同前：
- Context 60% 警告
- 偵察優先、改動最少
- 不要自己做：git push / pull / merge / rebase / reset、pnpm build
```

---

**本次對話 context 用量收尾約 65%，正常壓力。**
