# Session 19C — 結帳設定 + 訂單設定 Globals

> **Parent plan**：`docs/session-prompts/19-master-shopline-gap-parallel-plan.md`
> **Worktree**：`../ckmu-checkout-cfg` on branch `feat/checkout-order-settings`
> **起點 SHA**：main 最新（`git fetch && git pull` 確認 ≥ `38bd277`）
> **衝突可能**：**零**。不動 Orders.ts / Products.ts 既有欄位；只加新 global + 讀取。真正安全的平行組。

## 目標

Shopline 的「結帳設定」+「訂單設定」搬過來。讓 admin 可以：
- 結帳表單欄位客製（哪些必填 / 隱藏）
- 訂單編號規則（prefix / 流水號 / 日期格式）
- 自動取消未付款訂單時限
- 下單時是否強制 TOS 勾選 / 必填電話 / 生日 / 身分證

## Non-goals

- 重做 checkout UI（只做 config + 讀取）
- 訂單狀態流（pending → paid → shipped）邏輯改動 → 另案
- Export / Import 訂單 → P3

## 檔案變更清單

### 新增

1. **`src/globals/CheckoutSettings.ts`** — slug `checkout-settings`
   - `requireTOS` (checkbox, default true)
   - `tosLinkText` (text, default `同意服務條款與隱私權政策`)
   - `requireMarketingConsent` (checkbox, default false) — 強制勾選接收行銷信
   - `marketingConsentText` (text)
   - `fieldRequirements` group：
     - `phoneRequired` (checkbox, default true)
     - `birthdayRequired` (checkbox, default false)
     - `nationalIdRequired` (checkbox, default false) — 發票開個人戶需要
     - `genderRequired` (checkbox, default false)
   - `checkoutAsGuest` (checkbox, default true) — 允許非會員結帳
   - `minOrderAmount` (number, default 0) — 最低消費
   - `maxItemsPerOrder` (number, default 99)
   - `notes` group：
     - `allowOrderNote` (checkbox, default true)
     - `orderNoteLabel` (text, default `給賣家的備註`)
     - `orderNoteMaxLength` (number, default 200)

2. **`src/globals/OrderSettings.ts`** — slug `order-settings`
   - `numbering` group：
     - `prefix` (text, default `CKMU`) — 如 `CKMU20260421001`
     - `includeDate` (checkbox, default true) — yes = prefix + YYYYMMDD + seq
     - `sequenceDigits` (number, default 3) — 001-999
     - `sequenceResetDaily` (checkbox, default true)
   - `autoActions` group：
     - `autoCancelUnpaidMinutes` (number, default 60) — 未付款 N 分鐘自動取消；0 = 不自動取消
     - `autoCompleteAfterDelivery` (checkbox, default false)
     - `autoCompleteAfterDays` (number, default 7) — 出貨後 N 天自動標完成
   - `notifications` group：
     - `sendConfirmationEmail` (checkbox, default true)
     - `sendShippedEmail` (checkbox, default true)
     - `sendAdminNewOrderAlert` (checkbox, default true)
     - `adminAlertEmails` (array of text) — 收通知的 admin 信箱
   - `statusFlow` group：
     - `enableProcessing` (checkbox, default true)
     - `enableReadyForPickup` (checkbox, default false) — 面交 only
     - `customStatuses` (array) — `{ value, label, sortOrder }`

### 修改

3. **`src/app/(frontend)/checkout/page.tsx`**（CheckoutClient.tsx）
   - SSR 階段從 Payload 讀 CheckoutSettings → 傳 client
   - 動態必填欄位依 `fieldRequirements.*`
   - TOS checkbox 依 `requireTOS`
   - minOrderAmount 檢查 subtotal → disabled submit + error msg
   - 訂單備註欄位依 `notes.*`

4. **`src/collections/Orders.ts`** — `beforeChange` hook 加訂單編號產生邏輯
   - 讀 OrderSettings.numbering
   - `prefix + (includeDate ? YYYYMMDD : '') + zfill(daily_seq, sequenceDigits)`
   - 新欄位：`orderNumber` (text, unique, admin.readOnly)
   - ⚠️ 此欄位先補，但不動現有 `id` / `createdAt` 等 Payload 管理欄位
   - ⚠️ 舊單沒有 orderNumber → migration 用 `id` 當 fallback 填入

5. **`src/lib/commerce/orderNumbering.ts`** — 新
   - `generateOrderNumber(settings, now)` → string
   - 找當天最大 seq（`SELECT COUNT(*) FROM orders WHERE order_number LIKE ?`）+ 1
   - Race condition 用 DB unique constraint 擋（衝突重試 3 次）

6. **`src/lib/commerce/orderAutoCancel.ts`** — 新（給 cron）
   - `findUnpaidOverdueOrders(minutes)` → cron 每 10 分鐘跑一次

7. **`src/app/api/cron/auto-cancel-orders/route.ts`** — 新（若 `autoCancelUnpaidMinutes > 0`）
   - 需 Bearer CRON_SECRET（同現有 expire-points pattern）

8. **`src/payload.config.ts`** — import + 註冊兩個 global

### Migration

9. **`src/migrations/20260421_200000_add_checkout_order_settings.ts`** — PRAGMA pattern
   - 建 `checkout_settings`, `order_settings` global tables
   - `orders` ADD COLUMN `order_number TEXT`
   - 舊單 backfill：`UPDATE orders SET order_number = 'CKMU' || printf('%08d', id) WHERE order_number IS NULL`
   - ADD UNIQUE INDEX `order_number`
   - Seed 兩個 global 的 default row

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. Migrate → 兩個 global 有預設資料
3. `/admin/globals/checkout-settings` 開 → minOrderAmount 設 500 → /checkout 加 $300 商品 → 應看到 error「最低消費 NT$500」
4. OrderSettings prefix 改 `TEST` → 下一張單 → orderNumber = `TEST20260421001`
5. Unpaid order 建立 → wait 60 分（或 set autoCancelUnpaidMinutes=1 測）→ cron 跑 → 應 cancelled

### Prod Smoke

- `/admin/globals/checkout-settings` + `/admin/globals/order-settings` 都 200
- 舊單都有 orderNumber（CKMU00000001 etc.）
- 新下一單 orderNumber 正確遞增

## Merge + Deploy

- [ ] PR：`feat(checkout,orders): CheckoutSettings + OrderSettings globals + order numbering`
- [ ] Deploy 流程同 19A/19B
- [ ] Smoke test
- [ ] 19C-post 寫 handoff

## 關鍵技術細節

### 訂單編號 race condition

SQLite 單進程安全，但 pm2 fork 模式有多 worker 風險。解法：
- UNIQUE constraint on `order_number`
- 失敗重試 3 次（每次 fetch max_seq + 1）
- 3 次都失敗就 fallback `CKMU<id>`（保證不擋下單）

### CheckoutSettings 讀取效能

Next.js `force-dynamic` 下每次 SSR 都會打 Payload，會慢。建議：
- 用 React `cache()` memoize 在 request 層級
- 或改 `revalidate: 60` ISR（admin 改設定 1 分鐘生效可接受）

## Handoff 模板（同 19A）
