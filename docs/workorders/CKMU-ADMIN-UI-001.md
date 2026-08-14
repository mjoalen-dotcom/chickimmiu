# CKMU-ADMIN-UI-001｜chickimmiu Payload 後台專業化工作單

| 項目 | 內容 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-08-14 |
| 發起 | Alan Miaou |
| 執行 | Claude Code（規劃審計：Fable 5 / 批量執行：Sonnet 4.6） |
| 範圍 | pre.chickimmiu.com（staging，nginx + PM2 @ Hetzner）→ 驗證後併入正式切換 |
| 狀態 | 待啟動（Phase S 建議今日執行） |
| 關聯 | BP-002（P0 cart/OAuth 外包）、INFACE V1 API 三問（附件 A） |

> 域名確認：staging 實際為 **pre.chickimmiu.com**（雙 m）；pre.chickimiu.com（單 m）無 DNS 紀錄。www.chickimmiu.com 目前仍為 Shopline 舊站（遷移未切換），本工作單全部作用於 pre 新站。

---

## 1. 外部審計結果（2026-08-14 實測，未登入狀態）

### 1.1 ⚠️ P0-SEC：商品成本結構公開外洩

`GET /api/products` 未登入即回 200，且每筆商品文件含以下內部欄位：

| 欄位 | 風險 |
|---|---|
| `cost` | **進貨成本直接可讀**。1,395 件商品可被整批爬取，等於公開 CKMU 全品類成本與毛利結構（2025 年毛利 68.8% 為核心商業機密） |
| `sourcing` | 採購來源／供應鏈資訊 |
| `totalSold` | 單品銷量，可回推營收結構與爆品策略 |
| `autoPricing` | 定價邏輯 |
| `isLowStock` / `lowStockThreshold` | 庫存策略（中度） |

競品情境具體存在（EMBA 同學 Darren 為同品類直接競爭者）。**此項優先於一切 UI 工作，30 分鐘可修，今日部署。** → Prompt S

### 1.2 存取控制現況

| Endpoint | 狀態 | 判定 |
|---|---|---|
| /api/orders | 403 | ✅ 已鎖 |
| /api/users | 403 | ✅ 已鎖（顧客是否與 admin 混用同一 users collection [未經驗證]，審計確認） |
| /api/products | 200 公開 | 前台需要，合理；**但欄位級未過濾** → §1.1 |
| /api/media | 200 公開（21,962 筆） | 圖片公開合理 |
| /api/pages（5）/ categories（135） | 200 公開 | 合理；categories 含 `uncategorized` → 分類待治理 |
| /api/users/me | `{"user":null}` | Payload cookie auth 正常 |
| /admin | **200 未轉向 login** | Payload 3 正常應 server-side redirect 至 /admin/login；需登入驗證是否僅 client-side 擋 [未經驗證] → Prompt A 檢查項 |

### 1.3 Staging 防護半套

- robots.txt 已 `Disallow: /` ✅
- 但首頁 meta 為 `index, follow` ❌、無 `X-Robots-Tag` header ❌ → 有外部連結仍會被收錄，且 Disallow 反而讓 Google 讀不到 noindex
- 全站無 basic auth，任何人知道網址即可存取（含 §1.1 的 API）→ Prompt F

### 1.4 後台現況與工程品質

- 已部分中文化：admin title「CHIC KIM & MIU 後台」（meta.titleSuffix 已設）；favicon 仍為 Payload 預設 → branding 未完成
- 安全 headers（CSP/HSTS/XFO）配置完整，CSP 已含 ECPay、LINE Pay、藍新、R2、shoplineimg（舊圖沿用）→ 基礎工程品質不差，本工作單是「補齊」不是「重做」
- **products 頂層欄位達 60 個**（含 ads*、seo、sizeChart、stylingTips、koreanCelebrityRef 等）→ 編輯頁不 tabs 化，營運人員無法工作 → Phase 1 鐵證
- 資料量：products 1,395 / media 21,962 / categories 135 / pages 5 → 遷移完成度高

---

## 2. 優先序（本工作單執行順序）

```
Phase S  API 欄位級權限修補        0.5h   今日，獨立部署
Phase 0  Repo 全站審計（read-only） 0.5d
Phase 1  結構層：分組/欄位/中文化    1d
Phase 2  體驗層：Dashboard/Branding 0.5–1d
Phase 3  治理層：角色權限/Staging防護 0.5d
─────────────────────────────────
時間盒上限 3 天（不含 Phase S）
```

---

## 3. 驗收標準（Definition of Done）

1. 公開 API 回應不含 `cost` / `sourcing` / `totalSold` / `autoPricing`（驗證指令見 §5 Prompt S 末）
2. 側邊欄分組 ≤ 6 組，無未分組 collection
3. 每個 collection：`useAsTitle` + `defaultColumns` 3–5 欄 + zh-TW labels + `admin.description`，列表頁一眼可辨識
4. products 編輯頁 tabs 化（基本資訊／價格庫存／圖片媒體／內容行銷／廣告與SEO／物流規格）
5. Dashboard ≥ 4 張營運指標卡（今日訂單、待出貨、低庫存、本週新增會員）+ 快速入口
6. Logo / favicon 取代 Payload 預設，套用 CKMU 色票
7. 角色分級：admin / operator，operator 不可見系統設定類 collection
8. pre 站送出 `X-Robots-Tag: noindex, nofollow`；basic auth 決策已定（做或明確不做）
9. 產出 `docs/admin-ui/ADMIN-STRUCTURE.md`、`docs/api/API-STRUCTURE.md`、before/after 截圖
10. 全程單一 branch `admin-ui/001`、單一 PR，revert 即可回滾；`ai-report` 回報

---

## 4. 執行守則（每個 Prompt 開頭已內建）

1. 開工先讀 `AI-INBOX.md` 與 `AI-CONTEXT.md`（CHICMIU-5090 協定），不覆寫他人條目、不動 Codex 保留設定
2. 全部修改在 branch `admin-ui/001`；Phase S 例外，用 `hotfix/api-field-access` 獨立出單
3. **禁改清單**（與 BP-002 外包隔離）：checkout / cart 相關檔案、users collection 的 auth 區塊、`next.config.*`、付款金流整合檔
4. 只加 `admin.*` 屬性與 `access` 函式，**不改任何欄位 name / type / relation** → 不觸發 DB migration，SQLite 零風險
5. 每 Phase 結束：commit + 截圖 + 等 Alan 確認再進下一 Phase

---

## 5. Claude Code 提示詞（依序貼用）

### Prompt S｜緊急：API 欄位級權限（今日）

```
角色：Payload 3 資深工程師。緊急安全修補，範圍最小化。
背景：GET /api/products 未登入可讀，回應含 cost、sourcing、totalSold、
autoPricing、lowStockThreshold 等內部欄位，屬商業機密外洩。

任務：
1. 建 branch hotfix/api-field-access。
2. 找到 Products collection 定義檔，對下列欄位加 field-level access：
   read: ({ req }) => Boolean(req.user)
   欄位：cost, sourcing, totalSold, autoPricing, lowStockThreshold,
   isLowStock, imageMigration。（purchaseLimit 為前台限購顯示，保留公開）
3. 檢查 variants 子欄位與其他公開 collections（media, pages, categories,
   globals）是否含同類內部欄位（cost/supplier/margin/note 類），一併處理，
   列清單給我確認後再改。
4. 確認前台程式未依賴這些欄位渲染（grep 使用處）；若有，改走
   authenticated local API 或移除顯示。
5. 本地驗證後告訴我部署指令，我執行。
驗證（部署後執行）：
curl -s "https://pre.chickimmiu.com/api/products?limit=1" | grep -c '"cost"'
預期輸出 0。
禁止：改欄位 name/type、動 schema、碰 checkout 相關檔案。
```

### Prompt A｜Phase 0：全站審計（read-only）

```
角色：Payload CMS 架構師。只讀審計，禁止修改任何檔案。
1. 先讀 AI-INBOX.md、AI-CONTEXT.md。
2. 輸出版本資訊：package.json 內 payload、next、@payloadcms/* 全部版本、
   db adapter、部署腳本。
3. 表格列出全部 collections 與 globals：slug｜用途｜欄位數｜是否已設
   admin.group / useAsTitle / defaultColumns / zh labels / 欄位 description｜
   access 設定摘要。
4. 列出 payload.config.ts 的 admin 設定現況（meta、components、i18n、
   custom.scss、dateFormat）。
5. 檢查未登入訪問 /admin 為何回 200 而非 redirect 至 /admin/login：
   確認 server-side auth 是否生效，或僅 client-side 擋。這是資安確認項。
6. 確認顧客帳號與後台管理員是否共用 users collection；若共用，評估
   分離成本。
7. 問題分級：P1 影響營運辨識／P2 體驗／P3 美化。
8. 產出 docs/admin-ui/AUDIT-20260814.md 與 docs/api/API-STRUCTURE.md
   （auth 機制、REST endpoint 全清單、各 collection 讀寫權限矩陣、
   response 分頁形狀、products 完整 schema）。
9. 結尾 10 行內給重構建議，停下等我確認。
```

### Prompt B｜Phase 1：結構層重構

```
依 AUDIT-20260814.md 執行，branch admin-ui/001。只加 admin 層屬性，
不改欄位 name/type/relation，不產生 migration。

1. admin.group 分組（≤6 組，slug 以審計為準）：
   商品管理：products, categories, （variants 若獨立）
   訂單管理：orders 及其相關
   會員管理：顧客類 collection
   內容管理：pages, media, banners/posts 類
   系統設定：users(管理員), globals
2. 每個 collection：useAsTitle（名稱類欄位）、defaultColumns 3–5 欄
   （例 products: name, productSku, price, stock, status, updatedAt 擇 5）、
   listSearchableFields（name, sku, slug）。
3. 全部 collections 與欄位補 zh-TW labels 與 admin.description，
   標準：不懂電商系統的營運同仁能看懂每個欄位在做什麼。
4. products 編輯頁改 tabs：基本資訊／價格庫存／圖片媒體／內容行銷
   （stylingTips, koreanCelebrityRef, modelInfo, sizeChart）／廣告與SEO
   （ads*, seo, googleProductCategory, gtin, mpn）／物流規格
   （weight, dimensions, hsCode, taxCategory, productOrigin）。
   內部欄位（cost, sourcing, totalSold）集中「內部資料」tab 並標示
   僅管理員可見。
5. 關聯與狀態欄位移 sidebar（status, publishAt, category, slug）。
6. categories 的 uncategorized 與 sortOrder 亂序：列清單建議，不擅自改資料。
每完成 3 個 collections commit 一次，全部完成後截圖列表頁給我看。
```

### Prompt C｜Phase 2a：營運 Dashboard

```
branch admin-ui/001。用 Payload 3 admin.components（beforeDashboard 或
自訂 Dashboard view）建營運面板，Server Component + Local API：
1. 指標卡 ×4：今日訂單數與金額｜待處理訂單（依 status）｜
   低庫存商品數（isLowStock）｜本週新增會員。
2. 快速入口：新增商品、待出貨清單、媒體庫。
3. 樣式只用 Payload 內建 CSS variables，不引入外部 UI 庫。
4. 查詢全部走 payload.count / payload.find，注意 SQLite 下的查詢成本，
   必要時加 select 限縮欄位。
完成後截圖給我。
```

### Prompt D｜Phase 2b：Branding 與 i18n

```
branch admin-ui/001。
1. admin.components.graphics.Logo 與 Icon 換 CKMU SVG
   （檔案位置：____，Alan 提供；暫無則先用文字 logo「CHIC KIM & MIU」）。
2. meta：favicon 換掉 payload 預設、titleSuffix 維持「｜CHIC KIM & MIU 後台」、
   ogImage 補上。
3. custom.scss：主色票 ____（Alan 提供 hex；未提供前不動色系）。
4. i18n：啟用 zh-TW 為預設語言（@payloadcms/translations zhTw），
   保留 en fallback。
5. dateFormat: 'yyyy-MM-dd HH:mm'。
```

### Prompt E｜Phase 3a：角色權限

```
branch admin-ui/001。
1. 管理員 users collection 加 role select（admin / operator），預設 operator。
2. access 矩陣：operator 可管商品/訂單/內容；不可見系統設定 globals、
   不可管 users、不可刪除 collection 文件（軟性：status 改 archived）。
   admin.hidden: ({ user }) => user?.role !== 'admin' 套用於系統類。
3. 既有帳號全部標 admin，避免鎖死自己。列出現有帳號清單給我確認。
4. 產出權限矩陣表寫入 ADMIN-STRUCTURE.md。
```

### Prompt F｜Phase 3b：Staging 防護

```
1. nginx（pre.chickimmiu.com server block）加：
   add_header X-Robots-Tag "noindex, nofollow" always;
   給我 nginx conf diff 與 reload 指令，我執行。
2. Next.js：當 host 為 pre.* 時 metadata robots 設 noindex（環境變數
   NEXT_PUBLIC_ENV=staging 判斷），修正目前 index,follow 的 meta。
3. basic auth 評估：一組帳密保護整個 pre 站（含 API）。列出對
   前台預覽分享、Webhook、金流 sandbox callback 的影響，我決策後再做。
4. robots.txt 維持 Disallow。
```

---

## 6. 風險與停損

| 風險 | 對策 |
|---|---|
| 與 BP-002 外包改到同批檔案 | §4 禁改清單 + branch 隔離；Phase S 走 hotfix 獨立 branch，先合先贏，外包 rebase |
| staging / 正式切換分歧 | 全部改動在同一 codebase config 層，切換時隨 repo 帶上；不在伺服器上手改（nginx 除外，conf 入版控 docs/ops/） |
| Payload 版本過舊致 API 不符 | Prompt A 先查版本；若 < 3.x 或客製過深 → 降級只做 Phase S + Phase 1，其餘另開工作單 |
| 改壞後台 | 只動 admin 層與 access 函式、零 migration；單一 PR revert 即復原 |
| 時間失控 | 3 天硬停損；Dashboard 做不完先上 2 張卡，不追求完整 |
| 成本 | 內部 Claude Code 完成，NT$0 外包；若併入 BP-002 加購，上限 NT$10K |

---

## 7. 交接與紀錄

- `docs/admin-ui/ADMIN-STRUCTURE.md`：分組結構、欄位對照、權限矩陣（Phase 1/3 產出）
- `docs/api/API-STRUCTURE.md`：API 全貌（Phase 0 產出）→ 同步供 INFACE 使用
- before/after 截圖 → `docs/admin-ui/screenshots/`
- DECISION-LOG.md 補記：P0-SEC 發現與處置日期
- 完工 `ai-report` 回報，AI-INBOX.md 更新狀態

---

## 附件 A｜INFACE V1 API 三問連動（本次實測已可部分回答）

已確認事實（2026-08-14 外部實測）：

1. **API base**：`https://pre.chickimmiu.com/api`（Payload REST 標準路徑；正式切換後隨主域）
2. **Auth 機制**：Payload cookie-based auth，`/api/users/me` 標準格式；users collection 即 auth collection
3. **存在的 collections（REST 可見）**：products, orders, users, media, pages, categories（**無** customers、posts 路由）
4. **回應形狀**：Payload 標準分頁 `{ docs, totalDocs, limit, page, totalPages, ... }`，支援 `?limit=&depth=` 參數
5. **products schema**：60 個頂層欄位，完整 keys 清單已取得（見 API-STRUCTURE.md 產出後之正式版）

→ 動作：Alan 將 INFACE 三問原文貼入本節對照；若三問屬上述範圍，**阻塞即刻解除，不需等工程團隊回覆**。未覆蓋部分由 Prompt A 的 API-STRUCTURE.md 補齊。

---

*v1.0 完 · 下一步：先貼 Prompt S（今日），再依 Phase 順序執行*
