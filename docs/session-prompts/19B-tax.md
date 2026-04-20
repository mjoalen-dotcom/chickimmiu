# Session 19B — 稅金設定 + 發票整合

> **Parent plan**：`docs/session-prompts/19-master-shopline-gap-parallel-plan.md`
> **Worktree**：`../ckmu-tax` on branch `feat/tax-settings`
> **起點 SHA**：main 最新（`git fetch && git pull` 確認 ≥ `38bd277`）
> **衝突可能**：與 19A 共改 `Orders.ts`（不同欄位，trivial rebase）；與 19D 共改 `Products.ts`（不同欄位）

## 目標

補台灣稅法合規：5% 營業稅 / 免稅商品類別 / 發票整合（含稅 vs 未稅金額）。讓 `Invoices.ts` 能產生符合台灣二聯 / 三聯式的稅額 breakdown。

## Non-goals

- 外銷零稅率 / 免稅額度計算 → v2
- 境外銷售代收代付 → v2
- 多國稅率（VAT/GST）→ 本案只做台灣 TW

## 檔案變更清單

### 新增

1. **`src/globals/TaxSettings.ts`** — slug `tax-settings`
   - `defaultTaxIncluded` (checkbox, default true) — 商品價格是否**內含稅**（台灣慣例 true）
   - `defaultTaxRate` (number, default 5) — %
   - `taxCategories` (array) — 預設帶：
     - `{ value: 'standard', label: '應稅 5%', rate: 5 }`
     - `{ value: 'reduced', label: '優惠稅率 0%', rate: 0 }`
     - `{ value: 'exempt', label: '免稅', rate: 0, exempt: true }`
     - `{ value: 'zero_rated', label: '零稅率（外銷）', rate: 0 }`
   - `shippingTaxable` (checkbox, default true) — 運費是否課稅
   - `invoiceBreakdown` group：
     - `showTaxLine` (checkbox, default true) — 發票是否顯示稅額
     - `roundingMode` (select: `round_half_up` | `round_down` | `round_up`, default `round_half_up`)

### 修改

2. **`src/collections/Products.ts`**
   - 加 `taxCategory` (select, options 從 TaxSettings.taxCategories 動態讀；初版先硬 enum 同 seed default)
   - 預設值 `standard`
   - 放在 Pricing tab

3. **`src/collections/Orders.ts`** — 加到 Pricing/Totals 區
   - `taxAmount` (number, default 0, admin.readOnly)
   - `taxRate` (number, default 5, admin.readOnly)
   - `subtotalExcludingTax` (number, default 0, admin.readOnly)
   - `shippingTaxAmount` (number, default 0, admin.readOnly)
   - `beforeChange` hook：計算稅額（ref: `src/lib/commerce/calculateTax.ts` 下面新檔）

4. **`src/collections/Invoices.ts`**
   - 加 `taxBreakdown` group：
     - `standardTaxable` (number) — 應稅銷售額
     - `standardTax` (number) — 稅額
     - `zeroRatedSales` (number) — 零稅率
     - `exemptSales` (number) — 免稅
   - 發票 PDF 生成（若已有）要讀這個 group

### 新工具

5. **`src/lib/commerce/calculateTax.ts`**
   - `calculateOrderTax(items, shippingFee, taxSettings)` → `{ taxAmount, subtotalExcludingTax, taxBreakdown }`
   - 規則：
     - 每個 lineItem 查 `product.taxCategory` → 找 rate
     - `defaultTaxIncluded=true` → `taxAmount = total × rate / (100+rate)`
     - `defaultTaxIncluded=false` → `taxAmount = total × rate / 100`
     - Shipping 視 `shippingTaxable` 決定加不加
     - Rounding 依 `roundingMode`

6. **`src/app/(frontend)/checkout/page.tsx`** — 小計下方顯示「含稅 / 未稅 / 稅額」3 行

7. **`src/payload.config.ts`** — import + 註冊 TaxSettings global

### Migration

8. **`src/migrations/20260421_100000_add_tax.ts`** — PRAGMA pattern
   - 建 `tax_settings` global 表（single row）
   - `products` ADD COLUMN `tax_category TEXT DEFAULT 'standard'`
   - `orders` ADD COLUMN：`tax_amount NUMERIC DEFAULT 0`, `tax_rate NUMERIC DEFAULT 5`, `subtotal_excluding_tax NUMERIC DEFAULT 0`, `shipping_tax_amount NUMERIC DEFAULT 0`
   - `invoices` 加 `tax_breakdown_*` 欄位
   - Seed TaxSettings default row（`INSERT OR IGNORE`）

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. `pnpm payload migrate` 成功
3. `/admin/globals/tax-settings` 應看到 default seed（5% TW）
4. Products edit → taxCategory 選 `exempt` → 下單該商品 → Order.taxAmount = 0
5. Products 選 `standard`（預設）→ 下單 $1000 含稅 → taxAmount = round(1000 × 5 / 105) = 48
6. 手動建 Invoice → taxBreakdown 應自動填

### Prod Smoke

- `curl https://pre.chickimmiu.com/api/globals/tax-settings` 200 回 5% TW default
- 真下一單 → `/admin/collections/orders/<id>` 看到 taxAmount 計算正確
- `/admin/collections/invoices/<id>` taxBreakdown 欄位有值

## Merge + Deploy

- [ ] PR：`feat(tax): TaxSettings global + per-product tax category + invoice tax breakdown`
- [ ] tsc/build 綠
- [ ] Squash merge
- [ ] `ssh root@5.223.85.14 /root/deploy-ckmu.sh`
- [ ] Smoke test PASS
- [ ] `19B-post-tax.md` 寫 5 行
- [ ] MEMORY.md 加一行

## Handoff 模板（同 19A）

已完成 / 未完成清單 + WIP commit sha + 接續動作。
