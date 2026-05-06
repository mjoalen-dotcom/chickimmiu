# Wave 1 PR-γ — Categories.productCount 自動化

**Branch**: `claude/wave1-category-product-count`
**Date**: 2026-05-06
**Wave**: 1（與 α/β/δ/ε/ζ/θ/ι 平行）

---

## Background

`Categories.productCount` 是 readOnly numeric ([Categories.ts:152-159](../../../src/collections/Categories.ts))，但 **prod 全是 0** — 因為沒有 hook 計算。後台無法判斷哪些分類空殼。

---

## Goal

1. Products `afterChange` / `afterDelete` hook 自動 increment / decrement 對應 categories.productCount
2. 一鍵全表 recount endpoint（admin only）
3. Categories list view 加「重新計算全表」按鈕

---

## Files

### Edit
- `src/collections/Products.ts` — 在 `hooks.afterChange[]` 既有陣列**最後**加一個 hook；`hooks.afterDelete[]` 同理
  - 注意：α/β 不動 Products.ts；δ 動 fields 區（不同區塊）
- `src/collections/Categories.ts` — 在 `endpoints: [...]` 加入 `recountCategoriesEndpoint`

### Create
- `src/endpoints/recountCategories.ts`
- `src/components/admin/CategoryRecountButton.tsx`（client component，掛 Categories list view 的 `beforeListTable`）

### Do NOT touch
- `src/app/(frontend)/products/**`
- 其他 collections / globals

---

## Implementation skeleton

```ts
// src/collections/Products.ts (edit hooks)
hooks: {
  // ...既有 hooks
  afterChange: [
    // ...既有
    async ({ doc, previousDoc, req, operation }) => {
      try {
        const oldCat = previousDoc?.category
        const newCat = doc?.category
        const getId = (c: unknown): number | null => {
          if (!c) return null
          if (typeof c === 'object' && c !== null && 'id' in c) return Number((c as { id: number }).id)
          return Number(c)
        }
        const oldId = getId(oldCat)
        const newId = getId(newCat)
        if (operation === 'create' && newId) {
          await bumpCategoryCount(req.payload, newId, +1)
        } else if (operation === 'update' && oldId !== newId) {
          if (oldId) await bumpCategoryCount(req.payload, oldId, -1)
          if (newId) await bumpCategoryCount(req.payload, newId, +1)
        }
      } catch (e) {
        req.payload.logger?.warn?.(`category count bump failed: ${(e as Error).message}`)
      }
    },
  ],
  afterDelete: [
    // ...既有
    async ({ doc, req }) => {
      try {
        const cat = doc?.category
        const id = typeof cat === 'object' && cat !== null && 'id' in cat
          ? Number((cat as { id: number }).id)
          : Number(cat)
        if (id) await bumpCategoryCount(req.payload, id, -1)
      } catch (e) {
        req.payload.logger?.warn?.(`category count bump on delete failed: ${(e as Error).message}`)
      }
    },
  ],
}

// helper（放 Products.ts 檔尾或新檔 src/lib/categoryCount.ts）
async function bumpCategoryCount(payload: any, categoryId: number, delta: number) {
  const cat = await payload.findByID({ collection: 'categories', id: categoryId, depth: 0 })
  const next = Math.max(0, ((cat?.productCount as number | undefined) || 0) + delta)
  await payload.update({
    collection: 'categories',
    id: categoryId,
    data: { productCount: next },
    depth: 0,
  })
}
```

```ts
// src/endpoints/recountCategories.ts
import type { Endpoint } from 'payload'

export const recountCategoriesEndpoint: Endpoint = {
  path: '/recount',
  method: 'post',
  handler: async (req) => {
    if (!req.user || req.user.role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    const { docs: cats } = await req.payload.find({
      collection: 'categories', limit: 1000, depth: 0,
    })
    const results: Array<{ id: number; before: number; after: number }> = []
    for (const cat of cats) {
      const { totalDocs } = await req.payload.count({
        collection: 'products',
        where: { category: { equals: cat.id } },
      })
      const before = (cat.productCount as number | undefined) || 0
      if (before !== totalDocs) {
        await req.payload.update({
          collection: 'categories', id: cat.id as number,
          data: { productCount: totalDocs }, depth: 0,
        })
      }
      results.push({ id: cat.id as number, before, after: totalDocs })
    }
    return Response.json({ ok: true, count: results.length, changed: results.filter(r => r.before !== r.after) })
  },
}
```

```tsx
// src/components/admin/CategoryRecountButton.tsx
'use client'
import { useState } from 'react'
export default function CategoryRecountButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  return (
    <div style={{ padding: 12, background: '#fffbe6', border: '1px solid #f0e0a0', borderRadius: 8, marginBottom: 12 }}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setMsg('計算中...')
          try {
            const r = await fetch('/api/categories/recount', { method: 'POST', credentials: 'include' })
            const j = await r.json()
            setMsg(`完成：總 ${j.count} 個分類，更新 ${j.changed?.length || 0} 個`)
          } catch (e) { setMsg(`失敗：${(e as Error).message}`) }
          finally { setBusy(false) }
        }}
      >
        {busy ? '計算中…' : '重新計算所有分類商品數'}
      </button>
      {msg && <span style={{ marginLeft: 12 }}>{msg}</span>}
    </div>
  )
}
```

```ts
// src/collections/Categories.ts (edit)
endpoints: [
  seedShoplineCategoriesEndpoint,
  categoryReorderEndpoint,
  recountCategoriesEndpoint,  // <-- add
],
admin: {
  // ...
  components: {
    beforeListTable: [{ path: '@/components/admin/CategoryRecountButton' }],
    views: { list: { Component: '@/components/admin/CategoryTreeView' } },
  },
}
```

⚠️ Categories list view 已用 custom Component (`CategoryTreeView`)。若 `beforeListTable` 不會被 custom view 渲染，改成把 button 放在 `CategoryTreeView.tsx` 上方（不在本 PR scope，先放 beforeListTable 試）。

---

## Acceptance

- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 清
- [ ] `pnpm payload generate:importmap` 跑過、commit `importMap.js`
- [ ] 在 admin 改一個 product 的 category，存檔 → 兩個分類的 productCount 各自 ±1
- [ ] 刪除 product → 分類 productCount -1
- [ ] `POST /api/categories/recount` 回 `{ok:true, count:N, changed:[...]}`
- [ ] 後台 Categories list 看到「重新計算所有分類商品數」按鈕
