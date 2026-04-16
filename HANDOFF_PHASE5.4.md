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

### 🟡 P4：untracked / modified 檔案分批 commit — A/C/D-部分已被外部 commits 完成，剩 B/D-code/E/F

**⚠️ 重要 update（2026-04-16，本對話 P4 偵察 commit `6f4c004` 之後又出現變化）**：

在本對話寫 P4 分類 HANDOFF 的同時，另一個 session（或使用者親手）已 push 了 3 個 commits 解掉大部分工作，origin/main 也同時更新（P2 divergence 自動解了）：
- `0e11f04 feat(phase1): SizeCharts collection + migration + manual apply script` — **P4 Batch A 完成**
- `cb74f85 feat(ipad-hardening): prevent iOS Safari white-screen from blocked storage APIs` — **P4 Batch C 完成**（diag/ + global-error.tsx + BootBeaconCleanup + layout.tsx 改動都被吸收）
- `2e16460 chore: add missing daily-checkin migration + resetAdmin seed script` — **P4 Batch D 的 migration + resetAdmin.ts 完成**（但 Users.ts schema 欄位仍 M，schema 和 migration 不同步，下對話要確認）

另外：
- `origin/main` 現已是 `0b5695b`（P3 commit），原 P2 列的 4 個 Vercel-era commits 已從 origin 消失 → **P2 divergence 也自動解決**，不再需要 force-push
- `src/endpoints/revalidateAll.ts` 似乎仍 untracked（未被 cb74f85 吸收）— 下對話確認是否要加入
- 新增 untracked `src/seed/verifyPhase56Tz.ts` — Phase 5.6 timezone verify script

**原分類 Batch A ~ F 更新後狀態**：

| Batch | 狀態 | 備註 |
|---|---|---|
| A Phase 1 尺寸表 | ✅ DONE | `0e11f04` |
| B Phase 4/5 Admin 工具 + Shopline 匯入 | 🚧 TODO | 3 admin components + 2 endpoints + xlsxParser + `importMap.js` (M) + `Products.ts` (M, 部分 diff 應屬於這批) |
| C Phase 5.4 偵察產物 | ✅ DONE（部分） | `cb74f85` 吸收了 diag/global-error/BootBeacon/layout 改動。剩 `src/endpoints/revalidateAll.ts` 仍 untracked — 下對話確認去留 |
| D Phase 5.6 daily check-in streak | 🟡 PART DONE | `2e16460` 吸收了 migration + resetAdmin.ts + migrations/index.ts。剩下：`Users.ts` +35 行 schema (M)、`gameEngine.ts` +152 行 (M)、`gameActions.ts` (M) + `api/games/route.ts` (M) + `verifyPhase56CheckIn.ts` (??) + `verifyPhase56Tz.ts` (??)。**⚠️ schema 欄位 (Users.ts) 和 migration (已 commit) 不同步** — 需確認 migration 已跑還是還沒跑；若已跑代表 dev auto-push 做過，Users.ts schema 要合併或 discard |
| E 前台 UI 雜項 | 🚧 TODO | 12 個前台 M 檔 + `pnpm-lock.yaml` + `.claude/settings.local.json`（不應 commit） |
| F PHASE5.5_PROMPT.md | 🚧 TODO | 一次性檔，下對話直接 `git rm` |

**現在剩的 `git status` 具體內容**：

Untracked：
- `PHASE5.5_PROMPT.md`（Batch F）
- `src/components/admin/ProductBulkActions.tsx` / `ShoplineXlsxImporter.tsx` / `VariantMatrixGenerator.tsx`（Batch B）
- `src/endpoints/revalidateAll.ts` / `shoplineXlsxImport.ts`（B + C 邊角）
- `src/lib/shopline/xlsxParser.ts`（Batch B）
- `src/seed/verifyPhase56CheckIn.ts` / `verifyPhase56Tz.ts`（Batch D）

Modified：
- `src/collections/Users.ts` / `src/lib/games/gameEngine.ts` / `src/app/api/games/route.ts`（Batch D 尚未 commit 的 code side）
- `src/collections/Products.ts` / `src/app/(payload)/admin/importMap.js`（Batch B 的 wire-up）
- 前台 UI 12 檔（Batch E，需逐一看 diff）
- `src/collections/Categories.ts` / `Media.ts`（Batch E 或可能是 Phase 1 尺寸表後續）
- `PHASE4_HANDOFF.md`（HANDOFF 本身，持續更新）
- `pnpm-lock.yaml`（跟 Phase 5 新 deps 有關）
- `.claude/settings.local.json`（本機 preview 設定，不要 commit）

#### 下對話推薦開場 prompt（已更新）

```
接續 Phase 5.4 P4 — untracked/modified 檔案分批 commit（A/C/D-部分已完成，剩 B/D-code/E/F）。
先讀 HANDOFF_PHASE5.4.md 的 P4 section 最新狀態表。

首要決策：Batch D Phase 5.6 code side 處理方式
- Users.ts schema +35 行 vs migration 已 commit → schema/migration 不同步狀態要先確認
- 如果 DB 已有 streak 欄位（2e16460 migration 跑過）→ Users.ts schema 應該 commit 起來讓 Payload type 生成正確
- 如果還沒跑 migration → 要先跑再 commit schema

決策後依序處理：
1. Batch D code side（commit 所有 game streak server-side + Users schema）
2. Batch B（admin 工具 + Shopline；注意 Products.ts 可能要拆 2-3 個 commit）
3. Batch E（前台 UI 12 檔逐一看 diff，分群組 commit）
4. Batch F（git rm PHASE5.5_PROMPT.md）
5. 清理 `.claude/settings.local.json` 不納管（git update-index --skip-worktree 或 .gitignore）

P2 divergence 已自動解決（origin 現已跟上），完成後可以直接 `git push` 而非 force-push。

規則：
- 不動 M 檔 semantic，只把狀態 commit 成 clean
- 每 Batch 一個（或多個語義分組）commit
- 每 Batch 完更新 HANDOFF P4 section 打勾
```

#### 五類內容分類（按處理順序建議）

**Batch A — Phase 1 尺寸表（成熟功能，可直接 commit）** ✅ 建議 1 個 commit
- `src/collections/SizeCharts.ts`（216 行）— `size-charts` collection 定義
- `src/migrations/20260415_112142_add_size_charts.ts` + `.json`（261 行）— DB schema migration，已進 `src/migrations/index.ts`
- `scripts/apply-phase1-migration.mjs`（131 行）— 非互動式套 migration 的 bypass script
- `src/collections/Products.ts` 部分改動（reference `sizeChart` relationship + hook）
- Import 鏈確認：`Products.ts`、`AISizeRecommender.tsx`、`payload.config.ts`、`payload-types.ts`、`revalidateAll.ts` 皆 reference

**Batch B — Phase 4/5 Admin 工具 + Shopline 匯入（成熟功能，可 commit）** ✅ 建議 1-2 個 commit
- `src/components/admin/ProductBulkActions.tsx`（216 行）
- `src/components/admin/ShoplineXlsxImporter.tsx`（376 行）
- `src/components/admin/VariantMatrixGenerator.tsx`（361 行）
- `src/endpoints/shoplineXlsxImport.ts`（248 行）
- `src/lib/shopline/xlsxParser.ts`（487 行）
- `src/app/(payload)/admin/importMap.js`（M）— admin UI registration
- `src/collections/Products.ts` 內 admin UI wire-up（**+856 行總 diff，大改，需仔細讀**）
- Import 鏈：`ProductBulkActions` / `VariantMatrixGenerator` 只被 `importMap.js` 引入；`ShoplineXlsxImporter` 另呼叫 `shoplineXlsxImport` endpoint + `xlsxParser`

**Batch C — Phase 5.4 偵察 / 防呆產物** ✅ 建議 1 個 commit
- `src/app/(frontend)/diag/page.tsx` + `DiagClient.tsx`（total 413 行）— iPad/Safari 白屏診斷頁
- `src/app/global-error.tsx`（152 行）— root-level error boundary
- `src/components/layout/BootBeaconCleanup.tsx`（39 行）— 搭配 layout inline script 做 4 秒 fallback beacon
- `src/endpoints/revalidateAll.ts`（34 行）— 手動全站 revalidate endpoint
- `src/app/(frontend)/layout.tsx` (M) — 加 `<BootBeaconCleanup />` + 診斷 inline script
- `src/seed/resetAdmin.ts`（40 行）— 重設 admin 密碼的 one-off script

**Batch D — 🚧 Phase 5.6 in-progress（不是「未 commit 遺留」，是沒寫完的新功能）** ⚠️ 需要決策
- `src/collections/Users.ts` +35 行 — 新增 `totalCheckIns` / `consecutiveCheckIns` / `lastCheckInDate` 欄位
- `src/lib/games/gameEngine.ts` +152 行 — 新增 `getTpeDateString()` / `getTpeWeeklyKey()` / `getTpeMonthlyKey()` helpers + server-authoritative `performDailyCheckin()` logic
- `src/lib/games/gameActions.ts` (M) — server action `performDailyCheckin(userId)`
- `src/app/api/games/route.ts` (M) — API 對接 `performDailyCheckin`
- `src/migrations/20260416_193835_add_daily_checkin_streak.ts`（52 行）+ 已進 `migrations/index.ts`
- `src/seed/verifyPhase56CheckIn.ts` — verification script
- client `src/components/games/DailyCheckinGame.tsx` 有 `// TODO: call performDailyCheckin server action` 但未接
- **現況**：server side **完整實作但未 commit 也未測試**；client side 只有 TODO。與 Phase 5.3 client-fix (`68f6856`) 是同功能的下個階段（升級成 server-authoritative streak tracking）
- **決策需求**：是要 (a) 整包 commit 宣告 Phase 5.6 WIP、(b) `git stash save -m "phase5.6-wip"` 暫存起來讓 main 保持乾淨、還是 (c) 把 server side commit 起來但不接 client。本 P4 處理前必須先決定。

**Batch E — 前台 UI + 其他雜項 M 檔** ⚠️ 需逐一讀 diff 分類
以下都是 `M` 狀態、內容尚未審視：
- `src/app/(frontend)/about/page.tsx` / `collections/[slug]/page.tsx` / `pages/[slug]/page.tsx`
- `src/app/(frontend)/products/ProductListClient.tsx` / `products/page.tsx`
- `src/components/home/HeroCarousel.tsx`（跟 origin `421a405` 同檔、不同內容；參照 P2 偵察）
- `src/components/product/AlsoBoughtSection.tsx`
- `src/components/recommendation/ExitIntentPopup.tsx`
- `src/components/ugc/UGCGallery.tsx`
- `src/components/ui/CookieConsentBanner.tsx` / `FloatingChatButton.tsx` / `FloatingQuickMenu.tsx`
- `src/collections/Categories.ts` / `Media.ts`
- `src/lib/recommendationEngine.ts`
- `pnpm-lock.yaml`（`package.json` 沒列在 M — 看起來已被前次 commit 吸收）
- `.claude/settings.local.json`（本機設定，不應納管）

**Batch F — 該刪除的 ephemeral 檔** 🗑️
- `PHASE5.5_PROMPT.md` — Phase 5.5 的一次性開場 prompt 檔，5.5 已完成、本 prompt 已用完 → 刪除

#### 重要提醒給下個對話

1. **Batch D Phase 5.6 要第一個處理**，因為它牽涉 `Users.ts`、`gameEngine.ts`、`api/games/route.ts` 這些「共用檔」，決策怎麼處理會影響 Batch E 能不能動
2. Batch B 的 `Products.ts` +856 行要認真讀、可能該自己拆成 2-3 個小 commit（admin UI wire、欄位擴充、hook 改動）
3. 本對話**未動任何檔案內容**，只做了分類。所有 M / untracked 狀態與本對話開始時相同
4. 本對話已產 commit：`2fbae34`（P0/P1）、`1efd0d6`（P2 偵察）、`0b5695b`（P3 DEPLOYMENT.md），加起來 local ahead 從 23 → 26
5. Force-push 前的條件同 P2 記載：本地 clean + smoke test 通過 + 使用者親自下指令

#### 下對話推薦開場 prompt

```
接續 Phase 5.4 P4 — untracked / modified 檔案分批 commit。
先讀 HANDOFF_PHASE5.4.md 的「🟡 P4」section（Batch A/B/C/D/E/F 分類）。

首要決策：Batch D（Phase 5.6 server-authoritative daily check-in streak）
要怎麼處理？—— (a) 整包 commit 宣告 WIP、(b) stash 起來、(c) 拆 server/client
分開 commit。

決策後依序處理：Batch D → A → C → B → E → F（E 最散、最耗 context）。
每 Batch 一個 commit，commit message 加「Phase 5.4 P4 Batch X」。

規則：
- 不動 M 檔的 semantic 內容，只把狀態 commit 成 clean
- `.claude/settings.local.json` 不 commit（本機設定）
- Phase 5.6 WIP 標籤清楚，未來可以獨立追蹤
- Products.ts +856 行要讀過才 commit
- 每 Batch 完就更新 HANDOFF P4 section 打勾
- 全部做完才評估是否 force-push（使用者親自下指令）
```

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
