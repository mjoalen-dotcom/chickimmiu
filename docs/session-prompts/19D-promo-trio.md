# Session 19D — 促銷三件套（加購品 + 贈品 + 組合商品）

> **Parent plan**：`docs/session-prompts/19-master-shopline-gap-parallel-plan.md`
> **Worktree**：`../ckmu-promo` on branch `feat/promo-trio`
> **起點 SHA**：⚠️ **必須等 19A Coupons merged** 之後才能開。原因：共用 Orders.lineItems + cart 邏輯，同時開會在 cart store 嚴重 conflict。
> **預期 SHA**：19A merge 後的 main commit（建 worktree 前跑 `git log --oneline -5` 確認有 `feat(coupons): ...`）

## 目標

Shopline 「加購品 / 贈品 / 組合商品」三個促銷檔。讓 admin 可以：
- 設定結帳加購（滿額可加購 X 商品 Y% off）
- 滿額送贈品（自動加入 cart，顯示「贈品」標籤）
- 定義套組商品（原價 $A+$B=$C，套組價 $D）

## Non-goals

- 任選 N 件 X 折 → 用 Coupons 的百分比折扣搭配 productInclude 就近了，不另做
- 分層贈品（滿 500 送 A，滿 1000 送 B）→ v2；初版只支援單一門檻
- Bundle 動態定價（根據選配 SKU 重算）→ v2；初版定價固定

## 檔案變更清單

### 新增

1. **`src/collections/AddOnProducts.ts`** — slug `add-on-products`
   - `name` (text, required)
   - `product` (relationship → products, required) — 加購的商品
   - `originalPrice` (number, admin.readOnly, 從 product 拉)
   - `addOnPrice` (number, required) — 結帳加購專價
   - `conditions` group：
     - `minCartSubtotal` (number, default 0)
     - `appliesToProducts` (relationship → products, hasMany, optional) — cart 有指定商品才顯示
     - `usageLimitPerOrder` (number, default 1)
   - `startsAt` / `expiresAt` / `isActive`
   - `priority` (number, default 0) — 多個同時達成時排序

2. **`src/collections/GiftRules.ts`** — slug `gift-rules`
   - `name` (text, required)
   - `triggerType` (select: `min_amount` | `product_in_cart`, required)
   - `minAmount` (number) — if triggerType=min_amount
   - `triggerProducts` (relationship → products, hasMany) — if triggerType=product_in_cart
   - `giftProduct` (relationship → products, required)
   - `giftQuantity` (number, default 1)
   - `stackable` (checkbox, default false) — 是否可疊加（一單 $3000 送 3 份贈品）
   - `startsAt` / `expiresAt` / `isActive` / `priority`
   - Hook：`beforeValidate` — 警告若 giftProduct 沒庫存

3. **`src/collections/Bundles.ts`** — slug `bundles`
   - `name` (text, required)
   - `slug` (text, unique) — `/bundles/<slug>` 可獨立 PDP
   - `description` (richText)
   - `items` (array) — 套組包含什麼：
     - `product` (relationship → products, required)
     - `quantity` (number, default 1)
   - `originalPrice` (number, admin.readOnly) — auto sum of product.price × qty
   - `bundlePrice` (number, required) — 實際售價
   - `savings` (number, admin.readOnly) — auto = originalPrice - bundlePrice
   - `image` (upload → media)
   - `startsAt` / `expiresAt` / `isActive`

### 修改

4. **`src/collections/Orders.ts` — lineItems 子欄位**
   - 加 `bundleRef` (relationship → bundles, optional) — 標記這行是哪個 bundle 展開的
   - 加 `isGift` (checkbox, default false) — 贈品行
   - 加 `isAddOn` (checkbox, default false) — 加購品行
   - 加 `giftRuleRef` (relationship → gift-rules, optional)
   - 加 `addOnRuleRef` (relationship → add-on-products, optional)
   - 價格 0 的贈品行仍要寫入 line item（便於出貨時知道要包什麼）

5. **`src/stores/cartStore.ts`**
   - 加 method `addBundle(bundleId, quantity)` — 展開為多行 lineItem（內部標 bundleRef）
   - 加 method `removeBundle(bundleId)` — 一次移除整組
   - 自動檢查 giftRules（每次 items 變動時）→ 插入 `{ isGift: true, price: 0 }` line
   - 自動顯示適用的 add-on options

6. **`src/app/(frontend)/api/cart/add-ons/route.ts`** — 新 GET
   - Query current cart → 回傳符合條件的 AddOnProducts（讓 checkout UI 可 upsell）

7. **`src/app/(frontend)/api/cart/gifts/route.ts`** — 新 GET
   - 類似，讀 GiftRules 找當下 cart 適用的贈品 → 回傳要自動加入的 items

8. **`src/app/(frontend)/checkout/page.tsx`**
   - 加「加購區」section — 顯示 /api/cart/add-ons 回的清單 + checkbox 可加入
   - 贈品 auto 進 cart（不能取消勾選；標「贈品」badge）
   - Bundle 行顯示「套組 X 件」折疊展開

9. **`src/app/(frontend)/bundles/[slug]/page.tsx`** — 新（基本 PDP，可後日再美化）
   - Server component fetch bundle + items
   - 「加入購物車」→ cartStore.addBundle

10. **`src/payload.config.ts`** — import + 註冊三個 collection

### Migration

11. **`src/migrations/20260422_000000_add_promo_trio.ts`** — PRAGMA pattern
    - 建 `add_on_products`, `add_on_products_rels`
    - 建 `gift_rules`, `gift_rules_rels`
    - 建 `bundles`, `bundles_items`（array 子表）, `bundles_rels`
    - `orders_line_items` ADD COLUMN：`bundle_ref_id INT`, `is_gift INT DEFAULT 0`, `is_add_on INT DEFAULT 0`, `gift_rule_ref_id INT`, `add_on_rule_ref_id INT`
    - `payload_locked_documents_rels` 加 3 個 `*_id INT` 欄位

## 測試計畫

### 本地

1. tsc/build 綠
2. Migrate OK
3. **加購品**：admin 建 AddOnProduct（某低價商品 90% off）+ minCartSubtotal=500 → cart 加 $600 商品 → checkout 應看到加購區 → 勾選 → 下單 → Order.lineItems 有 `isAddOn: true` 行
4. **贈品**：admin 建 GiftRule（滿 $1000 送 $100 商品）→ cart 滿 $1000 → checkout 自動加贈品 line（price 0, isGift true）→ 下單 → Order.lineItems 有 gift 行
5. **套組**：admin 建 Bundle（商品 A + B，原價 $300，套組價 $250）→ `/bundles/<slug>` → 加入購物車 → cart 顯示 2 行（A + B）+ bundleRef 標記 + 小計 $250 不是 $300

### Prod Smoke

- 三個 collection `/admin` 都開得起來
- 在 prod 建測試促銷（`CKMU_LAUNCH_ADDON` 加購品等）→ 前台驗證 → 下單 → DB lineItems 欄位正確

## Merge + Deploy

- [ ] PR：`feat(promo): add-on products, gift rules, bundles`
- [ ] Deploy 流程同 19A/19B/19C
- [ ] Smoke test 3 大情境（加購 / 贈品 / 套組）
- [ ] 19D-post 寫 handoff

## 重要依賴

- 本組的 cart 邏輯要讀 19A Coupons 的 `discountAmount`（算 subtotal 時要用哪個）
  - **規則定義**：subtotal 算法 = sum(lineItems.price × qty) **先**，再套 coupon → 再算 tax
  - Bundle line items 的 price 用 `bundlePrice / itemCount` 均分（或簡化：第 1 行用 bundlePrice，其他行 price=0 + note）
  - Gift line items 不計入 subtotal
- 若 19D 同時 merge 後發現計算錯，檢查點：`src/lib/commerce/calculateSubtotal.ts`（若不存在就新建一個 source of truth）

## Handoff 模板（同 19A）
