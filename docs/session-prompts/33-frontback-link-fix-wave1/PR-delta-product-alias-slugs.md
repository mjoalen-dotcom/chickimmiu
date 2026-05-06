# Wave 1 PR-δ — Products.aliasSlugs + PDP fallback

**Branch**: `claude/wave1-product-alias-slugs`
**Date**: 2026-05-06
**Wave**: 1（與 α/β/γ/ε/ζ/θ/ι 平行）

---

## Background

User 反映 `/products/現貨-率性反摺牛仔寬褲-藍色-free--ecbd15` 404。

事實：
- repo 全文 grep `ecbd15` / `率性反摺` / `牛仔寬褲` 0 hits → **不在 seed**
- 該 slug 結構是 Shopline export slugify pattern (`現貨-中文名-顏色-尺寸--6位hash`)
- Shopline 7,226 商品**未匯入** prod ([docs/session-prompts/31-shopline-data-migration-handoff.md](../31-shopline-data-migration-handoff.md))
- 即使 Wave 2 PR-η 跑完匯入，slug 也會被 Payload 重 slugify → 與 user 分享的舊 URL 對不上

**對策**：商品支援多個 alias slug；PDP 找不到 canonical 時 fallback 到 alias，命中後 301 redirect 到 canonical。

---

## Goal

1. Products 加 `aliasSlugs[]` array field（slug + source）
2. PDP route：canonical 找不到 → 用 alias 二次查 → 命中則 301 redirect 到 `/products/<canonical-slug>`
3. 補 migration

---

## Files

### Edit
- `src/collections/Products.ts` — 在「網址代碼」slug 那個 row 之後加 `aliasSlugs` array field（位置：line ~430 附近，緊跟在 slug 欄位下）
  - 注意：γ 不動 fields；γ 只動 hooks
- `src/app/(frontend)/products/[slug]/page.tsx` — 在 `notFound()` 前加 alias fallback + 301 redirect
- `src/lib/shopline/xlsxParser.ts`（如果動到才動）— 匯入時把 Shopline 原 slug 寫入 aliasSlugs

### Create
- `src/migrations/20260506_HHMMSS_add_product_alias_slugs.ts`

### Do NOT touch
- `ProductListClient.tsx`
- 其他 collections

---

## Implementation skeleton

```ts
// src/collections/Products.ts (在 slug row 後加)
{
  name: 'aliasSlugs',
  label: '舊 URL / 別名',
  type: 'array',
  admin: {
    description: '從舊系統（如 Shopline）匯入的 URL slug。前台 PDP 找不到 slug 時會用這裡 fallback 並 301 redirect 到目前 slug。',
    initCollapsed: true,
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      admin: { description: '完整 slug 字串（不含 /products/），例如：現貨-率性反摺牛仔寬褲-藍色-free--ecbd15' },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: '手動補', value: 'manual' },
        { label: 'Shopline 匯入', value: 'shopline' },
        { label: 'CSV 匯入', value: 'csv' },
        { label: '其他舊系統', value: 'other' },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ value }) => {
        if (!Array.isArray(value)) return value
        // 去重 + 正規化
        const seen = new Set<string>()
        return value.filter((row: { slug?: string }) => {
          const s = (row?.slug || '').trim()
          if (!s || seen.has(s)) return false
          seen.add(s)
          return true
        })
      },
    ],
  },
}
```

```ts
// src/app/(frontend)/products/[slug]/page.tsx (edit)
import { redirect } from 'next/navigation'

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  let product: Record<string, unknown> | null = null
  // ...既有 fetch by slug...

  // 新增：alias fallback (放在 product 還是 null 但還沒 notFound() 之前)
  if (!product && process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'products',
        where: { 'aliasSlugs.slug': { equals: slug } },
        limit: 1,
        depth: 0,
      })
      const aliasMatch = docs[0] as Record<string, unknown> | undefined
      if (aliasMatch?.slug && aliasMatch.slug !== slug) {
        // 301 redirect 到 canonical
        redirect(`/products/${aliasMatch.slug as string}`)
      }
    } catch {
      // ignore
    }
  }

  if (!product) notFound()
  // ...rest unchanged
}
```

注意：`payload.find` 對 array 子欄位的 query 用 `'aliasSlugs.slug'` dot notation。SQLite 內部會 JOIN 子表（`products_alias_slugs`），確認 migration 有建索引。

---

## Migration

```ts
// src/migrations/20260506_HHMMSS_add_product_alias_slugs.ts
import { sql } from '@payloadcms/db-sqlite'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS products_alias_slugs (
      _order INTEGER NOT NULL,
      _parent_id INTEGER NOT NULL,
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      FOREIGN KEY (_parent_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS products_alias_slugs_parent_id_idx ON products_alias_slugs(_parent_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS products_alias_slugs_slug_idx ON products_alias_slugs(slug);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS products_alias_slugs;`)
}
```

⚠️ Payload `generate:migration` 會自己產這個 schema，但**會缺索引**。產完手動加 `slug_idx`（PDP 每次 fallback 都查它，沒 index 會 full scan）。

---

## Acceptance

- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 清
- [ ] `pnpm payload migrate` 通
- [ ] admin 編一個 product，加 alias `test-old-slug`，存檔
- [ ] 訪問 `/products/test-old-slug` → 301 → 重導到 canonical slug、頁面 200
- [ ] 訪問 `/products/不存在的-slug` → 404（沒命中 alias）
- [ ] `pnpm payload generate:importmap` 跑、commit（雖然這 PR 沒新 admin component，但保險）
- [ ] DB 有索引：`sqlite3 dev.db ".indexes products_alias_slugs"`
