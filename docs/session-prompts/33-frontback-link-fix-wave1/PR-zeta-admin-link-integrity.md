# Wave 1 PR-ζ — Admin Link Integrity Diagnostics

**Branch**: `claude/wave1-link-integrity-view`
**Date**: 2026-05-06
**Wave**: 1（與 α/β/γ/δ/ε/θ/ι 平行）

---

## Background

封測公開營運前要排除 link 斷掉的暗坑：
- product 沒有 category（required，但 legacy data 可能漏）
- product.category 指向已刪除的 category（orphan ref）
- 重複 slug
- categories.productCount 與實際 COUNT 不一致
- 商品圖 broken（外部 CDN / 已刪除 media）
- aliasSlugs 重複指向不同 product（PR-δ 的副作用）

需要一個 admin 內建診斷頁，封測前 / 上線前快速掃。

---

## Goal

新建 `/admin/diagnostics/link-integrity` 頁，server-rendered，列出 6 種問題 + 一鍵修。

---

## Files

### Create
- `src/app/(payload)/admin/diagnostics/link-integrity/page.tsx` — server component (Payload v3 admin allows custom routes under `(payload)/admin/`)
- `src/components/admin/LinkIntegrityClient.tsx` — 'use client'，table + 修補按鈕
- `src/endpoints/linkIntegrityScan.ts` — `GET /api/admin/link-integrity/scan` 回 JSON

### Edit
- `src/globals/NavigationSettings.ts`（如果有 admin 內 sidebar config）— 加一個連結；**或**直接在 ⓪ 數據儀表 dashboard component (`CKMUDashboardNavGroup.tsx`) 加 link

### Do NOT touch
- 任何 collection
- 任何 globals 除了 NavigationSettings（如果適用）

⚠️ 接手前先 `cat src/components/admin/CKMUDashboardNavGroup.tsx` 確認 sidebar link 加入點；如果該檔結構複雜（看 [project_admin_sidebar_8_groups](../../../memory/) 教訓），改用 admin nav 的 `beforeNavLinks` 在 payload.config.ts 加新 component link，但 payload.config.ts 已被 α/β 動，避免 conflict 改用前述 dashboard 方案。

---

## Spec — 6 種檢查

| 檢查 | SQL/Query | 修法 |
|---|---|---|
| 1. Product without category | `WHERE category IS NULL` | 連到該 product edit page，admin 手動補 |
| 2. Orphan category ref | products.category 指向不存在的 category id | 標紅；提供「移到『未分類』」一鍵 fix |
| 3. Duplicate slug | `GROUP BY slug HAVING COUNT(*) > 1` | 標出重複 slug，不自動修（user 決定保留哪個） |
| 4. productCount mismatch | 比 categories.productCount vs `payload.count({collection:'products', where:{category:{equals:catId}}})` | 「重新計算全表」按鈕（call PR-γ 的 endpoint） |
| 5. Image broken | products.images[*].image.url is null OR fetch HEAD 非 200 (取樣 100 筆，避免太慢) | 列出，提供連到 product edit |
| 6. Duplicate alias slug | aliasSlugs.slug 在多 product 出現 | 列出衝突；user 手動清 |

---

## Implementation skeleton

```tsx
// src/app/(payload)/admin/diagnostics/link-integrity/page.tsx
import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import LinkIntegrityClient from '@/components/admin/LinkIntegrityClient'

export const dynamic = 'force-dynamic'

export default async function LinkIntegrityPage() {
  const payload = await getPayload({ config })
  // Auth check
  const h = await headers()
  const { user } = await payload.auth({ headers: h as unknown as Headers })
  if (!user || user.role !== 'admin') redirect('/admin/login')

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>連結完整性診斷</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        封測公開前確認商品/分類連結沒有斷掉。每次點「掃描」會重新跑全表檢查，可能需要 5-15 秒。
      </p>
      <LinkIntegrityClient />
    </div>
  )
}
```

```tsx
// src/components/admin/LinkIntegrityClient.tsx
'use client'
import { useState } from 'react'

type ScanResult = {
  productsWithoutCategory: Array<{ id: number; name: string; slug: string }>
  orphanCategoryRefs: Array<{ id: number; name: string; categoryId: number }>
  duplicateSlugs: Array<{ slug: string; count: number; ids: number[] }>
  countMismatch: Array<{ id: number; name: string; stored: number; actual: number }>
  imageBroken: Array<{ id: number; name: string; reason: string }>
  duplicateAliasSlugs: Array<{ slug: string; productIds: number[] }>
}

export default function LinkIntegrityClient() {
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<ScanResult | null>(null)
  const [err, setErr] = useState('')

  const scan = async () => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/admin/link-integrity/scan', { credentials: 'include' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  const recount = async () => {
    if (!confirm('確定要重新計算所有分類商品數？')) return
    const r = await fetch('/api/categories/recount', { method: 'POST', credentials: 'include' })
    const j = await r.json()
    alert(`完成：更新 ${j.changed?.length || 0} 個分類`)
    scan()
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={scan} disabled={busy}
          style={{ padding: '8px 16px', background: '#C19A5B', color: 'white', borderRadius: 4 }}>
          {busy ? '掃描中…' : '開始掃描'}
        </button>
        {data && (
          <button onClick={recount} style={{ marginLeft: 8, padding: '8px 16px' }}>
            重新計算分類商品數
          </button>
        )}
      </div>
      {err && <div style={{ color: 'red' }}>錯誤：{err}</div>}
      {data && (
        <div style={{ display: 'grid', gap: 24 }}>
          <Section title={`沒有分類的商品 (${data.productsWithoutCategory.length})`}
            items={data.productsWithoutCategory.map(p => ({
              text: `${p.name} (${p.slug})`,
              href: `/admin/collections/products/${p.id}`
            }))} />
          <Section title={`Orphan 分類引用 (${data.orphanCategoryRefs.length})`}
            items={data.orphanCategoryRefs.map(p => ({
              text: `${p.name} → 不存在的 category id ${p.categoryId}`,
              href: `/admin/collections/products/${p.id}`
            }))} />
          <Section title={`重複 slug (${data.duplicateSlugs.length})`}
            items={data.duplicateSlugs.map(d => ({
              text: `slug='${d.slug}' 出現 ${d.count} 次：products [${d.ids.join(', ')}]`,
              href: '#'
            }))} />
          <Section title={`分類商品數不一致 (${data.countMismatch.length})`}
            items={data.countMismatch.map(m => ({
              text: `${m.name}: 存 ${m.stored} / 實際 ${m.actual}`,
              href: `/admin/collections/categories/${m.id}`
            }))} />
          <Section title={`圖片破損 (${data.imageBroken.length})`}
            items={data.imageBroken.map(b => ({
              text: `${b.name} — ${b.reason}`,
              href: `/admin/collections/products/${b.id}`
            }))} />
          <Section title={`重複 alias slug (${data.duplicateAliasSlugs.length})`}
            items={data.duplicateAliasSlugs.map(a => ({
              text: `${a.slug} → products [${a.productIds.join(', ')}]`,
              href: '#'
            }))} />
        </div>
      )}
    </div>
  )
}

function Section({ title, items }: { title: string; items: Array<{ text: string; href: string }> }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h3>
      {items.length === 0 ? (
        <div style={{ color: 'green' }}>✓ 沒問題</div>
      ) : (
        <ul style={{ paddingLeft: 16 }}>
          {items.slice(0, 50).map((item, i) => (
            <li key={i}>
              {item.href !== '#'
                ? <a href={item.href} target="_blank" rel="noreferrer">{item.text}</a>
                : item.text}
            </li>
          ))}
          {items.length > 50 && <li>...還有 {items.length - 50} 筆，僅顯示前 50</li>}
        </ul>
      )}
    </div>
  )
}
```

```ts
// src/endpoints/linkIntegrityScan.ts
// 註冊：在 payload.config.ts 的 endpoints[] (top-level)，或在 Products collection endpoints[]
// 建議放 Payload top-level endpoints — 跨 collection 查詢自然
import type { Endpoint } from 'payload'

export const linkIntegrityScanEndpoint: Endpoint = {
  path: '/admin/link-integrity/scan',
  method: 'get',
  handler: async (req) => {
    if (!req.user || req.user.role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    // 1. products without category
    const noCat = await req.payload.find({
      collection: 'products',
      where: { category: { exists: false } },
      limit: 500, depth: 0,
    })
    // 2-6 ...省略，照規則跑
    // 3. duplicate slug — 用 raw SQL
    // 4. countMismatch — for-each category, count products
    return Response.json({
      productsWithoutCategory: noCat.docs.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
      orphanCategoryRefs: [],
      duplicateSlugs: [],
      countMismatch: [],
      imageBroken: [],
      duplicateAliasSlugs: [], // 等 PR-δ merge 後才有資料
    })
  },
}
```

⚠️ Endpoint 要註冊。**避免動 payload.config.ts**（α/β 已動）— 改在 Products collection 的 endpoints[] 加，但這樣 path 會變成 `/api/products/admin/link-integrity/scan`。權衡之後可以接受，client fetch 改即可。

---

## Acceptance

- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 清
- [ ] `pnpm payload generate:importmap` commit
- [ ] 訪問 `/admin/diagnostics/link-integrity`（已 admin 登入）→ 看到頁
- [ ] 點「開始掃描」→ 5-15 秒回結果
- [ ] 6 個 section 都有 OK / 列項顯示
- [ ] 「重新計算分類商品數」按鈕串接 PR-γ endpoint（如 γ 未 merge，先用空 stub）
- [ ] 非 admin 訪問 → redirect 到 `/admin/login`
