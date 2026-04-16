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

### 🟡 P2：Git divergence 未解（2026-04-16 偵察完，決策=暫不 push）

**現況**（`git fetch` 已跑過）：
- Local **23 ahead**（Phase 4 + Phase 5.1~5.5 全部 commits；用 `git log --oneline origin/main..HEAD` 查即時數字）
- Origin **4 ahead**

**Origin 4 commits 逐一分析**（全是 Vercel 時期遺留）：

| Commit | 內容 | 本地等價? | 風險 |
|---|---|---|---|
| `71cd250 Fix libsql module not found on Vercel` | `next.config.mjs` 加 `serverExternalPackages: ['libsql', '@libsql/client']` | ✅ 本地 working copy 已含該行（未 commit） | 無 |
| `55d8aa0 Add libsql + @libsql/client deps ... for Vercel` | `package.json` 加 libsql deps + onlyBuiltDependencies | ✅ 本地 working copy 已含全部 | 無 |
| `421a405 fix: HeroCarousel fallback images ...` | 重寫 `src/components/home/HeroCarousel.tsx`（+246 行） | 本地同檔 M 狀態但不同內容 | 低（本地版本應該較新） |
| `4a99a25 fix: remove duplicate content in HeroCarousel.tsx` | **破壞性 rename**：`src/components/home/HeroCarousel.tsx` → `HeroCarousel.tsx`（移到 repo root），刪 243 行 | 本地沒這個 rename | 🔥 **高**：會打壞 Next.js import |

**結論**：origin 前 2 個 commit 的技術內容已在本地、後 2 個（特別是 `4a99a25`）絕對不能 merge。

**三個可行策略**：
- **A) `git push --force-with-lease origin main`** — 放棄 origin 4 commits，本地 23 commits 成為唯一真相。簡單、乾淨。風險：origin reflog 上那 4 commits 消失（本地 reflog 還留著）。需使用者親自下指令。
- **B) 暫不處理**（**本次對話選這個**）— 本地繼續 commit、不推遠端、未來再整盤處理。適合想先完成 P3/P4 再一次解決。
- **C) Merge/rebase** — 不推薦。`4a99a25` rename 會立刻炸 HeroCarousel import。Conflict 多、收益低。

**為什麼選 B**（2026-04-16 本次對話）：P3 DEPLOYMENT.md 重寫 + P4 untracked 檔分批 commit 會再產生數個 commit，等這些都進本地之後再決定是否 force-push，比現在推更完整。

**未來執行 A（force push）前必做**：
1. 本地 working copy 清到乾淨（所有改動都 commit）
2. `git log --oneline origin/main..HEAD` 最終確認 commit 清單
3. 跑 `pnpm dev` smoke test 幾條主要路由 200
4. 使用者親自下 `git push --force-with-lease origin main`（不要讓 Claude 做）

### ✅ P3：DEPLOYMENT.md 重寫完成（2026-04-16 本對話）

整份 `DEPLOYMENT.md` 從「PostgreSQL + Vercel」改寫為「SQLite 本機檔 + Cloudflare Tunnel」實景，新增章節：
- **架構實景** — ASCII 圖 + 關鍵檔案路徑表 + `config.yml` 現行 ingress 列表
- **環境變數** — 只列實際用到的 6 個 key（`.env.example` 裡未用的另表說明為何還留著）
- **本機開發** — `pnpm dev -p 3001` 為主流程，加 `pnpm devsafe` / `pnpm seed:core` / payload CLI；`pnpm build` / `pnpm start` 列入「不用的指令」並寫原因
- **Cloudflare Tunnel 運維** — 啟動指令、健檢（netstat / tasklist / curl）、自動開機啟動方案比較（Task Scheduler / NSSM / PM2）、斷線復原流程
- **測試 Checklist** — 保留原章節但同步最新狀態（Phase 5.3/5.4/5.5 修過的地方打註解）
- **疑難排解** — 新章節，收錄本 Phase 偵察到的 5 個已知症狀 + 修法（`.next` cache 污染、hydration mismatch、Electron webview cache、HomepageSettings validation、iPad/Safari 白屏）

diff stat：`+204 / -111`（淨 +93 行，大幅補資訊）。

**保留未動的既有內容**：追蹤事件驗證章節（GTM / Meta Pixel / GA4 / Google Ads）與部署架構無關，只調整範例網址為 `testshop.ckmu.co`。

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
