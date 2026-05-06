# CHIC KIM & MIU 電商平台 分階段開發 Checklist

**Stage**：封閉測試（pre.chickimmiu.com）
**Last updated**：2026-04-27

---

## Current status snapshot（2026-04-19）

| Phase | 狀態 | 備註 |
|---|---|---|
| **Phase 1** 封測與前後台串接 | 🟢 大致達成 | QA 2026-04-18 掃過 11 條路徑；ISSUE-001..008 由 PR #1/#2 解；PR #3（cart/shipping/庫存）+ PR #4（CSP/HSTS/admin BasicAuth）已 merge |
| **Phase 2** 完整會員系統 | 🟢 大致達成 | Auth 三連體 + `/account` gate 完成（PR #1/#2）；身體量測 + 發票欄位完成（`bde53b1`）；LINE OAuth state+nonce 補強（`62278e7`）；OAuth↔Payload cookie 橋接完成（`98c877a`）；email 驗證信 + 後台一鍵開關完成（本 PR）|
| **Phase 3** 遊樂場系統連結 | ⚪ 未開始 | 外部 API、身份對應、前台點數顯示 |
| **Phase 4** 完整訂單系統 | ⚪ 未開始 | Orders schema 已有；結帳 → Order → 狀態流 → 確認信 + 發票 待接 |
| **Phase 5** 金流與進階功能 | ⚪ 未開始 | ECPay 正式、PayPal、推薦引擎、Gamification、CSP 強化 |
| **Phase 6** 庫存履約缺口 | ⚪ 未開始 | Session 25 master plan：StockMovements / 批次出貨 / 盤點 / 訂單匯出 / Dashboard |

---

## Phase 1：封閉測試與前後台完整串接檢查（最優先）

**目標**：確保目前已上線的功能穩定可用

- [x] 前後台資料同步檢查（Product、Category、Media、UGCPosts 等）
- [x] 所有 API 端點測試（`/api/cart`、`/api/shipping-settings`、`/api/users/*`）
- [x] Payload Admin 後台權限與顯示確認
- [x] 基礎頁面載入效能與錯誤處理檢查
- [ ] 完成測試後標記「封測結束」

**完成標準**：全站無明顯 Bug，前後台資料一致

---

## Phase 2：完整會員系統（次優先）

**目標**：讓使用者能正常註冊、登入、管理個人資料

- [x] Payload Users Collection 完整啟用與權限設定
- [x] 註冊 / 登入 / 登出 / 忘記密碼完整流程
- [x] 加入會員信件驗證（Email verification，使用 Resend）— 後台 `GlobalSettings → Email 註冊/驗證` 可一鍵開關
- [x] 個人資料頁擴充（身體量測：腳長 / 胸圍 / 腰圍 / 臀圍 + 公司發票資料）— `bde53b1`
- [x] 會員專屬頁面（/account、/points、/referrals、/wishlist、/orders）
- [x] OAuth（Google / Facebook / LINE / Apple）與 Payload cookie 橋接完成 — `98c877a`

**完成標準**：新用戶可註冊 → 信箱驗證 → 成功登入 → 進入 `/account`

---

## Phase 3：遊樂場系統連結

**目標**：與外部遊樂場系統打通

- [ ] 外部遊樂場 API 串接（點數、等級、兌換規則）
- [ ] 會員身份對應與同步機制（即時或定時）
- [ ] PointsRedemptions、CreditScoreHistory 等 Collection 調整
- [ ] 前台顯示遊樂場相關資訊（點數餘額、兌換入口）

**完成標準**：會員可在網站看到遊樂場點數，並可進行兌換

---

## Phase 4：完整訂單系統

**目標**：建立正式購物閉環

- [ ] Orders Collection 完整建立與後台管理頁面
- [ ] 結帳流程完整串接（Cart → Order 建立）
- [ ] 訂單狀態管理（Pending → Paid → Shipped → Completed → Cancelled）
- [ ] 訂單確認信件寄送 + 電子發票整合
- [ ] 退貨 / 換貨 / 退款流程基礎架構

**完成標準**：可正常下單 → 後台可看到訂單 → 寄送確認信

---

## Phase 5：金流與進階功能

- [ ] ECPay 正式串接（含 callback、CheckMacValue、生產環境切換）
- [ ] PayPal 備用金流
- [ ] 行銷自動化與推薦引擎（RecommendationSettings）
- [ ] Gamification（Phase 5.8 遊戲化功能）
- [ ] 完整 CSP 與安全強化（Meta Pixel、OAuth 橋接等）

**完成標準**：可使用真實金流結帳，網站進入正式上線準備

---

## Phase 6：庫存履約缺口（P0+P1，Session 25）

**目標**：補齊封測一週後暴露的後台營運缺口；對照 Shopline 後台 14 主選單把「庫存 WMS / 履約工作流 / 基本報表」拉回 P0+P1。Master plan：[`docs/session-prompts/25-master-inventory-fulfillment-parallel-plan.md`](session-prompts/25-master-inventory-fulfillment-parallel-plan.md)

- [ ] **25A** 庫存異動 Ledger + 進貨單（StockMovements append-only + PurchaseOrders；改 Orders/Returns/Exchanges 走統一 service）— 地基，必先做
- [ ] **25B** 批次出貨工作流 + 客戶端物流追蹤 UI（Orders.ts carrier+trackingNumber 已有；只缺 admin 批次操作 + tracking URL）
- [ ] **25C** 盤點單（StockTakes confirm 後寫 adjustment movement；不可逆）— 等 25A
- [ ] **25D** 訂單 CSV/Excel 匯出（複用 createExportEndpoint）— 1 晚搞完
- [ ] **25E** 營運 Dashboard（4 KPI + Top10 熱賣 + 待出貨表）— 純讀

**完成標準**：admin 一打開首頁就看到關鍵營運指標；任何 stock 變動有 ledger trace；出貨/盤點/匯出都不需手動翻 list view。
