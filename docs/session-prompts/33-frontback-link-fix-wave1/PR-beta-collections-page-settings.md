# Wave 1 PR-β — CollectionsPageSettings global

**Branch**: `claude/wave1-collections-page-settings`
**Date**: 2026-05-06
**Wave**: 1（與 α/γ/δ/ε/ζ/θ/ι 平行）

---

## Background

`/collections` 頁面 7 個卡片寫死，圖片用 `shoplineimg.com` 外部 CDN（**prod 確認全 broken**）。`/collections/[slug]` `COLLECTION_META` 也 hardcoded。後台改不到。

本 PR **只建設定 + migration**，**不動前台 collections 兩個頁**（留給 Wave 2 PR-λ）。

---

## Goal

新增 `CollectionsPageSettings` global，讓 admin 控制 `/collections` 頁的 hero 文案 + themed 卡片陣列（圖、標、slug、span、isActive、sortOrder、heroDescription）。

---

## Spec — fields

```
hero (group)
  ├─ overline       text            default: 'Collection'
  ├─ title          text            default: '主題精選'
  ├─ description    textarea        default: '依風格、場合、主題瀏覽我們為您精心策劃的系列'

cards (array, minRows:1, maxRows:24)
  ├─ image          upload(media)   required
  ├─ title          text            required
  ├─ slug           text            required  description: '對應 /collections/<slug>'
  ├─ description    textarea        — 點進去頁的副標
  ├─ span           select          default: 'normal'
  │                                 options: normal / wide(2col) / tall(2row) / large(2col×2row)
  ├─ sortOrder      number          default: 0
  ├─ isActive       checkbox        default: true
  ├─ collectionTagsFilter  select hasMany   options: 同 Products.collectionTags 的 8 個 value (jin-live, jin-style, host-style, brand-custom, formal-dresses, rush, celebrity-style, korean-celebrity)
  ├─ seo (group)
  │     ├─ metaTitle       text
  │     └─ metaDescription textarea
```

Group: `⑥ 內容與頁面`，slug `collections-page-settings`。

---

## Files

### Create
- `src/globals/CollectionsPageSettings.ts`
- `src/migrations/20260506_HHMMSS_add_collections_page_settings.ts`

### Edit
- `src/payload.config.ts` — `globals: [...]` 加入 `CollectionsPageSettings`，**緊跟在 PR-α 的 ProductListSettings 後面**（避免與 α 同行衝突）

### Do NOT touch
- `src/app/(frontend)/collections/page.tsx`
- `src/app/(frontend)/collections/[slug]/page.tsx`
- `HomepageSettings.ts`、其他 globals

---

## Implementation skeleton

```ts
// src/globals/CollectionsPageSettings.ts
import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

export const CollectionsPageSettings: GlobalConfig = {
  slug: 'collections-page-settings',
  label: '主題精選頁設定',
  admin: {
    group: '⑥ 內容與頁面',
    description: '/collections 頁的 hero 文案與主題卡片管理',
  },
  access: { read: () => true, update: isAdmin },
  hooks: {
    afterChange: [({ doc }) => {
      safeRevalidate(['/collections'])
      const cards = (doc?.cards as Array<{ slug?: string }> | undefined) || []
      cards.forEach((c) => c.slug && safeRevalidate([`/collections/${c.slug}`]))
    }],
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'overline', type: 'text', defaultValue: 'Collection' },
        { name: 'title', type: 'text', defaultValue: '主題精選' },
        { name: 'description', type: 'textarea',
          defaultValue: '依風格、場合、主題瀏覽我們為您精心策劃的系列' },
      ],
    },
    {
      name: 'cards',
      type: 'array',
      minRows: 1, maxRows: 24,
      label: '主題卡片',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true,
          admin: { description: '對應 /collections/<slug>，例如 jin-live' } },
        { name: 'description', type: 'textarea' },
        {
          name: 'span',
          type: 'select',
          defaultValue: 'normal',
          options: [
            { label: '一般 (1×1)', value: 'normal' },
            { label: '寬 (2×1)', value: 'wide' },
            { label: '高 (1×2)', value: 'tall' },
            { label: '大 (2×2)', value: 'large' },
          ],
        },
        { name: 'sortOrder', type: 'number', defaultValue: 0 },
        { name: 'isActive', type: 'checkbox', defaultValue: true },
        {
          name: 'collectionTagsFilter',
          type: 'select',
          hasMany: true,
          options: [
            { label: '金老佛爺 Live', value: 'jin-live' },
            { label: '金金同款專區', value: 'jin-style' },
            { label: '主播同款專區', value: 'host-style' },
            { label: '品牌自訂款', value: 'brand-custom' },
            { label: '婚禮洋裝/正式洋裝', value: 'formal-dresses' },
            { label: '現貨速到 Rush', value: 'rush' },
            { label: '藝人穿搭', value: 'celebrity-style' },
            { label: '韓星同款', value: 'korean-celebrity' },
          ],
          admin: { description: '此卡片連到的商品篩選條件（用於 /collections/<slug> 頁）' },
        },
        {
          name: 'seo',
          type: 'group',
          fields: [
            { name: 'metaTitle', type: 'text' },
            { name: 'metaDescription', type: 'textarea' },
          ],
        },
      ],
    },
  ],
}
```

---

## Migration

`npx payload generate:migration --name add_collections_page_settings`，再人工冪等化（同 PR-α 規則）。

---

## Acceptance

- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 清
- [ ] migrate 通
- [ ] `/admin/globals/collections-page-settings` 表單可建 cards、上傳圖、選 collectionTagsFilter
- [ ] 存檔後 `/collections` revalidate 觸發
- [ ] **`/collections` 前台無變化**（這 PR 只建設定）

---

## Seed（可選，加分）

寫一支 `scripts/seed-collections-page.ts` 把 [src/app/(frontend)/collections/page.tsx:13-56](../../../src/app/(frontend)/collections/page.tsx) 既有 7 條 hardcoded 卡片寫進 global（圖片改用 placeholder 或留空，等 PR-λ 階段 user 上傳真圖）。減輕 Wave 2 PR-λ 的 setup 負擔。
