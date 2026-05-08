# PR-2/3 商品成本公式 + 自動計價（PR-1 多分類已完成的下一步）

## 背景

使用者在 Session 33 提了三段需求：
1. ✅ **PR-1 多分類**（已完成）：商品可掛多個分類，後台用樹狀單選（主分類）+ 樹狀多選（其他分類）切換
2. **PR-2 成本公式 global**（本文件）
3. **PR-3 商品編輯頁接公式**（本文件）

長期願景：「集合購物與 SCM 管理、POS 庫存、財務人事的整合平台」— 不在這次 PR 範圍，先把成本/定價自動化做扎實。

## 使用者已拍板的設計決策

從 user 在 Session 33 的回覆：

| 問題 | 拍板 |
|---|---|
| 成本 global 8 個欄位夠用嗎？ | **夠用**（成本非必填，可自行金額往上加） |
| 保底淨利 percent / fixed / 取其大者？ | **三選一**，繁體中文 UI |
| PR 順序 | **PR-1 先**（已完成）→ 再做 PR-2/3 |
| 整合 SCM / POS / 財務人事？ | 願景記錄下來，之後再開新坑，這次別擴 scope |

## PR-2 設計：新 global `PricingFormulaSettings`

### 位置
`src/globals/PricingFormulaSettings.ts`，掛在 admin group **「⑦ 系統與安全」**（跟 GlobalSettings、Currencies、LoginAttempts 同 group）。

### 欄位（8 個）

```ts
{
  // 採購幣別 — 預設韓元，從 Currencies collection 撈匯率
  currencyCode: { type: 'select', defaultValue: 'KRW',
    options: [{ label: '韓元 KRW', value: 'KRW' }, { label: '日圓 JPY', value: 'JPY' },
              { label: '美元 USD', value: 'USD' }, { label: '人民幣 CNY', value: 'CNY' }] },

  // Lock 採購匯率（避免 Currencies 浮動影響成本計算）
  manualRateOverride: { type: 'number', min: 0,
    description: '留空 = 即時跟隨 Currencies collection；填入則 lock 此匯率（1 TWD = 多少採購幣別）' },

  // 國際運費攤提
  weightShippingPerGram: { type: 'number', defaultValue: 0.3, min: 0,
    description: '每 1 公克的國際運費（TWD），例：0.3 = 一克 0.3 元' },
  weightShippingFlatFee: { type: 'number', defaultValue: 80, min: 0,
    description: '固定處理費（TWD），不論重量，例：80 = 每件加 80 元' },

  // 保底淨利模式（三選一，繁體中文 label）
  profitMode: { type: 'select', defaultValue: 'percent_only',
    options: [
      { label: '只用百分比', value: 'percent_only' },
      { label: '只用固定金額', value: 'fixed_only' },
      { label: '取其大者（百分比 vs 固定金額）', value: 'whichever_higher' },
    ] },
  profitPercent: { type: 'number', defaultValue: 35, min: 0,
    description: '加成百分比，例：35 = 在 cost+shipping 之上加 35%' },
  profitFixedFloor: { type: 'number', defaultValue: 200, min: 0,
    description: '固定金額（TWD），例：200 = 至少賺 200 元' },

  // 售價自動 round
  priceRoundTo: { type: 'number', defaultValue: 10, min: 1,
    description: '自動 round 到最接近的此值，例：10 = 個位數歸零（NT$1234 → NT$1230）' },
}
```

### 計算公式（之後在 `src/lib/pricing/computeSuggestedPrice.ts` 實作）

```ts
function computeSuggestedPrice({
  costInLocalCurrency,  // 例如 KRW 50000
  weight,               // 公克
  settings,             // PricingFormulaSettings
  currency,             // 從 Currencies collection 撈到的當前匯率資訊
}): { costTWD: number; shippingTWD: number; profitTWD: number; suggestedPrice: number } {
  // 1. 換算成本到 TWD
  const rate = settings.manualRateOverride ?? currency.rateAgainstTwd
  const costTWD = costInLocalCurrency / rate  // KRW 50000 / 36 ≈ 1389

  // 2. 重量運費 = 每克單價 * 重量 + 固定處理費
  const shippingTWD = weight * settings.weightShippingPerGram + settings.weightShippingFlatFee

  // 3. 保底淨利
  const baseAmount = costTWD + shippingTWD
  const percentProfit = baseAmount * (settings.profitPercent / 100)
  const fixedProfit = settings.profitFixedFloor
  const profitTWD = settings.profitMode === 'percent_only' ? percentProfit
    : settings.profitMode === 'fixed_only' ? fixedProfit
    : Math.max(percentProfit, fixedProfit)  // whichever_higher

  // 4. 加總 + round
  const raw = baseAmount + profitTWD
  const suggestedPrice = Math.round(raw / settings.priceRoundTo) * settings.priceRoundTo

  return { costTWD, shippingTWD, profitTWD, suggestedPrice }
}
```

### Migration（單表 single-row global）

Pattern 沿用 `20260423_000000_add_currencies.ts` 的 single-row global：
建一個 `pricing_formula_settings` table，single row id=1，所有欄位都是 column。

### 需要動的檔
- 新建 `src/globals/PricingFormulaSettings.ts`
- 註冊到 `src/payload.config.ts` 的 `globals: [...]`
- 新建 `src/migrations/20260509_xxxxxx_add_pricing_formula_settings.ts`
- 註冊到 `src/migrations/index.ts`
- 新建 `src/lib/pricing/computeSuggestedPrice.ts`（純 function，沒有 side effect）
- 加單元測試 `src/lib/pricing/__tests__/computeSuggestedPrice.test.ts`（如果這 repo 有 test runner；目前看起來沒有，那就跳過）

---

## PR-3 設計：商品編輯頁接公式

### 改動位置：`src/collections/Products.ts` Tab 1「基本資訊」

#### 3.1 把 `sourcing.costKRW` 從 sidebar group 提到主編輯區

**現在**：`sourcing.costKRW` 在 sidebar 裡（line 411-417 of Products.ts），預設 readOnly 跟 import 流程綁定。
**改成**：在「基本資訊」tab 的 price 上方加新 group「自動計價（採購）」：

```ts
{
  type: 'group',
  name: 'autoPricing',
  label: '🧮 自動計價（採購成本 → 建議售價）',
  admin: {
    description: '填韓幣成本與重量，系統自動算建議售價。也可以勾掉「使用自動計價」改為手動輸入下方價格。',
  },
  fields: [
    {
      name: 'useAutoPricing',
      label: '使用自動計價（存檔時自動覆寫下方原價）',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'costAmount',
          label: '採購金額（韓元 / 採購幣別）',
          type: 'number',
          min: 0,
          admin: { width: '40%', description: '不填 = 跳過自動計價' },
        },
        {
          name: 'costCurrencyCode',
          label: '幣別',
          type: 'select',
          defaultValue: 'KRW',
          options: [
            { label: '韓元 KRW', value: 'KRW' },
            { label: '日圓 JPY', value: 'JPY' },
            { label: '美元 USD', value: 'USD' },
            { label: '人民幣 CNY', value: 'CNY' },
          ],
          admin: { width: '20%' },
        },
        // 重量已經在 Tab 1 末尾有 weight 欄位，不重複；用 sibling 帶入
      ],
    },
    {
      name: 'pricingPreview',
      type: 'ui',
      admin: {
        components: { Field: '@/components/admin/AutoPricingPreview' },
      },
    },
  ],
}
```

#### 3.2 新建 `src/components/admin/AutoPricingPreview.tsx`（client component）

讀 `costAmount`、`costCurrencyCode`、`weight` (sibling fields via `useFormFields`)，
fetch `/api/globals/pricing-formula-settings` 拿公式，
fetch `/api/currencies` 拿匯率，
即時計算 4 個值：
- 換算後成本 TWD
- 重量運費 TWD
- 保底淨利 TWD
- 建議售價（round 後）

並有一顆按鈕「📥 套用建議售價」→ `useField({ path: 'price' }).setValue(suggested)`。

#### 3.3 Products beforeChange hook 加自動覆寫

```ts
beforeChange: [
  ({ data, req }) => {
    if (!data?.autoPricing?.useAutoPricing) return data
    if (!data.autoPricing.costAmount || !data.weight) return data
    // 只在 useAutoPricing=true 且兩個必要欄位都填了時才覆寫
    // computeSuggestedPrice 必須在 server 端重新算一次（client 算的不可信）
    // ... pull globals + currencies, compute, set data.price
    return data
  },
  // ... 其他既有 hook
]
```

### 需要動的檔
- `src/collections/Products.ts` — 加 `autoPricing` group + beforeChange hook
- `src/components/admin/AutoPricingPreview.tsx` — 新建 client component
- 新 migration 加 4 column：`auto_pricing_use_auto_pricing` / `auto_pricing_cost_amount` / `auto_pricing_cost_currency_code`（沒有 pricingPreview，因為它是 ui field）
- `pnpm payload generate:importmap`
- `pnpm payload generate:types`

---

## 已知陷阱與教訓

從這次 PR-1 + memory 沉澱：

1. **Custom admin components 要 `'use client'`** — Payload v3 admin Field component 在 group/tab 內若是 RSC 會 silent 清空整個 form 的 render-fields（feedback memory `payload_v3_group_field_rsc`）

2. **加新 admin component 必跑 `pnpm payload generate:importmap`** 並 commit `src/app/(payload)/admin/importMap.js`，否則 component silent 不 mount（feedback memory `admin_components_need_importmap_regen`）

3. **Migrations 在 prod 跑 `pnpm payload migrate` 卡 prompt** — `deploy-ckmu.sh` 已用 `yes y |` workaround（feedback memory `prod_migrate_interactive_prompt`）

4. **SQLite 不支援 IF NOT EXISTS for CREATE TABLE** — 都用 `tableExists()` 判斷 + 沿用 `20260505_200000_add_ad_audiences.ts` pattern

5. **Stacked PR 教訓**：squash merge `--delete-branch` 會把 stacked-on 它的 PR auto-close。如果 PR-2 base 在 PR-1 上，merge PR-1 前先 `gh pr edit <PR-2> --base main`。

6. **Prod build OOM**：3.7GB RAM 預設 Node heap 不夠，必須 `NODE_OPTIONS=--max-old-space-size=2048 pnpm exec next build`，否則 ENOENT pages-manifest.json 卡 collect-page-data。

---

## PR-1 完成清單（已 done，給 PR-2/3 接手者參考）

| 檔案 | 動作 |
|---|---|
| `src/components/admin/ProductCategoryTreePicker.tsx` | 新建（'use client'，tabs：主單選 / 其他多選 + 樹狀縮排 + 搜尋 + 全展開/全收合 + 已選 chip 預覽） |
| `src/collections/Products.ts` | `category` 加 `admin.components.Field`，新增 `additionalCategories` (hasMany, hidden) |
| `src/migrations/20260508_120000_add_product_additional_categories.ts` | 新建 migration（建 `products_rels` 表，4 indexes） |
| `src/migrations/index.ts` | 註冊新 migration |
| `src/app/(frontend)/category/[slug]/page.tsx` | where clause 改 OR：主分類 OR 其他分類任一命中 |
| `src/app/(payload)/admin/importMap.js` | 自動 regen 包含新 component |
| `src/payload-types.ts` | 自動 regen 包含 `additionalCategories` |

驗證已 done（local dev server）：
- 12 個分類 seed → 9 radio (level 1 + 2，3 root 自動展開) → 切到多選 tab → 12 checkbox → 點 2 個 → tab 計數「多選 2」+ chip「其他：裙裝、配件」+ 主分類 chip「主：女裝」全正確。

tsc baseline = 15 errors（pre-existing payload-types/UGC 問題）；改動後 = 15，零新增。

---

## 整合平台願景（記錄用，不在這 PR）

User 提的長期方向：「集合購物與 SCM 管理、POS 庫存、財務人事的整合平台管理」。

可能的子系統（未排優先級）：
- **SCM**：Sinsang Market 自動化採購、出貨追蹤、供應商評分
- **POS 庫存**：實體店庫存同步、條碼掃描入庫、跨倉調撥
- **財務**：自動對帳、發票對帳、利潤分析儀表板
- **人事**：班表、薪資、KPI、教育訓練

跟 chickimmiu 主站綁定的優先 + 已有部分基礎：
- 採購端：`Products.sourcing.*` + `SinsangImporter` + `ShoplineXlsxImporter` 已建
- 財務端：`Orders.*` + `Refunds` + `Invoices` 已建，缺自動對帳 + P&L 報表
- 庫存：`Products.variants[].stock` + `lowStockThreshold` 已建，缺多倉
- HR：完全沒有

建議下一波先做「P&L 自動報表 + 採購單 → 出貨單 → 入庫流程化」，把現有資料串成可看儀表板，再說多倉與 HR。
