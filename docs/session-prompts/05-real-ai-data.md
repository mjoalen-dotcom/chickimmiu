# 05 — 推薦 / UGC / 首頁接真實資料

## 目標
- `src/lib/recommendationEngine.ts` 目前 `PRODUCT_POOL = []` 是空殼 → 改為 Payload 驅動的 server action
- PDP `/products/[slug]` 「相關商品」查詢 key 錯（用 category.id 但前台傳 slug）
- 首頁 UGC Gallery 目前從「新品 + 熱銷 derive」做假資料 → 改從 `UGCPosts` collection 真實資料
- 首頁 / PDP「你可能也喜歡」「也買了」改用 Orders co-occurrence 或 tier-aware 簡單邏輯

## 前置
- Wave 2 全部建議先 merge（組 02 / 03 可能改 Users / Orders hook）

## ▼▼▼ 以下整段貼到新 session ▼▼▼

```
# 05 — 真實推薦 + UGC 資料串接

## Context
- CHIC KIM & MIU Next.js 15 + Payload v3
- 本機：`C:\Users\mjoal\ally-site\chickimmiu`

## Background
- `src/lib/recommendationEngine.ts:44` `PRODUCT_POOL: RecommendedItem[] = []` → 5 個 helper 全回空
- 首頁 `src/app/(frontend)/page.tsx` 用 `getProductImage()` + "也買了" 區塊但資料源假
- PDP `src/app/(frontend)/products/[slug]/page.tsx:87` 查 related 用 `category.id` 但 parent 傳 slug → relationship depth 對不上
- UGC：`src/collections/UGCPosts.ts`（commit `0503e18` 加的）存在，但首頁的 `<UGCGallery>` 從 `ugcTaggedProducts`（derive 自新品 + 熱銷）餵

## Your Task

### Task A: 真實推薦 server actions
重寫 `src/lib/recommendationEngine.ts`：
```ts
'use server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Product, Order } from '@/payload-types'  // 若有 type gen

type Reco = { id: string; slug: string; title: string; image: string; price: number; salePrice?: number }

export async function getRelated(productId: string, limit = 4): Promise<Reco[]> {
  const payload = await getPayload({ config })
  const p = await payload.findByID({ collection: 'products', id: productId, depth: 1 })
  if (!p) return []
  // 同 category 排除自己
  const catId = typeof p.category === 'object' ? p.category?.id : p.category
  if (!catId) return []
  const r = await payload.find({
    collection: 'products',
    where: { and: [{ category: { equals: catId } }, { id: { not_equals: productId } }, { isActive: { equals: true } }] },
    limit,
    depth: 1,
  })
  return r.docs.map(toReco)
}

export async function getAlsoBought(productId: string, limit = 4): Promise<Reco[]> {
  const payload = await getPayload({ config })
  // SQLite 無窗函式 + Payload where 不支援複雜 JOIN，用 JS side 計算
  // 1) 找所有包含 productId 的已付款訂單
  const orders = await payload.find({
    collection: 'orders',
    where: { and: [{ 'items.product': { equals: productId } }, { status: { in: ['paid', 'shipped', 'completed'] } }] },
    limit: 200, depth: 1,
  })
  // 2) 收集共現商品 id → count
  const co = new Map<string, number>()
  for (const o of orders.docs) {
    for (const it of o.items ?? []) {
      const pid = typeof it.product === 'object' ? it.product.id : it.product
      if (pid && pid !== productId) co.set(pid, (co.get(pid) ?? 0) + 1)
    }
  }
  // 3) sort by count desc, fetch top N products
  const top = Array.from(co.entries()).sort((a,b) => b[1]-a[1]).slice(0, limit).map(([id]) => id)
  if (!top.length) return getRelated(productId, limit)  // fallback
  const prods = await payload.find({ collection: 'products', where: { id: { in: top } }, depth: 1 })
  return prods.docs.map(toReco)
}

export async function getPersonalized(userId: string | null, limit = 8): Promise<Reco[]> {
  const payload = await getPayload({ config })
  if (!userId) {
    // guest: 熱銷 top N
    const r = await payload.find({ collection: 'products', where: { isActive: { equals: true } }, sort: '-totalOrders', limit, depth: 1 })
    return r.docs.map(toReco)
  }
  // 登入：找該使用者購買過的 categories → 推該 categories 其他商品
  const orders = await payload.find({ collection: 'orders', where: { 'customer': { equals: userId } }, limit: 50, depth: 2 })
  const cats = new Set<string>()
  for (const o of orders.docs) for (const it of o.items ?? []) {
    const cat = typeof it.product === 'object' && typeof it.product?.category === 'object' ? it.product.category.id : null
    if (cat) cats.add(cat)
  }
  if (!cats.size) return getPersonalized(null, limit)
  const r = await payload.find({ collection: 'products', where: { and: [{ category: { in: Array.from(cats) } }, { isActive: { equals: true } }] }, sort: '-totalOrders', limit, depth: 1 })
  return r.docs.map(toReco)
}

function toReco(p: any): Reco {
  return {
    id: p.id, slug: p.slug, title: p.title,
    image: p.images?.[0]?.image?.url ?? '/media/placeholder.webp',
    price: p.price, salePrice: p.salePrice,
  }
}
```

### Task B: PDP 相關商品修正
`src/app/(frontend)/products/[slug]/page.tsx:87` 改用 Task A 的 `getRelated(product.id)`：
```tsx
const related = await getRelated(product.id, 4)
```
以及「也買了」：
```tsx
const alsoBought = await getAlsoBought(product.id, 4)
```

### Task C: UGC Gallery 接真資料
讀 `src/collections/UGCPosts.ts` 看欄位（photo, caption, user, product, status='approved' 等）。

`src/app/(frontend)/page.tsx` 首頁：
- 拿掉目前的 `ugcTaggedProducts`（從新品/熱銷 derive）
- 改為：
```ts
const ugc = await payload.find({
  collection: 'ugc-posts',
  where: { status: { equals: 'approved' } },
  sort: '-createdAt',
  limit: 12,
  depth: 2,
})
```
- 傳給 `<UGCGallery posts={ugc.docs} />`；UGCGallery.tsx 改 props 型別吃 UGCPost[]

若當前 DB 沒 UGC approved 筆數 > 0 → 加 seed 條件：若 fetch 結果空，**退回舊 derive 並 console.warn**（不要空 grid），seed 補 4-6 筆 demo UGC 進 `src/seed/seedUGC.ts`（新檔）。

### Task D: 首頁 personalized recommendation section
首頁 `src/app/(frontend)/page.tsx` 加 `<PersonalizedSection products={...}/>`：
- 若登入：用 `getPersonalized(user.id)`
- Guest：熱銷 top
- 標題會根據身份切換：「根據你的喜好」/「熱門推薦」

### Task E: 驗證 + push
```
pnpm tsc --noEmit
PAYLOAD_SECRET=dummy DATABASE_URI=file:./data/chickimmiu.db pnpm build
pnpm dev -p 3002
# 瀏覽 /、/products/<any-slug> → 應看到不是空的 related + alsoBought + UGC grid
# 檢查 network 請求：getRelated/getAlsoBought 不應超過 200ms
```

commit：
```
git checkout -b feat/real-recommendations
git add src/lib/recommendationEngine.ts src/app/\(frontend\)/products/\[slug\]/page.tsx src/app/\(frontend\)/page.tsx src/components/ src/seed/seedUGC.ts
git commit -m "$(cat <<'EOF'
feat(reco): real Payload-backed recommendations + UGC gallery

- recommendationEngine: getRelated (same category), getAlsoBought (Order co-occurrence),
  getPersonalized (tier + category-based for logged-in, bestseller for guest)
- PDP /products/[slug] uses real getRelated + getAlsoBought
- Home UGCGallery reads ugc-posts where status=approved
- seedUGC.ts for dev testing
- Replaces empty PRODUCT_POOL stub (was returning [] everywhere)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/real-recommendations
```

## Prod Deploy
```
cd /var/www/chickimmiu && git pull && pnpm install --frozen-lockfile && pnpm build && pm2 restart chickimmiu-nextjs
# 首頁 / PDP reload，看到推薦有東西
```
若 prod UGC 是空的，使用者在 /admin 手動加 6 筆 approved UGC 即可。

## Guardrails
- 不碰：`src/seed/queryDB.ts` `src/seed/resetAdmin.ts`（組 01）、`src/app/(frontend)/account/**`（組 02）、`src/collections/Orders.ts` `src/stores/cartStore.ts`（組 03）、`src/app/(frontend)/{contact,size-guide,shipping,returns}/`（組 04）、`next.config.mjs` headers（組 07）
- `seedUGC.ts` 是新檔可以加
- 不用 force push
- 若 `alsoBought` 資料太稀（Order < 20 筆）fallback getRelated 是合理的；**不要**因此直接 hardcode
```

---
