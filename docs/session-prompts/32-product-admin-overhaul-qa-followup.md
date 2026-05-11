# Session 32 — 商品後台 6 大改造 QA 收尾 + 浮動元件審查

PR #209「商品後台 6 大改造」程式碼已於 2026-05-09 merged 進 main（commit `54cf16d`），
6 個 logical commit + importMap regen + migration 檔都到位、`tsc --noEmit` 0 錯、`pnpm build` PASS、
`docs/qa/2026-05-08-product-admin-overhaul.md` + `docs/qa/2026-05-09-product-admin-overhaul.md`
兩份 QA 報告也寫了。

但 QA 報告本身把以下幾項標 FAIL/PARTIAL，沒結案：

- V3 `pnpm payload migrate` 跑不到 PR #209 的 migration（20260508_160000）
- V4-a 至 V4-g 全部 7 條手動 smoke 沒做
- V5 截圖目錄 `docs/qa/screenshots/` 根本沒建，所有截圖路徑都是 placeholder

下面是對應的補做事項。

---

## A. 修 migration baseline，讓 fresh DB 能跑通到最新

### 根因
`src/migrations/20260415_112142_add_size_charts.ts:51` 直接：

```ts
await db.run(sql`ALTER TABLE \`products_images\` ADD \`caption\` text;`)
```

但**沒有任何先行 migration 建立 `products_images` table**。fresh DB 跑下去必爆
`SQLITE_ERROR: no such table: products_images`。

prod 線上 DB 因為早期是用 `pnpm payload dev` push schema（不走 migration）建起來的，
`products_images` table 早就存在，所以跑 migration 不會撞到。但 local fresh build 跑不過。

### 要做的
1. 開 `feat/migration-baseline-fix` branch。
2. 兩條路擇一（先研究 git log 看哪一個比較合 codebase 風格）：
   - **Option A — 改 20260415 那條 migration**：把 `ALTER TABLE products_images ...` 改成
     先用 `tableExists` helper 判斷，沒有的話走 `CREATE TABLE products_images` 完整建表
     SQL（從 prod schema export 出來），有的話才 ALTER。
   - **Option B — 加一條更早的 baseline migration**：在 20260415 之前插一條
     `20260101_000000_initial_schema.ts`，把 prod 全 schema dump 寫進去，
     migrations/index.ts 排在 20260415 前面。
3. **強烈建議 Option A**，因為 Option B 跟既有 migration 鏈會打架（後面很多 migration
   都假設 schema 是某個中間狀態）。
4. 不要動其他 migration。
5. 跑 `rm -f payload.db && pnpm payload migrate`，要能一路跑通到
   `20260510_140000_add_product_image_migration.ts`。

### 驗證
```bash
sqlite3 payload.db "PRAGMA table_info('products');" | grep -E "purchase_limit|dimensions_length|dimensions_width|dimensions_height|hs_code|intro_video_id"
```
要看到 6 行。

---

## B. 跑完 V4-a 至 V4-g 7 條 manual smoke

修完 A 之後，`pnpm dev` 起本地 admin，依序驗：

### V4-a `/admin/collections/products` 列表
- [ ] 看到 ImportMissingImagePanel / ImportExportButtons / R2PilotPanel 三個工具
- [ ] ProductBulkActions 區塊看到 5 個批次按鈕：上架 / 下架 / 草稿 / 刪除 + 新 3 個（📁 改分類 / 💰 改價 / 🏷️ 加標籤）

### V4-b 點任一商品 → 編輯頁
- [ ] 看到 4 tab（① 基本與價格 / ② 媒體與變體 / ③ 穿搭與 SEO / ④ 廣告與進階），不是舊的 6 tab
- [ ] sidebar 看到「毛利洞察」區塊：有成本/售價/毛利 NT$/毛利率 %，毛利率 < 30% 紅 / 30-50% 黃 / ≥ 50% 綠
- [ ] sidebar 看到「建立精靈」區塊有「再次顯示精靈」按鈕
- [ ] 頁面右上 fixed 區看到 4 個 tab 完成度徽章「① ✅ ② ⚠️ ③ 🟡 ④ 🟡」hover 出 tooltip 列出缺什麼
- [ ] 編輯頁右上有「🧬 複製此商品」按鈕
- [ ] 改一個欄位按 Save → 中央彈出綠色 toast「✅ 商品已儲存」1.5 秒淡出

### V4-c 變體 inline table（Tab 2）
- [ ] 看到自訂 inline table 9 欄（顏色名稱/色碼/色塊預覽/尺寸/SKU/庫存/變體價/GTIN/操作），不是 Payload 預設 array UI
- [ ] colorSwatch 上傳過的列顯示 32x32 縮圖；只有 colorCode 的列顯示色塊；都沒有顯示「—」
- [ ] 拖曳 ↕ 把第 3 列拖到第 1 列，順序變、儲存後仍生效
- [ ] 工具列「全部庫存設為 [N]」輸入 50 → confirm「即將影響 X 筆變體」→ 全列庫存變 50
- [ ] 「全部變體價設為 [N]」/「全部變體價清空」確認都能用
- [ ] 表格底部統計「合計 N 件 / M 個 SKU」有跟著更新

### V4-d 列表批次強化
- [ ] 勾 2 個商品 → 「📁 改分類」彈 modal → select 拉出 categories → confirm「將把 2 筆商品分類改成『XXX』」→ 完成
- [ ] 勾同 2 個 → 「💰 改價」→ 選「全部 -10%」→ input 10 → 預覽前 3 筆「商品 A: 1200 → 1080」→ confirm → 進度顯示「已更新 X / 2」→ 完成
- [ ] 勾同 2 個 → 「🏷️ 加標籤」input「測試」→ 完成；展開商品確認有「測試」tag

### V4-e 一鍵複製商品
- [ ] 任一商品按 🧬 複製此商品 → confirm「即將複製此商品，並重設為草稿」
- [ ] navigate 到新商品 edit page
- [ ] 新商品 slug = `<原 slug>-copy-<base36-ts>` / name = 「<原 name>（複本）」 / status=draft / totalSold=0 / publishAt=null / unpublishAt=null / aliasSlugs=[]
- [ ] 變體 SKU 全部加 `-copy-<ts>` 後綴

### V4-f 建立精靈
- [ ] /admin/collections/products/create 進入 → 頂端浮動黃金色 banner，進度 33%
- [ ] 文字「步驟 1/3：基本資訊 — 請先填寫商品名稱與封面主圖」
- [ ] 填名稱 + 上傳封面 → 自動到 step 2 / 66%「步驟 2/3：價格與變體 — 至少填入原價，並用『🎨 變體矩陣產生器』快速建立 SKU」
- [ ] 填原價 + 加 1 個變體 或 stock>0 → step 3 / 100%
- [ ] step 3 顯示 7 項 checklist（商品名稱 / 封面主圖 / 原價 / 變體或庫存 / 商品分類 / 商品描述 / 標籤）
- [ ] 7 項全 ✅ 後出現「🚀 全部填好，準備上架」按鈕
- [ ] 點按鈕 → confirm「即將立刻上架，前台會看見此商品」→ status 變 published 並 trigger save
- [ ] 連跑 3 次後預設不再顯示，sidebar「再次顯示精靈」可重啟

### V4-g 前台
- [ ] /products 看到剛上架的測試商品
- [ ] /products/<slug> PDP 主圖區塊上方有 `<video autoplay muted loop playsInline>` max-h:480px 在播 introVideo
- [ ] 加入購物車區顯示「每人限購 N 件」（PR 設 N=2 時）
- [ ] 在 cart 把同商品加到 3 件 → toast「此商品每人限購 2 件」並擋下

---

## C. 浮動元件 z-index 連帶審查

PR #224（commit `e85b581`）已修 `AdminBackButton`（原 `position: fixed; top:14; right:16; zIndex:100`
擋住 Save/Publish/More 那排）和 `ProductMissingImagePanel`（預設展開把列表擠出 viewport）。

**但同類型的浮動元件 PR #209 也有兩個沒被檢查**：

1. `src/components/admin/ProductTabBadges.tsx:9-19` — `position: fixed; top: 60; right: 16; zIndex: 50`
2. `src/components/admin/ProductSaveToast.tsx:96-104` — `position: fixed; inset: 0; zIndex: 120; pointerEvents: 'none'`（這個有 pointerEvents none 應該 OK，但 z-index 120 比 AdminBackButton 還高需確認）

要做的：
- [ ] 進編輯頁，看 ProductTabBadges 的徽章是否擋到右上 Save/Publish/More menu/Preview。
  AdminBackButton 在 PR #224 從 `position:fixed` 拔掉改 inline 進 sidebar 是因為直接擋住 doc control bar。
  ProductTabBadges 的 top 是 60、AdminBackButton 原本 top 是 14，剛好不重疊但需要實機看。
- [ ] 若擋到，改成跟 AdminBackButton 同款方案：mount 到 sidebar inline 而不是 fixed 浮動。
- [ ] ProductSaveToast 純動畫呈現 1.5 秒，inset:0 + pointerEvents:none，理論上不擋。
  但如果在 `phase==='in'` 那 0.35s 過渡期使用者按 cmd+S 連存 2 次會不會 race condition 要驗。

---

## D. V5 QA 補截圖 + 寫第 3 份 report

驗完 A/B/C 之後：

1. `mkdir -p docs/qa/screenshots/2026-MM-DD/` 用今天日期。
2. 對 V4-a 至 V4-g 每條都拍一張 PASS 截圖存成 `V4a-products-list.png` 等。
3. 寫 `docs/qa/2026-MM-DD-product-admin-overhaul-rerun.md`，列：
   - V1/V2 沿用之前 PASS
   - V3 補新證據（fresh migrate 跑通的 log + sqlite PRAGMA 結果）
   - V4-a 至 V4-g 全 PASS + 對應截圖路徑
   - V5 結案
4. 把 PR #209 的 6 commit 編號 + 對應 V4 條目對齊一張表貼進去。
5. commit `docs(qa): 補 product admin overhaul 完整端到端驗證 + 截圖`
6. 不需要再開 PR，直接 push 到 main 或 docs-only PR 都 OK。

---

## E. 預估工時 + 風險

- A migration baseline fix: **30-60 分**（要小心測試別動到 prod 已上的 schema 預設值）
- B 7 條 V4 smoke: **40-60 分**（需要先建 1 個測試商品 + 至少 5 張媒體 + 1 個影片，跑完再 cleanup）
- C 浮動元件審查: **15-30 分**（看實際擋不擋；不擋就只寫一句註）
- D 截圖 + report: **20-30 分**

**總預估 1.5-3 小時**，獨立 session 一次推完。

## F. 不在這次 scope

- PR #209 的 6 大改造**程式碼層全 done**，不要動到。
- prod DB 不需要改（已經是增量遷移，PR #209 的 migration 早就上 prod 了）。
- Shopline 7226 商品大遷移（docs/session-prompts/30-31）獨立另案。
- Codex 自動化交接（docs/session-prompts/32 之前）獨立另案。
