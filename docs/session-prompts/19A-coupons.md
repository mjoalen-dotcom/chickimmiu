# Session 19A — Coupons 優惠券系統

> **Parent plan**：`docs/session-prompts/19-master-shopline-gap-parallel-plan.md`
> **Worktree**：`../ckmu-coupons` on branch `feat/coupons`
> **起點 SHA**：main 最新（跑 `git fetch && git pull` 確認 ≥ `38bd277`）
> **衝突可能**：與 19B 共改 `Orders.ts`（不同欄位，trivial rebase）；與 19D 衝突嚴重，**19A merge 後才能開 19D**。

## 目標

補 Shopline 「滿額滿件優惠 / 任選優惠 / 折扣碼」功能。讓後台可建優惠券、前台 checkout 可輸入代碼套用折扣。

## Non-goals（本組不做）

- 加購品 / 贈品 / 組合商品 → 19D
- 自動套用（無代碼觸發）→ v2
- 會員分級專屬優惠碼 → v2（`conditions.tierRequired` 欄位先保留 schema，邏輯 skip）

## 檔案變更清單

### 新增

1. **`src/collections/Coupons.ts`** — slug `coupons`
   - 欄位：
     - `code` (text, unique, required) — 如 `WELCOME10`
     - `name` (text, required) — 後台顯示名稱
     - `description` (textarea)
     - `discountType` (select: `percentage` | `fixed` | `free_shipping`, required)
     - `discountValue` (number, required) — % 或 NT$
     - `minOrderAmount` (number, default 0)
     - `maxDiscountAmount` (number, optional) — 百分比優惠封頂
     - `usageLimit` (number, optional) — 總使用次數上限
     - `usageCount` (number, default 0) — 已用次數（hook 自動累加）
     - `usageLimitPerUser` (number, default 1)
     - `startsAt` (date)
     - `expiresAt` (date)
     - `isActive` (checkbox, default true)
     - `conditions` group:
       - `tierRequired` (relationship → `membership-tiers`, optional)
       - `productInclude` (relationship → `products`, hasMany, optional) — 限定商品
       - `productExclude` (relationship → `products`, hasMany, optional)
       - `firstOrderOnly` (checkbox, default false)
   - Access：`admins` only create/update/delete；`anyone` read（前台要查）
   - `admin.useAsTitle: 'code'`

2. **`src/collections/CouponRedemptions.ts`** — slug `coupon-redemptions`
   - 欄位：
     - `coupon` (relationship → coupons, required)
     - `user` (relationship → users, optional — guest 也可用)
     - `order` (relationship → orders, required)
     - `discountAmount` (number, required) — 實際套用金額
     - `redeemedAt` (date, default now)
   - Access：`admins` 全權；user 只能 read 自己的
   - `afterChange` hook：++ `coupons.usageCount`

3. **`src/app/(frontend)/api/cart/apply-coupon/route.ts`**（POST）
   - Body：`{ code: string }`
   - 讀 cart（從 session）+ 驗 coupon（active / window / minOrder / tier / 使用次數）
   - 回傳：`{ valid: true, discountAmount: number, coupon: {...} }` 或 `{ valid: false, reason: string }`
   - 前台暫存 coupon code 在 localStorage（不要在 server-side 鎖定，下單才真寫 CouponRedemption）

### 修改

4. **`src/collections/Orders.ts`** — 加到 Tab 1（main fields）
   - `couponCode` (text, admin.readOnly)
   - `couponId` (relationship → coupons, admin.readOnly)
   - `discountAmount` (number, default 0, admin.readOnly)
   - `subtotalBeforeDiscount` (number, default 0, admin.readOnly)
   - `beforeChange` hook：create 時若有 couponCode，寫對應 CouponRedemption

5. **`src/app/(frontend)/checkout/page.tsx`**（或 CheckoutClient.tsx）
   - 加「優惠碼」input + 「套用」button
   - 按下 call `/api/cart/apply-coupon` → 成功則 total = subtotal - discount
   - UI 提示（適用中 / 無效 / 過期 / 未達門檻）

6. **`src/payload.config.ts`** — import + 註冊 Coupons, CouponRedemptions

### Migration

7. **`src/migrations/20260421_000000_add_coupons.ts`** — 用 PRAGMA pattern（參考 `20260418_220000_add_login_attempts.ts`）
   - 建 `coupons` 表（所有欄位）
   - 建 `coupons_rels`（tier / products include/exclude）
   - 建 `coupon_redemptions` 表
   - 建 `coupon_redemptions_rels`（coupon / user / order）
   - `orders` ADD COLUMN：`coupon_code TEXT`, `coupon_id INTEGER`, `discount_amount NUMERIC DEFAULT 0`, `subtotal_before_discount NUMERIC DEFAULT 0`
   - Payload v3 需要：`payload_locked_documents_rels` 加 `coupons_id INTEGER`, `coupon_redemptions_id INTEGER`（memory `feedback_prod_schema_sync_on_new_collections.md`）

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. `pnpm payload migrate` 成功
3. `pnpm dev` → `/admin` → Coupons 建一張 `TEST10`（10% off, minOrder 500）
4. 前台加商品到 cart（subtotal ≥ 500）→ /checkout → 輸入 `TEST10` → 應看到 discount -50
5. 輸入無效碼 → 錯誤訊息
6. 下單成功後：`/admin/collections/orders/<id>` 應有 couponCode 欄；`/admin/collections/coupons/<id>` usageCount = 1

### Prod Smoke Test（deploy 後）

- `curl https://pre.chickimmiu.com/api/coupons?where[isActive][equals]=true` 應 200 回 JSON
- Admin 建一張真實優惠券 `CKMU_LAUNCH`（5% off, no min）
- 真下一單（小額 test 商品）套用 → 看 DB `coupon_redemptions` 有紀錄

## Merge + Deploy Checklist

- [ ] PR 標題：`feat(coupons): discount codes with admin config + checkout apply`
- [ ] tsc/build 綠
- [ ] Squash merge 到 main
- [ ] `ssh root@5.223.85.14 /root/deploy-ckmu.sh`
- [ ] Script 跑完：`/admin` + `/checkout` 200
- [ ] Prod smoke test 3 條全 PASS
- [ ] `docs/session-prompts/19A-post-coupons.md` 寫 5 行總結
- [ ] 更新 `MEMORY.md`「19A Coupons DONE — commit `<sha>`」

## Context-exhausted handoff 模板

```markdown
## Session N+1 handoff（19A Coupons 未完）

已完成：
- [x] Coupons.ts + CouponRedemptions.ts schema
- [x] Migration written (not run)
- [ ] payload.config.ts 註冊（差）
- [ ] /api/cart/apply-coupon（差）
- [ ] checkout UI（差）
- [ ] Orders.ts 欄位（差）

WIP commit: <sha> on feat/coupons
下 session 先：cd ../ckmu-coupons && pnpm payload migrate → 接做 Orders.ts + route.ts + checkout UI。
```
