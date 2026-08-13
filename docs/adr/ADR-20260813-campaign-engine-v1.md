# ADR-20260813 — Campaign Engine V1（CHIC Commerce OS P0）

狀態：Accepted（本機 P0 實作依據）
來源計畫：Google Doc「網站升級計畫」（CHIC Commerce OS）§6–§11
分支：`feat/campaign-engine-v1`（worktree，基於 `d81bd76`）

## 1. 現況盤點結論（P0-A）

只讀盤點（兩個 explorer，2026-08-13）確認：

1. **目前沒有伺服器端計價。** `/api/orders` 是原生 Payload REST；`checkout/page.tsx` 在
   client 算完 `subtotal / discountAmount / shippingFee / codFee / total` 直接 POST。
   伺服器唯一的金額計算是稅（`Orders.beforeChange` 稅 hook）。
2. **Critical 信任漏洞**（完整清單見 §8）：登入用戶可 POST `total: 0`、任意 `items[].unitPrice`、
   偽造 `appliedCoupons`（建單時完全不驗券）、甚至直接送 `paymentStatus: 'paid'` 觸發整條
   發獎鏈（點數/發票/卡牌/聯盟佣金）。`customer` 欄位也可指向他人。
3. 優惠券邏輯只存在於 `api/cart/apply-coupon`（純建議性預覽，建單不複驗）；
   `conditions.tierRequired` / `firstOrderOnly` 是 schema-only 未實作。
4. 贈品/加價購/Bundle 的**價格**全由 client 決定（`/api/cart/gifts`、`/api/cart/add-ons`
   只做建議性資格判斷）。
5. 會員（訂閱）折扣、免運門檻全在 client 算。
6. `CouponRedemptions` 在訂單 create 時寫入（用 client 金額）；取消/退款不回沖
   `usageCount`（既有洩漏，非本次引入）。
7. 購買點數直接寫 `users.points`，**沒有 points-transactions ledger row**（既有缺口）。
8. `MarketingCampaigns` 無 hooks；`schedule.startDate/endDate/timezone` 已存在（required）。
9. 事件：`BehaviorEvents`（12 種 eventType、consent 閘、批次、rate limit）可擴充。

## 2. 決策

### D1 唯一價格權威 = server evaluator（純函式）

- `src/lib/promotions/evaluator.ts`：無 I/O、deterministic。輸入全部 snapshot
  （價格/成本/規則/用量由 server 讀 DB 組成），client 金額不存在於輸入。
- **Coupons 經 adapter（`couponAdapter.ts`）走同一 evaluator**，不再有第二套折扣算法。
  `apply-coupon` 路由保留為 UX 預覽端點，但建單時以 evaluator 重算為準。
- 計算順序（固定寫進 evaluator，並以測試鎖定）：
  `item_promo → member_tier → order_promo → coupon → shipping`；同 phase 內 priority 小者先，
  再 ruleKey 字典序。百分比單件效果以原始單價為基數；訂單級百分比以剩餘小計為基數（折上折）；
  所有折扣 floor、最大餘數法分攤、行剩餘價值封頂（永不負數）。

### D2 Source of truth 不變（不重做原則）

| 資料 | source of truth | 本次動作 |
|---|---|---|
| 活動 Root | `marketing-campaigns` | 擴充 `commerce` group（objective/placements/guardrails/approval/killSwitch/budgetSpent），不建平行系統 |
| 規則 | 新 `promotion-rules` | 受限 DSL json + `version`；`active` 後不可原地改（hook 擋），要改就發新 version doc |
| 套用結果 | 新 `promotion-applications` | 不可變（禁 update/delete）；`idempotencyKey = orderId:ruleKey` 唯一 |
| 券 | `coupons` / `coupon-redemptions` | 不動 schema；redemption 金額改由 server 計算值寫入 |
| 訂單 | `orders` | 加 `promotion` group：`quoteId/quoteHash/pricingVersion/appliedPromotionSnapshots/discountTotal/shippingDiscountTotal` |
| 行為流 | `behavior-events` | 加 campaign/ruleKey/surface/variant 欄位 + 新 eventType；行為流仍不可當財務 SoT |
| 引擎開關 | 新 global `promotion-settings` | killSwitch / storefront 顯示 / server 強制計價開關 / quote TTL |

### D3 Checkout 一致性

- `Orders.beforeChange`（create，排在庫存檢查後、稅 hook 前）重算全部金額：
  行單價（DB 現價 `salePrice ?? price`）、贈品/加價購/Bundle 行 server 複驗、
  促銷 evaluator、券 adapter 複驗、會員折扣（`getActiveMembership`）、運費（含免運門檻）、
  COD 手續費、總額。同時：非 admin 強制 `customer = req.user.id`、
  `status='pending'`、`paymentStatus='unpaid'`。
- **server 算出的 total 與 client 送來的 total 不一致 → 直接擋單**（APIError 409 語意），
  client 重新 quote。不採「靜默改價」，避免用戶看到 A 付到 B。
- 預算 last-slice：`UPDATE marketing_campaigns SET budget_spent = budget_spent + X WHERE id=?
  AND (cap IS NULL OR budget_spent + X <= cap)` 條件式原子更新（SQLite 單寫者），
  rowsAffected=0 → 該活動折扣作廢 → 擋單重報價。**先保留後建單**：極少數建單失敗會多保留
  預算（fail-safe 偏商家；由 reconciliation 對帳，見 §6）。
- fail closed：規則解析失敗、成本缺失（有 margin floor 時）、預算未知 → 不套折扣並記 reason。

### D4 Idempotency / 回沖

- `promotion-applications.idempotencyKey` 唯一（migration 建 UNIQUE index）→ 同單同規則重放不重複。
- 訂單 `cancelled/refunded` → afterChange 把該單 applications 標 `reversed` 並回沖
  `commerce.budgetSpent`（原子遞減，不低於 0）。點數/券 usageCount 回沖沿用既有行為
  （既有缺口見 §7，不在 P0 擴大）。
- 發獎（XP/Mystery Key）在 P0 只落 `rewardIntents` 快照，實際發放屬 P1 Member Economy。

### D5 規則版本與活動生命周期

- `promotion-rules.status`: `draft → active → disabled`；`active` 期間 DSL 欄位鎖定
  （beforeChange 擋），修改路徑 = 複製新 doc、version+1、舊的轉 `disabled`。
- `marketing-campaigns.status` 擴充選項：`draft/review/approved/scheduled/active/paused/
  ended/completed/cancelled`（保留既有值相容）。commerce 活動要進 `active` 必須：
  `commerce.enabled`、`budgetCap` 已填、`approval.approvedBy/At` 已填，否則 hook 擋。
- Kill switch 三層：global `promotion-settings.killSwitch`（全引擎）→ campaign
  `commerce.killSwitch`（單活動）→ rule `status='disabled'`（單規則）。

### D6 Feature flag / 漸進上線

沿用 repo 慣例（Payload global checkbox，不用 env var）：
- `promotion-settings.storefrontEnabled`（default false）：前台倒數/進度/badge 顯示。
- `promotion-settings.serverPricingEnforcement`(default true)：beforeChange 重算 + 擋單。
  這同時是本次資安修補的開關；關掉 = 回到現況（僅緊急回退用，明文警告）。
- 72H 活動 seed 為 `draft` + `commerce.killSwitch=true`，啟用需人工核准流程。

### D7 事件

- 前台：`campaign_exposed/campaign_clicked/progress_viewed/reward_unlocked` 走既有
  `behaviorTracking`（consent 閘、批次、sendBeacon）。
- 伺服器：`promotion_applied/promotion_rejected` 在建單時由 server 直寫（帶
  campaign/ruleKey/version/surface + `order:<orderNumber>` sessionId），
  財務對帳仍以 `promotion-applications` 為準，事件只做分析。

## 3. 價格計算順序（測試鎖定）

1. 鎖 SKU/數量/DB 現價/成本快照
2. item_promo（任N件折X/任N件X折/第N件折）
3. order_promo（滿額折/贈/點數倍率）
4. 會員折扣（既有訂閱 `discountPercent`，在 evaluator 之外以既有邏輯 server 端重算）
5. Coupon（adapter → 同一 evaluator，同一 stacking policy）
6. 運費與免運（會員門檻/券免運/滿額免運）
7. COD 手續費 → 稅（既有 hook）→ 總額
8. quoteId / pricingVersion=`pe-v1` / quoteHash（sha256）

## 4. Migration / rollback

- 手寫 idempotent migration（**禁 `migrate:create`**，repo 既有地雷）：
  新表 `promotion_rules`、`promotion_applications`（含 `payload_locked_documents_rels`
  FK 欄）、`marketing_campaigns` / `orders` / `behavior_events` ADD COLUMN、
  `promotion_settings` global 表。
- 先在 worktree 的 `data/chickimmiu.db` 副本驗證 up；down = DROP 新表（新增欄位刻意不
  drop，沿用 repo 慣例）。
- 回滾層級：(1) global killSwitch 秒關 → (2) `serverPricingEnforcement` 關閉回現況 →
  (3) migration down + 前一版 build。

## 5. 已知限制（P0 明文）

- `stackableWith` 白名單做雙向類別檢查；跨規則更細的 pairwise 白名單留 P0-D 之後。
- 會員折扣暫不進 evaluator（沿用既有 server 重算），phase 位置已保留（member_tier）。
- 點數/購物金抵扣目前整站未實作（`pointsUsed/creditUsed` 殭屍欄位），不在 P0。
- `variants[].priceOverride` 現行購物車本來就不用（整站以商品價為準），維持現狀。
- 行為事件量若上來，SQLite 壓力照計畫 §16：先索引/保留期，達量再遷，不提前重構。

## 6. 待辦（P0 內不阻塞，交接單列明）

- reconciliation script：`budgetSpent` vs applications 加總對帳（cron 化在 P0-D）。
- 券 `usageCount` 取消不回沖（既有）：建議與 applications 回沖一起修，需 Alan 確認政策。
- 購買點數補 ledger row（既有缺口，動帳本需獨立驗證）。

## 7. 既有問題（非本次引入，已記錄）

券 usageCount 洩漏、購買點數無 ledger、`campaignEngine.ts` 與 collection 欄位漂移、
cart page 硬編碼免運 1000/60、`CouponRedemptions.afterChange` usageCount 非原子。

## 8. Client-trust 漏洞清單

完整 18 項見盤點報告（本 ADR §1 摘要）；D3 上線後 1–18 中的金額類全數關閉，
`customer` 綁定、`status/paymentStatus` 強制亦在 D3。UTM attribution（低風險）維持 client 供給。
