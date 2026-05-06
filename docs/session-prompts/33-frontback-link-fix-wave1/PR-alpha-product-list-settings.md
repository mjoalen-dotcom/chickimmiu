# Wave 1 PR-α — ProductListSettings global

**Branch**: `claude/wave1-product-list-settings`
**Date**: 2026-05-06
**Owner**: TBD
**Wave**: 1（與 β/γ/δ/ε/ζ/θ/ι 平行）

---

## Background

PLP `/products` 寫死 `limit:200` + 客戶端 filter，後台無法控制每頁筆數、排序、banner、最高價格。本 PR 只**建立 admin 設定**，**不動 PLP 渲染**（留給 Wave 2 PR-κ）。

---

## Goal

新增 `ProductListSettings` global，讓 admin 在 `⑥ 內容與頁面` group 下設定 PLP 行為。

---

## Spec — fields

| name | type | default | label |
|---|---|---|---|
| `pageSize` | number | 24 | 每頁商品數 |
| `pageSizeOptions` | array of {value: number} | [{12},{24},{36},{48},{60}] | 前台可切換的每頁筆數選項 |
| `defaultSort` | select | `newest` | 預設排序（newest / price-asc / price-desc / popular） |
| `maxPriceCap` | number | 10000 | 價格篩選上限（NTD） |
| `hideOutOfStock` | checkbox | false | 缺貨商品自動隱藏 |
| `showSizeFilter` | checkbox | true | 顯示尺寸篩選器 |
| `defaultRelatedCount` | number | 4 | PDP「同樣的人也買了」筆數 |
| `banner` group |  |  |  |
| `banner.image` | upload (media) | – | 頂部 banner 圖（建議 1920×400） |
| `banner.overline` | text | `PRODUCTS` | 上方小標 |
| `banner.title` | text | `全部商品` | 主標 |
| `banner.subtitle` | textarea | – | 副標說明 |

Group: `⑥ 內容與頁面`，slug `product-list-settings`。

---

## Files

### Create
- `src/globals/ProductListSettings.ts`
- `src/migrations/20260506_HHMMSS_add_product_list_settings.ts`（HHMMSS 取執行當下時刻）

### Edit
- `src/payload.config.ts` — 在 `globals: [...]` array 中加入 `ProductListSettings`，建議**靠近 HomepageSettings** 那行下方（line range 不會與 PR-β 重疊，β 改加在 RecommendationSettings 下方）

### Do NOT touch
- `src/app/(frontend)/products/page.tsx`
- `src/app/(frontend)/products/ProductListClient.tsx`
- 其他 globals
- 其他 collections

---

## Implementation skeleton

```ts
// src/globals/ProductListSettings.ts
import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

export const ProductListSettings: GlobalConfig = {
  slug: 'product-list-settings',
  label: '商品列表頁設定',
  admin: {
    group: '⑥ 內容與頁面',
    description: '/products 列表頁的分頁、排序、banner、篩選器顯示控制',
  },
  access: { read: () => true, update: isAdmin },
  hooks: {
    afterChange: [() => safeRevalidate(['/products'])],
  },
  fields: [
    { name: 'pageSize', type: 'number', defaultValue: 24, min: 6, max: 120, label: '每頁商品數' },
    {
      name: 'pageSizeOptions',
      type: 'array',
      label: '每頁筆數選項',
      defaultValue: [{ value: 12 }, { value: 24 }, { value: 36 }, { value: 48 }, { value: 60 }],
      fields: [{ name: 'value', type: 'number', required: true, min: 6, max: 200 }],
    },
    {
      name: 'defaultSort',
      type: 'select',
      defaultValue: 'newest',
      options: [
        { label: '最新上架', value: 'newest' },
        { label: '價格：低到高', value: 'price-asc' },
        { label: '價格：高到低', value: 'price-desc' },
        { label: '人氣推薦', value: 'popular' },
      ],
    },
    { name: 'maxPriceCap', type: 'number', defaultValue: 10000, min: 100 },
    { name: 'hideOutOfStock', type: 'checkbox', defaultValue: false },
    { name: 'showSizeFilter', type: 'checkbox', defaultValue: true },
    { name: 'defaultRelatedCount', type: 'number', defaultValue: 4, min: 0, max: 12 },
    {
      name: 'banner',
      type: 'group',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media' },
        { name: 'overline', type: 'text', defaultValue: 'PRODUCTS' },
        { name: 'title', type: 'text', defaultValue: '全部商品' },
        { name: 'subtitle', type: 'textarea' },
      ],
    },
  ],
}
```

```ts
// src/payload.config.ts (edit)
import { ProductListSettings } from './globals/ProductListSettings'
// ...
globals: [
  HomepageSettings,
  ProductListSettings,  // <-- add this line
  // ... others
]
```

---

## Migration

跑 `npx payload generate:migration --name add_product_list_settings`，產出後人工改：
1. 把 `up()` 的 `CREATE TABLE` 包進 `IF NOT EXISTS`
2. `ALTER TABLE ... ADD COLUMN` 前先 `PRAGMA table_info(...)` 檢查
3. 範例見 [src/migrations/20260505_160000_add_utm_lock_rels.ts](../../../src/migrations/20260505_160000_add_utm_lock_rels.ts)

---

## Acceptance

- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 清
- [ ] `pnpm payload migrate` 在 dev 跑通
- [ ] `/admin/globals/product-list-settings` 表單顯示完整 11 欄位
- [ ] 存檔後 `safeRevalidate('/products')` 觸發（pm2 logs 看 revalidate 日誌）
- [ ] **PLP 前台無變化**（這 PR 只建設定，不接渲染）
