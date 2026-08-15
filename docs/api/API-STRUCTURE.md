# API-STRUCTURE.md｜chickimmiu Payload REST API 全貌

執行：CKMU-AUTOPILOT-001 步驟02（ADMIN-UI-001 Prompt A）｜日期：2026-08-15｜範圍：`hetzner/main` commit `b7000d1`
供 INFACE 團隊與 APP 工程師（APP-API-001 前置參考）使用。**本文件描述 Payload 自動生成的既有 REST（`/api/*`），非 `/v1` 契約層（`/api/v1/*`，另見 APP-API-001 規劃中）。**

---

## 1. Base URL 與端點規則

- **Base URL**：`https://pre.chickimmiu.com/api`（正式切換後隨主域 `https://www.chickimmiu.com/api`）
- Payload 3 為每個 collection 與 global 自動生成標準 REST 路由，無需手寫：

| 資源類型 | 端點模式 | 方法 |
|---|---|---|
| Collection | `/api/{slug}` | `GET`（list）、`POST`（create） |
| Collection 單筆 | `/api/{slug}/{id}` | `GET`、`PATCH`、`DELETE` |
| Global | `/api/globals/{slug}` | `GET`、`POST`（update） |
| 目前使用者 | `/api/users/me` | `GET` |
| 登入 | `/api/users/login` | `POST` |

完整 collection/global slug 清單、各自的欄位數與 access 摘要 → 見 `docs/admin-ui/AUDIT-20260814.md` §2、§3（78 collections + 25 globals 逐一列表）。此處不重複，僅補 API 層特有資訊。

- **既有管理員後台工具**：`/admin/api-docs`（登入後可見）從 payload config sanitized 後即時產生端點表 + curl 範例，永遠與程式碼同步，可作為即時參照（本文件為靜態快照，供離線閱讀/交接用）。

---

## 2. 認證機制

**兩條認證路徑並存**，工程師依情境擇一：

1. **Cookie session（瀏覽器端）**：`POST /api/users/login`（body: `{email, password}`）成功後，Payload 設定 httpOnly cookie；後續請求瀏覽器自動帶上，或手動 `fetch(url, { credentials: 'include' })`。`GET /api/users/me` 回傳 `{"user": null}`（未登入）或使用者物件。
2. **Bearer JWT（App / server-to-server）**：同一組 `/api/users/login` 回應內含 `token` 欄位；後續帶 `Authorization: JWT <token>` header（**注意前綴是 `JWT` 不是標準的 `Bearer`** — Payload 3.83 `payload.auth` 原生只認 `JWT ` 前綴）。專案內 `src/lib/auth/resolveBearerUser.ts` 是統一入口，把 App 端可能送來的 `Bearer <token>` 格式轉換相容，非另立一套認證機制。已用於 `/api/v1/me`、`/api/v1/points/read-reward` 等早期 v1 端點。

**權限模型**：`users` collection 單一 auth collection，`role` 欄位（admin/partner/customer）決定權限範圍（詳見 `docs/admin-ui/AUDIT-20260814.md` §5.2 — 顧客與管理員現況共用同一 collection，role 欄位寫入已鎖 admin-only）。多數 collection 的 access 函式讀取 `req.user.role` 或 `req.user.id` 做「本人／admin」或「isAdmin」判斷（見 AUDIT 文件 access 摘要欄）。

**Rate limiting**：❌ 目前**未實作**（`/etc/nginx/` 內無 `limit_req` 設定）。規劃於 APP-API-001 步驟18（Prompt Q3）：公開端點 20r/s burst 40、`/v1/auth/*` 5r/m。**現況任何端點皆無流量限制，屬已知缺口，非本次新發現（原工單已排程）。**

---

## 3. 回應形狀

**List 端點**（`GET /api/{slug}`）標準分頁格式：

```json
{
  "docs": [ /* 資料陣列 */ ],
  "totalDocs": 1395,
  "limit": 10,
  "totalPages": 140,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

支援的常用 query 參數：`?limit=`（0=全部，效能陷阱需注意）、`?page=`、`?depth=`（relationship/upload 展開層數，0=只回 id）、`?where[field][operator]=value`（篩選）、`?sort=field` / `?sort=-field`（降冪）。

**單筆端點**（`GET /api/{slug}/{id}`）直接回傳資料物件本身，無包裝。

**Global 端點**（`GET /api/globals/{slug}`）同樣直接回傳物件本身（無 docs 包裝，因為 global 只有一份資料）。

**錯誤格式**：Payload 標準 `{ "errors": [{ "message": "...", ... }] }`，HTTP 狀態碼對應 400/401/403/404/422。

---

## 4. Products Collection 完整 Schema（供 APP /v1/products DTO 設計參考）

`products` collection 是 APP-API-001 v1 契約層最主要的資料源。完整實讀確認：

### 4.1 頂層結構

Payload config 內字面上共 12 個頂層 `fields` 陣列元素（含 1 個 `row` 包裝、1 個未命名 `tabs` 容器）；**`tabs` 只是後台編輯 UI 的分頁視覺分組，不影響實際 API 回應結構**——tabs 內所有欄位在 REST/GraphQL 回應中都是攤平的頂層欄位，與 `status`、`isNew` 等同層級並列，沒有巢狀在某個 tab key 底下。

**Sidebar 欄位（頂層陣列直接元素）**：
| 欄位 | 型別 | 說明 | REST 是否公開 |
|---|---|---|---|
| `status` | select | draft/published/archived | 是（值本身可讀；collection-level access 已過濾未登入者僅見 published） |
| `publishAt` / `unpublishAt` | date | 排程自動上下架 | 是 |
| `isNew` / `isHot` | checkbox | 新品/熱銷徽章 | 是 |
| `productSku` | text | 商品層 SKU | 是 |
| `isLowStock` | checkbox | 系統自動判斷低庫存 | **否**（步驟01已限登入者，公開API不回傳） |
| `totalSold` | number | 累計售出（前台徽章≥50件顯示） | **否**（同上；前台透過 Local API 渲染不受影響） |
| `sourcing` | group | 內部採購資訊（sourceId/supplierName/supplierLocation/costKRW/costTWD/exchangeRate/originalDescription/fabricInfo） | **否**（整組被擋） |
| `imageMigration` | group | 內部圖片搬遷進度追蹤 | **否**（整組被擋） |
| `marginInsight`／`wizardLauncher` | ui | 純後台 UI 元件，無資料值 | 不適用（無實際欄位資料） |

**Tab①「基本與價格」（15 項）**：`name`／`slug`／`aliasSlugs`(陣列)／`brand`／`productOrigin`／`description`(richText)／`shortDescription`／`autoPricing`(group，**否**，含 useAutoPricing/costAmount/costCurrencyCode)／`price`／`salePrice`／`cost`(**否**)／`taxCategory`／`category`(relationship)／`additionalCategories`(relationship, hidden)／`tags`(陣列)／`collectionTags`／`koreanCelebrityRef`(group)／`weight`／`dimensions`(group: length/width/height)／`purchaseLimit`(**是**，前台限購顯示用，故意保留公開)

**Tab②「媒體與變體」（9 項）**：`featuredImage`／`introVideo`／`images`(陣列)／`variantMatrixTool`(ui)／**`variants`**(陣列，見 4.2)／`stock`／`lowStockThreshold`(**否**)／`sizeChart`(relationship)／`allowPreOrder`／`preOrderNote`

**Tab③「穿搭與 SEO」（8 項）**：`material`／`materialDescription`／`materialImages`(陣列)／`careInstructions`／`modelInfo`(group)／`stylingTips`／`personalityTypes`(select hasMany, 16 MBTI 選項)／`seo`(group: metaTitle/metaDescription/metaImage)

**Tab④「廣告與進階」（7 項）**：`excludeFromAdsCatalog`／`adsGender`／`adsAgeGroup`／`adsCondition`／`googleProductCategory`／`productType`／`gtin`／`mpn`／`hsCode`／`adsTitleOverride`／`adsDescriptionOverride`

### 4.2 `variants` 陣列子欄位（9 個）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `colorName` | text | 是 | 顏色名稱 |
| `colorCode` | text | 否 | HEX 色碼 |
| `colorSwatch` | upload(media) | 否 | 色塊圖，前台優先顯示 |
| `size` | text | 是 | 尺寸 |
| `sku` | text | 是 | 變體 SKU，商品內不可重複 |
| `stock` | number | 是 | 變體庫存 |
| `priceOverride` | number | 否 | 留空用商品 price |
| `costOverride` | number | 否 | 留空用商品 cost；⚠️**與頂層 `cost` 同類但未受 field-level access 保護**（見下方 §5 標記） |
| `gtin` | text | 否 | Meta/Google Shopping 比對用 |

### 4.3 已知欄位級公開範圍缺口（供 APP-API-001 DTO 設計參考，不在本次修補範圍）

`variants.costOverride` 與頂層 `cost` 屬同一商業機密等級（採購成本），但目前**未**套用步驟01的 field-level access 限制（Prompt S 原始範圍只列了頂層 7 個欄位，未含 variants 子欄位）。**建議 APP-API-001 Phase 2（DTO transformer 設計）明確排除此欄位**，不要在 `/v1/products` DTO 中原樣透傳；若要徹底補齊，公開 API（Payload 原生 REST）本身也應比照修補，待 Alan 授權。

---

## 5. 憑證/機密欄位總覽（跨 collection/global，供資安複查用）

| 位置 | 欄位 | 保護狀態 |
|---|---|---|
| `products` × 7 欄位 | cost/sourcing/totalSold/autoPricing/lowStockThreshold/isLowStock/imageMigration | ✅ 已修（步驟01，isLoggedInFieldLevel） |
| `products.variants` | costOverride | ⚠️ 未修（見§4.3） |
| `global-settings.socialLogin` | googleClientSecret/facebookAppSecret/lineChannelSecret/applePrivateKey | ✅ 既有正確保護（isAdminFieldLevel） |
| `global-settings.tracking` | metaCapiToken | ⚠️ 未修（本次審計新發現，DB現況空值） |
| `global-settings.sinsangMarket` | accessToken | ⚠️ 未修（本次審計新發現，DB現況空值；欄位描述聲稱「加密儲存」但無對應實作） |
| `crm-settings` | lineChannelAccessToken/lineChannelSecret | ✅ 已修（步驟01追加） |
| `invoice-settings.ecpayConfig` | merchantId/hashKey/hashIV | ✅ 已修（步驟01追加） |
| `marketing-automation-settings` | LINE OA/Email/SMS/Push/EDM 各管道憑證 | ✅ 已修（步驟01追加） |
| `ads-catalog-settings` | feedSecretToken/systemUserToken | ✅ 已修（步驟01追加） |

---

*本文件與 `docs/admin-ui/AUDIT-20260814.md` 同批產出，步驟02 唯讀審計，未修改任何程式檔案。*
