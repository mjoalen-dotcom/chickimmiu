# Codex 自動化交接 — Shopline 7226 商品 + 36k 圖 分批遷移

> **這是給 OpenAI Codex（或同等 autonomous coding agent）的自動執行手冊**。
> 目標：把 Shopline 歷史資料（7226 商品 + ~36k 商品圖）每小時分批搬進
> chickimmiu DB + R2，過程中正確分類 + 補齊商品內部資料，全程 idempotent。

## TL;DR

1. **預備期**（Phase 0–1）— 你要先解決「Shopline image URL 從哪來」+ 補完
   `categoryMapping.ts`，這 2 件事是 blocking。預估 1–3 天。
2. **執行期**（Phase 2–4）— 每小時 GitHub Actions cron 打 `/api/cron/shopline-batch`，
   單次跑 30 個商品（產品 upsert + 圖片 R2 + 補欄位）。整批 ~10 天跑完。
3. **驗收期**（Phase 5）— 對 sample 商品逐筆驗 PDP / 圖載 / 分類，跑 link
   integrity scanner。

## 為什麼分小時批次

- **Hetzner CPX22 4GB / 80GB**：一次跑全 7226 會炸 OOM 或填滿磁碟。
- **Cloudflare R2 rate limit**：S3 API 1k req/s/IP，分批避免 throttling。
- **Recovery 友善**：失敗只丟掉那一小時的 30 筆，不是整批。
- **可暫停**：cron 可隨時改 `if: false` 凍結，不擋部署其他改動。

## ⚠️ 在動工前的關鍵 context

### 已存在的基礎建設（**不要重寫**）

| 元件 | 路徑 | 功能 |
|---|---|---|
| 商品 xlsx 匯入 endpoint | [`src/endpoints/shoplineXlsxImport.ts`](../../src/endpoints/shoplineXlsxImport.ts) | upsert 3-tier match (sourceId → productSku → variants.sku)、strict 分類 mode、fallback flag |
| 商品 xlsx 批次 script | [`scripts/import-shopline-xlsx.ts`](../../scripts/import-shopline-xlsx.ts) | bypass HTTP，直接 `payload run` 批量匯入 |
| Shopline xlsx parser | [`src/lib/shopline/xlsxParser.ts`](../../src/lib/shopline/xlsxParser.ts) | ExcelJS 解析、變體合併、SKU 唯一驗證、分類抽取 |
| 分類對照表 | [`src/lib/shopline/categoryMapping.ts`](../../src/lib/shopline/categoryMapping.ts) | Shopline 原始字串 → 新站分類 slug |
| 圖片遷移 endpoint | [`src/app/api/migrate-images/route.ts`](../../src/app/api/migrate-images/route.ts) | 從 imageId 拼 Shopline CDN URL → 下載 → Payload Media（自動 R2）；idempotent (status='done' skip) |
| imageMigration 欄位 | `Products.imageMigration.{status,lastAttemptAt,lastError,processedCount,totalCount}` | per-product 狀態追蹤 |
| R2 pilot button | [`src/components/admin/R2PilotPanel.tsx`](../../src/components/admin/R2PilotPanel.tsx) + [`src/endpoints/r2Pilot.ts`](../../src/endpoints/r2Pilot.ts) | admin 隨時跑「1 商品 5 圖到 R2」驗證 |
| Media R2 plugin | [`src/payload.config.ts`](../../src/payload.config.ts) `s3Storage()` | R2_* env 齊全自動接管，admin 上傳直接寫 R2 |

### 環境

- **Prod**：`ssh root@5.223.85.14`，repo 在 `/var/www/chickimmiu/`
- **Deploy**：`ssh root@5.223.85.14 /root/deploy-ckmu.sh`
- **DB**：SQLite，`/var/www/chickimmiu/data/chickimmiu.db`
- **R2 bucket**：`chickimmiu-media`（CF account `3cd683d25ed0c4b9325e7486d5168e69`）
- **R2 public URL**：`https://pub-89ffa2f8be114cf7a1ee527f00b30abf.r2.dev`
- **15 個 BulkUpdateForm xlsx**：原檔在 user 桌面 `C:\Users\mjoal\OneDrive\桌面\_桌面整理_2026-04-19\表格`，
  你需要請 user 上傳到 `/var/www/chickimmiu/data/shopline-bulkupdateform/` 或 R2 後再讀取。
- **CRON_SECRET**：`.env` 裡的 bearer token，給 GitHub Actions cron 認證 `/api/cron/*`
  endpoints 用。

### 紀律（**踩過的坑**，從 [MEMORY.md](../../../.claude/projects/C--Users-mjoal-ally-site-chickimmiu/memory/MEMORY.md) 抽出）

- **每次開工先 `git log --oneline -10`** + `gh pr list` — user 跑 parallel session 多，
  avoid 重做已 merged 的東西。
- **加 admin component 必跑 `pnpm payload generate:importmap`** + commit。漏了 component
  silently 不 mount。
- **migration 用 PRAGMA 冪等 pattern**（看 [`20260418_220000_add_login_attempts.ts`](../../src/migrations/20260418_220000_add_login_attempts.ts)）。
- **prod migrate 必加 `yes y |`**：`yes y | pnpm payload migrate`，否則 dirty schema
  prompt 默默 default-No 然後 exit 0 看起來成功實際沒寫。
- **prod build OOM**：`NODE_OPTIONS=--max-old-space-size=2048 pnpm build`。
- **squash merge 會 auto-close stacked PR** 且不可 reopen。每個 PR 都從 main 開分支。
- **不要 `rm -rf .next && pnpm build`**：用 `/root/deploy-ckmu.sh`，它會保留現有
  chunks 不出 1–2 分鐘 404 空窗。

---

## Phase 0 — 解決 Shopline image URL 來源（**blocking**）

### 問題
`BulkUpdateForm.xlsx` **不含** image URL。我們只有 Shopline product ID + variant ID。
要把每個 product 的圖搬下來，需要先建一張 `{ shoplineProductId: [imageUrl, ...] }`
的對照表。

### 你的選擇（依優先序）

#### 方案 A — Shopline OpenAPI（最穩）
1. 請 user 開 Shopline admin → 應用市場 → 申請 OpenAPI v2 access（1–3 工作天）。
2. 拿到 access token 後寫 `scripts/fetch-shopline-images.ts`：
   - 並行 (concurrency=5) GET `/api/products/{id}` → 解 `images: [{ images: { original } }]`
   - 輸出 `data/shopline-image-map.json`，shape `{ "<shoplineProductId>": ["url1", "url2", ...] }`
   - rate limit：1 req/200ms 避免被擋
3. **驗收**：抽 10 個 product ID 對 user 提供的 prod Shopline 後台檔頁，圖數 + 順序一致。

#### 方案 B — 爬 Shopline 前台（如果 OpenAPI 申請慢）
1. Shopline 前台 PDP URL：`https://www.chickimmiu.com/products/{slug}` — 但 user 已切到
   chickimmiu 自家站；舊 Shopline 站可能在 `xxx.shoplineapp.com` 子網域，要確認還活著。
2. 寫 `scripts/scrape-shopline-images.ts`：
   - 從 xlsx 拿 7226 個 slug
   - GET 前台頁 → 解 `<script type="application/ld+json">` 的 `image: [...]` array
   - **rate limit：1 req/秒**（嚴格遵守，不然會被 ban）
   - puppeteer / playwright 不必，cheerio 已夠
3. 7226 / 1 req/s = 2 hours 跑完
4. **risk**：Shopline DOM 改版會壞、user 可能已停 Shopline 訂閱拿不到。

#### 方案 C — 手動匯出（最後手段）
1. 請 user 進 Shopline admin → 商品 → 全選 → 看有沒有「匯出圖片」功能
2. 沒有的話放棄，走方案 A 等 API。

### 完成判定
`data/shopline-image-map.json` 存在，至少 7000 個 product ID 有對應 URL（少數
historical product 有些圖被 Shopline 刪 OK），總 URL 數 30k–50k 之間。

### 注意
- 圖 URL 的 hostname 通常是 `img.shoplineapp.com` 或 `shoplineimg.com`，**外部 hotlink 不穩**，所以才要搬到 R2。
- migrate-images endpoint 接收的是 `imageId` 不是完整 URL — 看 [`route.ts:22-23`](../../src/app/api/migrate-images/route.ts) 的兩個 base 常數（已 hardcode）。所以你的 image map 可以是 `{ productId: [imageId, imageId, ...] }`，由 endpoint 自己拼 URL。

---

## Phase 1 — 補完分類對照表

### 為什麼
PR #221 上 strict mode 後，xlsx 匯入若有 unmapped category 會 422 fail（dryRun 模式）
或單筆 error（commit 模式）。如果不補完表，整個 7226 入庫會卡很多筆。

### 步驟
1. 寫 `scripts/audit-shopline-categories.ts` — 掃 15 個 xlsx，輸出所有 unique
   `Online Store Categories` 字串 + 每個出現次數，存 `data/shopline-category-audit.csv`。
2. 跟 [`categoryMapping.ts`](../../src/lib/shopline/categoryMapping.ts) 的 CATEGORY_MAP
   交集比對 → 列出 unmapped。
3. 對 unmapped 的每條：
   - LLM 自動建議對應現站分類（從 [`fullCategoryTree.ts`](../../src/lib/shopline/fullCategoryTree.ts) 列表挑）
   - 輸出 `data/shopline-category-suggestions.json`，shape `[{ shoplineKey, count, suggestion: { newCategoryName, newCategorySlug }, confidence }]`
4. **暫停請 user review** — 高 confidence (>0.9) 的可自動 merge 進 CATEGORY_MAP，
   低的請 user 手動拍板。
5. user 確認後，把對照寫進 `categoryMapping.ts` → 開 PR → merge → 重跑 audit
   驗 unmapped count = 0。

### 驗收
```
?dryRun=1&strict=1 跑 sample xlsx → 200 OK，unmappedCategories: []
```

---

## Phase 2 — 商品 xlsx 匯入（hourly batch）

### 設計
- 一次性把 15 個 xlsx 全 parse 完丟進「待處理 queue」（DB 或 redis）
- 每小時 cron 從 queue 拉 30 個商品 → 跑既有 `shoplineXlsxImportEndpoint` 邏輯
- 30 商品 × 30s 處理時間 = 15 min/批，遠低於 1hr cron 間隔，安全

### 實作

#### 新 endpoint：`POST /api/cron/shopline-batch`
1. Bearer token = `process.env.CRON_SECRET`，不對拒絕
2. 從 DB 讀「未匯入過」的 Shopline product IDs（檢查 `Products.sourcing.sourceId IS NULL`
   或維護一張 `shopline_import_queue` 表）
3. 取前 N 個（query string `?limit=30`）
4. 對每個：複用 `shoplineXlsxImportEndpoint` 內的 upsert 邏輯（抽出成共用 lib 不重寫）
5. 結果寫 DB `shopline_import_log`：`{ shoplineProductId, action, matchedBy, errorMessage, runAt }`
6. 回 JSON 進度報表

#### Queue 來源
最簡單：寫 `scripts/build-import-queue.ts` 解所有 xlsx → output `data/import-queue.json` →
cron 每次讀這 JSON、用 `imageMigration.status` 或新建 `productImported` flag 過濾「已做」的。

#### Cron
`.github/workflows/cron.yml` 加 step：
```yaml
- name: Shopline batch import
  schedule: '0 * * * *'  # 每整點
  run: |
    curl -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
      'https://pre.chickimmiu.com/api/cron/shopline-batch?limit=30'
```

### 安全
- 每個批次先 dryRun（`internal-dry=1`）log 預期效果，**不存進 DB**
- 連續 3 個批次 failed > 5 個時，cron 自動暫停（寫 `Settings.shoplineImportPaused=true` flag）
- prod build 不影響：endpoint code 改了之後 user 自己 deploy 才生效

### 驗收
- 跑 1 週後 `SELECT COUNT(*) FROM products WHERE sourcing_source_id IS NOT NULL` 接近 7226
- `matchTierStats` 主要是 `sourceId`（≥80%），少量 `productSku` / `variantSku`，none 接近 0
- 沒有 unmapped category errors

---

## Phase 3 — 圖片遷移（hourly batch）

### Pre-condition
Phase 0 的 `data/shopline-image-map.json` 必須先存在，產品也已 import 完成（Phase 2）。

### 設計
- 每小時 cron 抓「`imageMigration.status IN ('pending', 'failed')` 且 product 有 sourceId」的商品
- 對每個 → 從 image map 拿 imageIds → 打 `/api/migrate-images` POST
- 圖直接走 PR #219 的 R2 plugin（payload.create({collection:'media'}) → R2）

### 實作

#### 新 endpoint：`POST /api/cron/shopline-images-batch`
```ts
// 1. auth via CRON_SECRET
// 2. find products: imageMigration.status IN ('pending','failed') 排除 in_progress
//    取最舊 lastAttemptAt 的前 N 個（避免一直 retry 同一個爆掉的）
// 3. 載入 data/shopline-image-map.json (cache in-memory)
// 4. 對每個 product:
//    a. 從 map 找 imageIds
//    b. 打 /api/migrate-images POST { products: [{ slug, name, imageIds }] }
//    c. /api/migrate-images 內部會 set imageMigration.status='in_progress'/'done'/'failed'
// 5. 回進度報表
```

### Cron
```yaml
- name: Shopline images batch
  schedule: '15 * * * *'  # 每小時 :15（產品 import 後 15 min）
  run: |
    curl -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
      'https://pre.chickimmiu.com/api/cron/shopline-images-batch?limit=20'
```

> 圖比商品慢、20/hr × 24hr × 10 days = 4800 商品的圖處理。如果圖比較多可調 limit 到 30。

### 安全
- 每張圖加 hash check：對下載的 buffer SHA-256，存進 `Media.contentHash` 欄位（如果還沒
  有要先加 migration），避免不同 product 同圖重複上傳
- 檔案大小上限：複用 [`Media.ts`](../../src/collections/Media.ts) 的 8MB image limit，
  超過的 product 標 imageMigration.status='failed' lastError='> 8MB'，留給 user 手動處理
- 失敗紀錄：用 [`AutomationLogs`](../../src/collections/AutomationLogs.ts) collection
  寫 detailed log（給 admin 後台看）

### 驗收
- `SELECT COUNT(*) FROM products WHERE image_migration_status='done'` 接近 7000
- R2 bucket `chickimmiu-media` Objects count ≥ 30000
- 抽 20 個 PDP（`/products/<slug>`）看圖能 render
- Cloudflare R2 dashboard → bucket → Metrics 看 storage MB / requests，確認沒爆 quota

---

## Phase 4 — 商品內部資料補齊

匯入完成商品 + 圖之後，下面這些欄位 xlsx 沒帶或 Shopline 沒提供，需要二次補：

### 4.1 aliasSlugs（Shopline 舊 URL 301 redirect）
- xlsx 匯入時，`p.slug` (Shopline slug) 已 push 進 `Products.aliasSlugs[]` with source='shopline'
- 已實作於 [`scripts/import-shopline-xlsx.ts:128-139`](../../scripts/import-shopline-xlsx.ts)
- **no action needed**，匯入時自動處理

### 4.2 Korean celebrity ref（韓星穿搭情境）
從 MEMORY ref `[products.korean_celebrity_ref_*]` 知道有 3 欄相關。
- 寫 `scripts/enrich-korean-celebrity.ts`
- 對每個商品 → LLM 推測穿過此商品的 K-pop 偶像（配合 product name + tag + 系列名）
- 低 confidence 的不寫，避免假資訊；高 confidence 的填 `Products.koreanCelebrityRef.*`
- **手動 review 步驟**：先輸出 CSV，user 抽 50 筆檢查 → 沒問題才開 cron 跑

### 4.3 MBTI personality match（PR-Y 的 16+64 type）
從 MEMORY ref：MBTI64 PR-X 兌換、PR-Y MBTI 16→64。
- Products 有對應 MBTI personality type 欄位
- 寫 `scripts/suggest-mbti-types.ts`
- LLM 從 product name + style + 配色 → 建議 1-3 個 MBTI 類型
- 同樣先 dump CSV → user review → 開 cron

### 4.4 SEO metadata
- xlsx 已帶 `seo.metaTitle / metaDescription`（對應 SEO Title / Description Traditional Chinese 欄）
- xlsx 沒帶 keywords → 從 product name + tags 自動產
- `scripts/fill-seo-keywords.ts`，輸出 PR diff 給 user merge

### 4.5 fabricInfo（材質資訊）
- xlsx 不一定有，看是否有 supplier 提供
- LLM 不要猜（會出錯，材質是版位重要資訊）
- **跳過**，留給 user 後台手動補

### 安全
- 4.2 / 4.3 / 4.4 都先 sample → user review → 才 batch
- 用 `Products.dataEnrichmentStatus` 加新欄位（migration）追蹤：`enrichmentVersion: 1` 表示
  v1 規則跑過了，未來改規則 bump version 才重跑

---

## Phase 5 — 驗收

### 5.1 全站 link integrity scan
- 跑既有 [`linkIntegrityScanEndpoint`](../../src/endpoints/linkIntegrityScan.ts)
- 看 6 種斷鏈是否全清

### 5.2 Sample PDP 抽查
- 隨機抽 50 個 product slug
- 對每個 GET `https://pre.chickimmiu.com/products/<slug>`
- 檢查：HTTP 200、有 `<title>`、`<meta og:image>` URL 在 R2、至少 1 張 PDP 圖能 render
- 失敗清單寫 `data/pdp-audit-failures.csv`

### 5.3 Meta catalog feed
- xml feed `https://pre.chickimmiu.com/feeds/meta.xml` items count 應接近 product count
- Meta Catalog Manager（user 已登入）拉一次手動 sync 看有無 errors

### 5.4 R2 quota check
- Cloudflare R2 dashboard → bucket → Metrics
- 預期 storage 30GB ± 10GB，requests 月 < 1M（免費額度內）

### 5.5 final report
寫 `data/shopline-migration-report.md`，含：
- 總商品數、成功匯入、failed list
- 總圖片數、R2 上傳成功、failed list
- 分類分佈
- 跑了多久
- 任何手動干預的紀錄

---

## Stop conditions（**遇到立刻停 + ping user**）

1. 連續 3 個 cron 全失敗
2. R2 quota / billing alert
3. prod 5xx > 1% in any 10 min window
4. DB SQLite size > 1GB（接近性能崩盤）
5. Hetzner disk usage > 75GB（剩 5GB）
6. unmapped category 數量任何一刻超過 50
7. imageMigration.status='failed' 累積 > 1000

ping 方式：寫進 user mailbox（gmail send_email mcp tool）OR 在 GitHub Issues 開 issue
+ at user。**不要靜默跑直到爆炸**。

---

## 給你的開工 checklist

- [ ] Read [docs/session-prompts/31-shopline-data-migration-handoff.md](31-shopline-data-migration-handoff.md) — 整個專案脈絡（之前的 manual handoff，跟這份 codex 版互補）
- [ ] Read [MEMORY.md](../../../.claude/projects/C--Users-mjoal-ally-site-chickimmiu/memory/MEMORY.md) — user 過往踩過的坑
- [ ] `git log --oneline -20` 確認沒有更新的 commit 改變現況
- [ ] `gh pr list` 確認沒有更新的 PR 影響你
- [ ] 跟 user 確認 Phase 0 走方案 A / B / C 哪一條
- [ ] 跟 user 確認 cron batch size（30 商品/hr 預設，可調）
- [ ] 跟 user 拿 prod ssh access（如果你需要 直接驗證）OR 透過 PR + deploy 流程
- [ ] 確認 R2 token 沒 leak / 已 rotate（user 在 chat transcript 有貼過 secret）

## Reference 連結

- 上游 manual handoff（同主題）：[31-shopline-data-migration-handoff.md](31-shopline-data-migration-handoff.md)
- R2 plugin / pilot：PR [#219](https://github.com/mjoalen-dotcom/chickimmiu/pull/219) / [#221](https://github.com/mjoalen-dotcom/chickimmiu/pull/221)
- imageMigration 欄位 + idempotent：PR [#220](https://github.com/mjoalen-dotcom/chickimmiu/pull/220)
- prize_pools 修補（你要懂這個 schema bug pattern）：PR [#226](https://github.com/mjoalen-dotcom/chickimmiu/pull/226)
- storage-s3 版本 pin：PR [#222](https://github.com/mjoalen-dotcom/chickimmiu/pull/222)
- 部署腳本：[`scripts/deploy-prod.sh`](../../scripts/deploy-prod.sh)
- xlsx 匯入 batch script：[`scripts/import-shopline-xlsx.ts`](../../scripts/import-shopline-xlsx.ts)
