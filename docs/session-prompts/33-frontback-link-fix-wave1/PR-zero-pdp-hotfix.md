# 🚨 PR-0 — PDP system-wide 404 hotfix（先做，封測 blocker）

**Branch**: `claude/wave1-pdp-hotfix`
**Date**: 2026-05-06
**Priority**: P0 — 在 Wave 1 八個並行 PR 之前**必先 merge + deploy**
**Status**: 已診斷確認，**等動手實作**

---

## 1. 事故摘要

prod **非 ASCII (中文 / URL-encoded) slug** 的 PDP 全顯示「商品不存在」。ASCII slug PDP 正常 200。封測公開要面向中文消費者，這是 blocker。

### 證據（curl 驗證）

| Test | Result |
|---|---|
| `GET /api/products?where[slug][equals]=現貨-率性反摺牛仔寬褲-藍色-free--ecbd15&depth=2` | 200，命中 docs[0] id=4647 status=published |
| `GET /products/<URL-encoded 中文 slug>` (5 支真實在 DB published) | **5/5 顯示「商品不存在」** (HTTP 200，title 是 not-found) |
| `GET /products/candace-straight-pants-dark` (ASCII slug，sitemap 取得) | **200，正常渲染 125 KB**（PR-0 session 實測） |
| `GET /products/yves-ultra-slim-micro-flare` | 200 正常 |
| `GET /products/y2k-oval-sunglasses` | 200 正常 |

差異 = slug 是否含 non-ASCII byte。API 用 `equals` 命中（DB 與比對字串都是 UTF-8 中文）；PDP server component 同樣 `equals` 不命中 → 強烈指向 Next.js dynamic `[slug]` params 對 percent-encoded UTF-8 漏 decode 或 double-decode。

---

## 2. 假設清單（按可能性）

### 假設 A — Next.js dynamic [slug] params 對 UTF-8 percent-encoded 漏 decode（最可能，已被 ASCII vs 中文差異佐證）

[src/app/(frontend)/products/[slug]/page.tsx:21](../../../src/app/(frontend)/products/[slug]/page.tsx) 與 :63 都 `await params`，slug 從 `params.slug` 取出。Next.js 14/15 通常會自動 url-decode dynamic segment，但有過 issues。
若 slug 是 `%E7%8F%BE%E8%B2%A8-...` raw encoded，`equals` 比中文字串直接 fail。

**驗證**：加一行 `console.log('PDP slug:', slug, 'len:', slug.length)`，看 prod log slug 內容。

### 假設 B — Next.js page server runtime 缺 `process.env.DATABASE_URI`

`page.tsx` 用 `if (process.env.DATABASE_URI)` gate 整段 fetch。若 prod Next runtime 載入 .env 時序不對，這條 if 可能 false → product 永遠 null。但**這應該也會炸別的頁**（PLP 也 gate），而 PLP 是 200 OK。所以這假設**不太可能**，但保險起見驗一下。

### 假設 C — `getPayload({ config })` 在 Next page context 與 Payload REST 不同 instance

Payload v3 + Next 15 配合在 instance caching 上有過坑。但同樣若這成立，PLP 也會壞。**不太可能**。

### 假設 D — try-catch 吞了 query thrown

```ts
try { ... } catch { /* DB not ready */ }  // <-- 沒 log
```
若 query 因 schema mismatch / hooks 炸（但 API 同一 config 沒事），catch 吞掉 → product=null。但 API 同 query 通，所以**不太可能**。

---

## 3. 修法（一次蓋三個假設）

### 3.1 直接用 helper + 顯式 log + 雙重 slug query

修改 [src/app/(frontend)/products/[slug]/page.tsx](../../../src/app/(frontend)/products/[slug]/page.tsx)：

```ts
import { redirect } from 'next/navigation'

async function findProductBySlug(slug: string) {
  if (!process.env.DATABASE_URI) {
    console.warn('[PDP] DATABASE_URI not set in Next runtime')
    return null
  }

  // 嘗試的 slug 變體（A/B 假設都覆蓋）
  let decoded: string
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    decoded = slug
  }
  const candidates = Array.from(new Set([slug, decoded]))

  try {
    const payload = await getPayload({ config })

    for (const cand of candidates) {
      const { docs } = await payload.find({
        collection: 'products',
        where: { slug: { equals: cand } },
        limit: 1,
        depth: 2,
      })
      if (docs[0]) {
        return docs[0] as Record<string, unknown>
      }
    }

    // 都沒命中 → 嘗試 aliasSlugs（PR-δ merge 後啟用）
    // 註：PR-δ 會加這段 fallback；PR-0 階段先寫 placeholder
    // for (const cand of candidates) {
    //   const { docs } = await payload.find({
    //     collection: 'products',
    //     where: { 'aliasSlugs.slug': { equals: cand } },
    //     limit: 1, depth: 0,
    //   })
    //   const m = docs[0] as { slug?: string } | undefined
    //   if (m?.slug) {
    //     // 301 redirect to canonical — 但這要在 Server Component 用 redirect()
    //     // 先標 TODO，PR-δ 會接
    //     console.log('[PDP] alias hit:', cand, '→', m.slug)
    //     return m
    //   }
    // }

    console.log('[PDP] miss:', { slug, decoded, candidates })
    return null
  } catch (err) {
    // 之前是靜默吞，現在 log 出來方便診斷
    console.error('[PDP] payload.find threw:', err)
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await findProductBySlug(slug)
  if (!product) return { title: '商品不存在｜CHIC KIM & MIU' }
  // ... 原本的 metadata 組裝邏輯（用 product 變數）
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await findProductBySlug(slug)
  if (!product) notFound()

  // ... related products 邏輯（不變，用既有 cat / fallback）
  // ... return JSX
}
```

### 3.2 確保 notFound() 真的回 404 status

App Router `notFound()` 應該 throw 進 nearest `not-found.tsx` boundary。確認 [src/app/(frontend)/not-found.tsx](../../../src/app/(frontend)/not-found.tsx) 存在。如果**不存在**，加：

```tsx
// src/app/(frontend)/products/[slug]/not-found.tsx
import Link from 'next/link'
export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl mb-4">商品不存在</h1>
        <Link href="/products" className="text-gold-600 underline">瀏覽全部商品</Link>
      </div>
    </main>
  )
}
```

實際上 not-found.tsx 已經存在的話 status code 應該是 404。讓 status code 從 200 變 404 也順便修了 SEO。

### 3.3 補一個 prod runtime sanity log

在 page.tsx 最頂層 `console.log('[PDP] route loaded, DATABASE_URI set:', !!process.env.DATABASE_URI)`，重 deploy 後在 `pm2 logs --lines 50 chickimmiu-nextjs` 看是否有印出。（這行可以在驗收完後拿掉。）

---

## 4. Files

### Edit
- `src/app/(frontend)/products/[slug]/page.tsx` — 抽 `findProductBySlug` helper、generateMetadata + default 共用、雙重 slug 嘗試、log 出 query 結果

### Create (if not exists)
- `src/app/(frontend)/products/[slug]/not-found.tsx`

### Do NOT touch
- `ProductDetailClient.tsx`（不是 root cause）
- 其他 collections / globals
- PLP

---

## 5. Acceptance（必驗）

- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 清
- [ ] **dev server**：`/products/<seed-or-import-slug>` 200 + 顯示真實商品名
- [ ] **prod deploy 後 5 個 smoke**：對 prod API 抓 5 個 published slug，每一個 PDP 200 + title 含商品名（不是「商品不存在」）
- [ ] 不存在的 slug → status **404**（不是 200），title 「商品不存在」
- [ ] `pm2 logs` 看到 `[PDP] route loaded` + 命中時不噴 error
- [ ] 對 user 給的 URL `/products/%E7%8F%BE%E8%B2%A8-%E7%8E%87%E6%80%A7%E5%8F%8D%E6%91%BA%E7%89%9B%E4%BB%94%E5%AF%AC%E8%A4%B2-%E8%97%8D%E8%89%B2-free--ecbd15` 回真實商品

---

## 6. Smoke 一鍵指令（驗收用）

```bash
python3 - <<'PY'
import json, urllib.parse, urllib.request, re
list_data = json.loads(urllib.request.urlopen('https://pre.chickimmiu.com/api/products?limit=5&depth=0').read())
print(f"totalDocs={list_data.get('totalDocs')}")
fails = 0
for doc in list_data['docs']:
    slug = doc['slug']
    enc = urllib.parse.quote(slug)
    body = urllib.request.urlopen(f'https://pre.chickimmiu.com/products/{enc}', timeout=15).read().decode('utf-8','replace')
    m = re.search(r'<title>([^<]+)</title>', body)
    title = m.group(1) if m else ''
    ok = '商品不存在' not in title
    print(f"{'✓' if ok else '✗'} {slug!r} → {title!r}")
    if not ok: fails += 1
print(f"\n{len(list_data['docs'])-fails}/{len(list_data['docs'])} pass")
PY
```

預期：`5/5 pass`。

---

## 7. 後續（merge 後）

- Wave 1 八個 PR 才能正常 verify（沒 PDP 就沒辦法驗 PR-δ aliasSlugs / PR-θ smoke）
- PR-δ 會接這個 helper 加 alias fallback，本 PR-0 已留 placeholder 註解
- prod log 有 `[PDP] miss` 訊息可以累積觀察哪些 slug 是真的不存在 vs query bug

---

## 8. 給接手 session 的開頭 prompt

```
Read docs/session-prompts/33-frontback-link-fix-wave1/PR-zero-pdp-hotfix.md
這是 P0 事故 hotfix。讀完直接動手，不需先問。
診斷已做完證據在 §1，假設在 §2，修法在 §3。
checkout main → branch claude/wave1-pdp-hotfix → 動 src/app/(frontend)/products/[slug]/page.tsx → tsc → build → 開 PR。
```
