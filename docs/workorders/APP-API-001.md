# APP-API-001｜APP 串接 API v1 契約層工作單

版本 v1.0｜2026-08-14｜時間盒 4–5 天｜branch `app-api/001`｜前置：DB-PG-001 完成

## 0. 定位

Payload 已自動生成全站 REST（實測確認：`/api/products` 等）。本工作單**不是從零造 API**，是在其上建 `/api/v1` 契約層：行動端瘦身回應、顧客 JWT 認證、業務端點、文件化。**契約凍結後 APP 開發即並行啟動**——凍結前 APP 不動工，避免返工。

## 1. v1 資源範圍

| 模組 | 端點（草案） | 認證 |
|---|---|---|
| 認證 | POST /v1/auth/register、/login、/refresh、GET /v1/me | 公開／JWT |
| 商品 | GET /v1/products（分頁＋篩選＋排序）、GET /v1/products/{slug} | 公開 |
| 分類 | GET /v1/categories（樹狀） | 公開 |
| 購物車 | GET／POST／PATCH／DELETE /v1/cart | JWT（訪客車另議，決策點 D3） |
| 結帳 | POST /v1/checkout → 金流導轉資訊 | JWT |
| 訂單 | GET /v1/orders（我的）、GET /v1/orders/{id} | JWT |
| 會員 | GET／PATCH /v1/me/profile、地址簿 CRUD | JWT |
| 內容 | GET /v1/pages/{slug}、/v1/banners | 公開 |

商品列表瘦身 DTO（草案）：`id, name, slug, price, salePrice, featuredImage{url,w,h}, isHot, isNew, inStock`——不是後台那 60 欄火力全開。

## 2. ⚠️ 前置封鎖項：顧客／管理員帳號分離

實測 `/api/users` 403、`/api/customers` 404 → 顧客可能與後台管理員**共用 users collection** [未經驗證]。若共用，發給 APP 的 JWT 等於後台鑰匙——**必須先拆**獨立 `customers` auth collection 才能開工。此判定由 ADMIN-UI-001 Prompt A 審計第 6 項給出，為本工作單 Phase 1 的第一動作。

## 3. 驗收標準（DoD）

1. OpenAPI 3.1 spec 完整（全端點、schema、錯誤碼），`docs/api/openapi-v1.yaml`
2. 顧客 auth 與後台管理員**完全隔離**：顧客 JWT 打不進 /admin 與管理 API（滲透測試 3 項：顧客 token 打 /api/users、/api/orders 全量、/admin──全部 403）
3. 全端點自動化測試通過（含 401／403／404／422 錯誤路徑）
4. Rate limit 生效（nginx limit_req：公開端點 20r/s、auth 端點 5r/m）並實測
5. 行動端回應瘦身：/v1/products 單筆 payload < 2KB
6. Postman collection＋環境檔交付 APP 團隊
7. **契約凍結簽核**：Alan 簽字日期記入本文件 §6，之後改動走 v1.1 附錄

## 4. 工作分解與提示詞

- **Phase 1（1d）認證基礎**：customers 分離＋JWT 流
- **Phase 2（2d）業務端點**：v1 全端點＋DTO＋錯誤規格
- **Phase 3（1d）加固**：rate limit、CORS、滲透測試三項
- **Phase 4（0.5–1d）文件化**：OpenAPI＋Postman＋凍結評審

### Prompt Q1｜Phase 1：顧客認證

```
branch app-api/001。先讀 AI-INBOX.md / AI-CONTEXT.md 與 docs/api/API-STRUCTURE.md。
1. 依審計結果確認顧客帳號現況。若與管理員共用 users：建立獨立 customers
   auth collection（email＋密碼＋手機＋地址簿），既有顧客資料遷移方案
   先給我確認再執行；管理員 users 保持不動。
2. JWT 策略：Payload auth 發 token，行動端走 Authorization header；
   token 效期 2h、refresh 14d、refresh rotation。
3. /v1/auth/register、/login、/refresh、/v1/me 完成並附測試。
4. 密碼原則與嘗試鎖定（5 次錯誤鎖 15 分鐘，Payload lockTime 設定）。
禁止：動管理員 users 的 auth 設定、動 checkout 既有網頁流程。
```

### Prompt Q2｜Phase 2：業務端點

```
branch app-api/001。以 Payload custom endpoints 或 Next route handlers 實作 §1 表格
全端點（挑一種並說明理由，全程一致）：
1. DTO 層獨立成 transformers，禁止直接吐 collection 原始文件；
   內部欄位（cost/sourcing/totalSold 等）在型別層就不存在於回應。
2. 統一回應格式 { data, meta } 與錯誤格式 { error: { code, message } }，
   錯誤碼表寫入 openapi。
3. 商品列表：分頁（cursor 或 page 擇一說明理由）、分類篩選、價格排序、
   關鍵字搜尋（name/sku）。
4. /v1/checkout：產出 ECPay 導轉參數（webview 流程，決策點 D1 未決前
   先做 webview 版）。
5. 每端點附整合測試（成功＋每種錯誤路徑）。
```

### Prompt Q3｜Phase 3＋4：加固與文件

```
branch app-api/001。
1. nginx limit_req：/api/v1 公開 20r/s burst 40；/v1/auth/* 5r/m。
   conf 入版控 docs/ops/，給我 diff 我執行 reload。
2. 滲透測試三項（DoD §2）自動化腳本化，輸出報告。
3. 產出 openapi-v1.yaml（可用 zod-to-openapi 或手寫，以準確為先）＋
   Postman collection＋.env.example 更新。
4. 產出「契約凍結評審包」：端點總表＋DTO 樣例＋未決決策點清單，
   排我 30 分鐘評審。
```

## 5. 決策點（Alan 拍板，不阻塞 Phase 1–2 開工）

| # | 決策 | 選項 | 預設建議 |
|---|---|---|---|
| D1 | ECPay 行動端流程 | webview 導轉（快、成本低）vs 原生 SDK（體驗好、工期＋1w） | 先 webview，v1.1 再評 SDK |
| D2 | APP 技術棧 | React Native + Expo（與 INFACE 同棧，人才共用）vs 原生 | RN + Expo──與 INFACE 工程資產複用 |
| D3 | 訪客購物車 | 需登入才有車（簡單）vs 訪客車合併（轉換率好、工期＋2d） | v1 先登入車，數據說話後補 |
| D4 | 推播 | v1 不含 vs 含（工期＋2d） | v1 不含，訂單狀態先靠 Email |

## 6. 契約凍結紀錄

| 版本 | 日期 | 簽核 | 備註 |
|---|---|---|---|
| v1.0 | ____ | Alan | 凍結後 APP 開發啟動 |

*v1.0 完*
