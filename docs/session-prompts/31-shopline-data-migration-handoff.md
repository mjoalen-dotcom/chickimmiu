# Shopline 資料遷移 — 新對話交接 (2026-05-05)

## 背景

User 從 Shopline 後台匯出歷史資料，桌面 `C:\Users\mjoal\OneDrive\桌面\_桌面整理_2026-04-19\表格`：

- **15 個 BulkUpdateForm xlsx**（`chickimmiu-BulkUpdateForm-2026-04-12-15_38_{0..14}.xlsx`）
  - 7,226 個 unique product (by Shopline Product ID)
  - 22,198 row（含 variants，平均 3.1 變體/商品）
- **chickimmiu_ShoplineCustomerReport_20260411232527.xls**：17,911 顧客
- **2025訂單.xlsx** + **biz_20250801001.xls**：訂單歷史（本次先不處理）

DB schema 90%+ 對得上（已查證）：
- `Products.ts` 有 SEO tab、preOrderNote、variants[colorName/sizeName/sku/stock/price]、sourcing.sourceId（Shopline ID upsert key）
- `Users.ts` 有 body measurements (height/weight/bust/waist/hips/footSize)、gender、birthday、memberTier、points、shoppingCredit、totalSpent、addresses、invoiceInfo、LINE/FB OAuth ID、firstTouchAttribution

**已建好的基礎建設**（直接複用，別重做）：
- `POST /api/products/shopline-xlsx`（[shoplineXlsxImport.ts](src/endpoints/shoplineXlsxImport.ts)）— upsert by sourcing.sourceId、dryRun、limit、status override
- [parseShoplineXlsx](src/lib/shopline/xlsxParser.ts) — 變體合併、價格 parse、變體 SKU 唯一驗證
- Admin panel: [ShoplineXlsxImporter.tsx](src/components/admin/ShoplineXlsxImporter.tsx) UI 已掛在 `/admin/collections/products`
- `GET/POST /api/migrate-images`（[route.ts](src/app/api/migrate-images/route.ts)）+ [ImageMigrationPanel.tsx](src/components/admin/ImageMigrationPanel.tsx) — 從 Shopline CDN 下載 + 上傳 Payload Media + 關聯商品
- Shopline CDN base 已 hardcode：`https://img.shoplineapp.com/media/image_clips` 和 `https://shoplineimg.com/559df3efe37ec64e9f000092`（這個是 chickimmiu 的 store ID）

## 執行順序建議（互相依賴）

```
Phase 1: 商品匯入（已建好可跑）   ─┐
Phase 2: 顧客匯入（要建 endpoint）─┤── 三個可平行
Phase 3: 圖片遷移（要擴 endpoint）─┘
Phase 4: 訂單匯入（先 skip，需訂單來建立會員 totalSpent 對得上）
```

---

## Phase 1：商品匯入跑起來（既有管線，幾乎零開發）

### 任務
跑既有 `/api/products/shopline-xlsx` endpoint 把 15 個檔案 import 進 prod DB。重複 (`sourcing.sourceId` 對得上的) 用 **update 覆蓋**。

### 子步驟
1. 先單檔 dry-run 驗證 parser 沒有 globalErrors：
   ```bash
   curl -X POST 'https://pre.chickimmiu.com/api/products/shopline-xlsx?dryRun=1' \
     -H 'Cookie: payload-token=<admin token>' \
     -F 'file=@chickimmiu-BulkUpdateForm-2026-04-12-15_38_0.xlsx'
   ```
   預期：`mode: 'dry-run'`, `totalProductsParsed: 500`, `totalVariantsParsed: ~1500`
2. 實際匯入第 0 檔：`?dryRun=0&status=draft`（先 draft，避免 7000 個未驗收商品衝上前台）
3. 抽樣驗 5 個 product 看：
   - `sourcing.sourceId` 有寫入 Shopline product ID
   - 變體有正確展開（不是被合併成一行）
   - 價格、SKU、weight 對得上
   - `category` 是 null（Shopline 用字串路徑 `Clothes>Dress`，DB 用 relationship → 需要 Phase 1.5 對照表，先空著）
4. 跑剩 14 檔
5. 驗總商品數 = 7226（DB query: `SELECT COUNT(*) FROM products WHERE sourcing_source_id IS NOT NULL`）

### Phase 1.5：分類對照表
Shopline 字串例子：`Clothes>Dress`、`Clothes>Top`、`Bag>Tote`
DB Categories 是樹狀 relationship。
- 寫 `scripts/build-shopline-category-map.ts` 掃所有 Shopline category 字串、輸出 unique list
- 人工 review → 寫 `data/shopline-category-map.json`：`{"Clothes>Dress": "<DB category id>"}`
- 寫 `scripts/apply-category-mapping.ts` 跑一次 update

⚠️ 注意：[xlsxParser.ts](src/lib/shopline/xlsxParser.ts) 看一下 category 欄位有沒有 parse 進來，沒有的話要先補。

### 驗收
- [ ] DB products count ≥ 7226（之前已有的不算）
- [ ] 抽 5 個有變體商品，variants[] 對得上 Shopline 顯示
- [ ] 抽 5 個分類，category relationship 連得上
- [ ] 抽 5 個 sourcing.sourceId，能回查 Shopline 原商品

---

## Phase 2：顧客匯入（要建新 endpoint）

### 為什麼要新建
既有 `/api/users/import`（[Users.ts:122 endpoints](src/collections/Users.ts:122)）只支援 generic CSV/XLSX 9 欄位（name/email/role/phone/points/shoppingCredit/totalSpent/birthday/referralCode/addresses）。Shopline 的 CustomerReport 有 **61 欄**，多出來的：

| Shopline 欄 | DB 欄 |
|---|---|
| 顧客 ID | 新欄 `users.shoplineCustomerId`（**新增**，當 upsert key fallback）|
| 加入日期 | `users.createdAt`（Payload 自動，但要手動 override）|
| 加入來源 | 新欄 `users.signupSource`（"前台購物網站" / "POS" / "LINE"）|
| 已發放/已扣除/已使用 點數 & 購物金 | 不存欄、計算用，可 skip |
| 接受 email/SMS/FB/LINE/WhatsApp 優惠 | `users.subscriptions.email/sms/...`（要查 Users.ts 有沒有）|
| 最後登入時間 | `users.lastLoginAt`（要查）|
| Facebook 註冊 ID / LINE 註冊 ID | `users.facebookId` / `users.lineId`（要查 OAuth 欄位名）|
| 收件人姓名/電話/地址 1/地址 2/城市/區域/郵遞區號 | 拼成一筆 `users.addresses[0]` |
| 會員級別字串（"一般會員" / "金牌" / "白金" / "黑鑽"）| `users.memberTier` (relationship to membership-tiers) — 要 lookup |
| 標籤 | `users.tags`（要查）|
| UTM 6 欄 | `users.firstTouchAttribution.{source,medium,campaign,...}` |
| 推薦人姓名/電郵/手機 | `users.referredByEmail`（要查 referral 欄位）|

### 子步驟
1. **先 grep Users.ts** 確認以下欄位現狀（把 grep 結果寫到 prompt 開頭，別假設）：
   ```
   subscriptions / facebookId / lineId / lastLoginAt / tags / referredBy / signupSource / shoplineCustomerId
   ```
2. 缺的欄位寫 migration 加上去（PRAGMA 冪等 pattern，照 [20260418_220000_add_login_attempts.ts](src/migrations/20260418_220000_add_login_attempts.ts) 模式）
3. 寫 `src/lib/shopline/customerXlsParser.ts`：
   - `xlrd` 讀 .xls（注意是 xls 不是 xlsx，要用不同 lib，或先轉成 xlsx）
   - 中文欄頭 → 英文 key 對應 map
   - 金額 parse（"NT$11,520" → 11520）
   - 日期 parse（"2026-04-08 22:19:58"、"05-07-1980"）
   - 性別 parse（"女"/"男"/"" → female/male/null）
   - 地址欄位拼裝成 addresses[] 結構
4. 寫 `src/endpoints/shoplineCustomerImport.ts`：
   - 模仿 [shoplineXlsxImport.ts](src/endpoints/shoplineXlsxImport.ts) 結構
   - **upsert key 順序**：email > shoplineCustomerId > phone（email 為主，empty 才 fallback）
   - dryRun mode
   - 不 hash 密碼（這些 user 沒密碼，後續走 forgot-password 流程或 OAuth 再補）
5. 寫 admin panel `ShoplineCustomerImporter.tsx` 模仿 ShoplineXlsxImporter，掛到 Users collection beforeListTable
6. 補 importMap regen：`pnpm payload generate:importmap`（**必做**，否則 admin component silently 不 mount，已踩 2 次坑見 MEMORY.md）

### 驗收
- [ ] dryRun 17,911 筆 parse 成功率 ≥ 99%
- [ ] 抽 10 個原本 Shopline 有 LINE 綁定的 user，匯入後 `users.lineId` 有值
- [ ] 抽 10 個有累積金額的 user，`totalSpent` 對得上
- [ ] 既有 OAuth login 還能進（不要 break）

---

## Phase 3：圖片遷移（最大缺口）

### 現狀
既有 [migrate-images/route.ts](src/app/api/migrate-images/route.ts) 支援：
- `GET` 列當前商品圖片狀態
- `POST { products: [{ name, slug, imageIds: [] }] }` 手動指定 imageIds 抓圖
- `POST { mode: 'auto' }` 用 seedProductImages 對照表

**缺最關鍵一步：從 Shopline 取得每個 product 的 image URL 對照**。BulkUpdateForm 不含圖片資訊。

### 三個方案（依 effort 排序）

#### 方案 A：Shopline OpenAPI（如果 user 有 API key）
- Shopline 有 [Open API v2](https://shopline-developers.readme.io/) 提供 `GET /api/products/{id}` 回傳含 `images: [{ images: { original, ... } }]`
- 用 user 的 access token 並行抓 7226 個 product
- 寫 `scripts/fetch-shopline-images.ts` → output `data/shopline-image-map.json` `{ shoplineProductId: ["url1", "url2", ...] }`
- **問題**：可能要 user 開 Shopline 帳號 → 應用市場 → 申請 OpenAPI access，1-3 工作天

#### 方案 B：爬前台 product page（最快但脆弱）
- Shopline 前台 URL pattern：`https://www.chickimmiu.com/products/{slug}` 或 `/products/{shopline_product_id}`
- 解析 `og:image` + JSON-LD `<script type="application/ld+json">` 含 `image: [...]`
- `scripts/scrape-shopline-images.ts` 跑 7226 次（**rate limit 1 req/s 避免被 ban**，2 hr 跑完）
- **風險**：Shopline DOM 改版會壞、user 還沒 cancel Shopline 訂閱（如果已停就抓不到）

#### 方案 C：Shopline 後台批次匯出
- 手動操作：Shopline admin → 商品 → 全選 → 「匯出圖片」（如果有此功能）
- **要 user 自己試一次看後台支不支援**

### 建議流程

```
Step 1: User 確認 Shopline 是否還在訂閱期 + 有沒有 API key
  ├─ Yes API key → 走方案 A
  ├─ Yes 還在訂閱但沒 API → 走方案 B（爬前台）
  └─ Shopline 已停 → 從 Wayback Machine 撈或放棄部分舊圖

Step 2: 寫 scripts/build-shopline-image-map.ts
  Output: data/shopline-image-map.json
  { "559e0c0669702d0e329e0100": ["https://img.shoplineapp.com/.../abc.jpg", ...] }

Step 3: 擴充 /api/migrate-images POST 支援新 mode:
  POST { mode: 'batch-from-map', mapping: {...}, concurrency: 5 }
  - 並行下載（Promise.all + p-limit）
  - 上傳到 Payload Media
  - 寫入 products.images[] (透過 sourcing.sourceId match)
  - 第一張設為 featuredImage
  - 失敗的 product 寫 retry queue（products 加 `imageMigrationStatus` 欄位 enum: pending/done/failed）

Step 4: 跑批量遷移
  - 先抽 10 個 dry run 看 R2 storage 有沒有正確上傳
  - 全跑 7226 個（estimate 每個商品 3-8 張圖，總共 2-5 萬張）
  - 用 R2 的話注意 egress 費用 + 上傳速度
  - 進度條：ImageMigrationPanel 加 progress bar（已有 fetch status 機制，擴 polling）

Step 5: 驗收
  - DB query: `SELECT COUNT(*) FROM products WHERE images_count > 0` ≥ 7000
  - 抽 20 個 PDP 看圖能 render
  - Media collection 總筆數對得上（去重後）
```

### 容量估算
- 7,226 商品 × 5 張圖平均 = 36,130 張
- Shopline 圖平均 200KB-1MB（依解析度）
- 總容量 ~10-30 GB
- R2 storage：**check chickimmiu R2 quota**（PR #6 提到 `74d908356510dce1fbdad700dc2e32df` access key 在 conversation log；R2 token rotation 仍 pending — 別忘記做）
- Hetzner CPX22 disk 80GB，prod 已用 ~30GB，**圖直接上 R2 別堆 local disk**

---

## 通用檢查清單

每跑一個 phase 後：
- [ ] `git log --oneline -10` 確認沒被 parallel session 搶先做
- [ ] `pnpm tsc --noEmit` 0 error
- [ ] 加 admin component 必跑 `pnpm payload generate:importmap` 並 commit
- [ ] migration 用 PRAGMA 冪等 pattern
- [ ] prod migrate 用 `yes y | pnpm payload migrate`（dirty schema prompt 會卡）
- [ ] prod build OOM 預防：`NODE_OPTIONS=--max-old-space-size=2048 pnpm exec next build`
- [ ] PR commit 訊息 prefix：`feat(import): ...` / `fix(import): ...`

## 不要做的事
- ❌ 不要動既有的 `/api/products/shopline-xlsx` endpoint（會壞）
- ❌ 不要動 OAuth 流程（PR #1/9/10 LINE bridge 很脆）
- ❌ 不要 `git add .` 全包（avoid sensitive files）
- ❌ 不要在 prod 直接 `rm -rf .next && pnpm build`（已有 2 次 outage）

## 參考檔案速查
- 既有 import: [src/endpoints/shoplineXlsxImport.ts](src/endpoints/shoplineXlsxImport.ts)
- 既有 parser: [src/lib/shopline/xlsxParser.ts](src/lib/shopline/xlsxParser.ts)
- 既有圖片 endpoint: [src/app/api/migrate-images/route.ts](src/app/api/migrate-images/route.ts)
- 既有圖片 UI: [src/components/admin/ImageMigrationPanel.tsx](src/components/admin/ImageMigrationPanel.tsx)
- Products schema: [src/collections/Products.ts](src/collections/Products.ts)
- Users schema: [src/collections/Users.ts](src/collections/Users.ts)
- Membership tiers: [src/collections/MembershipTiers.ts](src/collections/MembershipTiers.ts)
- Categories: [src/collections/Categories.ts](src/collections/Categories.ts)
- 部署腳本: `ssh root@5.223.85.14 /root/deploy-ckmu.sh`
- prod 路徑：`/var/www/chickimmiu/`
