# Wave 1 PR-θ — Storefront smoke test script

**Branch**: `claude/wave1-smoke-storefront`
**Date**: 2026-05-06
**Wave**: 1（與 α/β/γ/δ/ε/ζ/ι 平行）

---

## Background

封測公開營運前要有自動化 smoke：抽樣 N 個 PDP / PLP / category / collection 路徑，驗證 200 OK + 內容對得上。每次 prod deploy 後可自動跑。

---

## Goal

新增 `scripts/smoke-storefront.ts`，吃 base URL（預設 `http://localhost:3006`）跑 ~30 個 case，回 pass/fail report；CI / 手動皆可。

---

## Files

### Create
- `scripts/smoke-storefront.ts`
- `scripts/README.md`（如果不存在；如果存在加一節）— 加入 npm script 說明

### Edit
- `package.json` — 加 1 行 `"smoke:storefront": "node --import tsx scripts/smoke-storefront.ts"`

### Do NOT touch
- 任何 src/、collection、page

---

## Spec — 30 case 抽樣

| 類別 | URL | 預期 |
|---|---|---|
| Home | `/` | 200 + body 含 `<main` |
| PLP | `/products` | 200 + 含「件商品」字 |
| PLP filter | `/products?tag=new` | 200 |
| PLP filter | `/products?tag=hot` | 200 |
| PLP filter | `/products?tag=sale` | 200 |
| PLP filter | `/products?tag=korean-celebrity` | 200 |
| PLP cat | `/products?category=<隨機 active category id>` | 200 |
| PDP | 對 `/api/products?limit=10&depth=0` 回的前 10 個 slug 各跑一次 | 200 + 含 product name |
| Category | `/category/<slug>` 對 categories 前 5 個 active slug | 200（需 PR-ε merge） |
| Collections | `/collections` | 200 |
| Collection detail | `/collections/jin-live` | 200 |
| Cart | `/cart` | 200 |
| Auth-gated | `/account` | 200 (login redirect) 或 unauth response |
| Login | `/login` | 200 |
| Register | `/register` | 200 |
| 404 | `/products/definitely-does-not-exist-xyz` | 404 |

---

## Implementation skeleton

```ts
// scripts/smoke-storefront.ts
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = process.env.BASE_URL || 'http://localhost:3006'
const TIMEOUT_MS = 15_000
const FAIL_FAST = process.env.FAIL_FAST === '1'

type Case = {
  name: string
  path: string
  expectStatus: number
  expectBodyIncludes?: string
  optional?: boolean  // 若 PR-ε 未 merge，category 路徑 optional
}

const t = (s: string) => `[${new Date().toISOString().slice(11, 19)}] ${s}`

async function fetchWithTimeout(url: string): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'manual' })
    const body = await r.text()
    return { status: r.status, body }
  } finally { clearTimeout(timer) }
}

async function fetchProductSlugs(): Promise<string[]> {
  try {
    const { body } = await fetchWithTimeout(`${BASE}/api/products?limit=10&depth=0`)
    const j = JSON.parse(body)
    return (j.docs || []).map((d: { slug: string }) => d.slug).filter(Boolean)
  } catch { return [] }
}

async function fetchCategorySlugs(): Promise<string[]> {
  try {
    const { body } = await fetchWithTimeout(`${BASE}/api/categories?limit=5&where[isActive][not_equals]=false&depth=0`)
    const j = JSON.parse(body)
    return (j.docs || []).map((d: { slug: string }) => d.slug).filter(Boolean)
  } catch { return [] }
}

async function buildCases(): Promise<Case[]> {
  const productSlugs = await fetchProductSlugs()
  const categorySlugs = await fetchCategorySlugs()
  const cases: Case[] = [
    { name: 'home', path: '/', expectStatus: 200, expectBodyIncludes: '<main' },
    { name: 'plp', path: '/products', expectStatus: 200, expectBodyIncludes: '件商品' },
    { name: 'plp tag=new', path: '/products?tag=new', expectStatus: 200 },
    { name: 'plp tag=hot', path: '/products?tag=hot', expectStatus: 200 },
    { name: 'plp tag=sale', path: '/products?tag=sale', expectStatus: 200 },
    { name: 'plp tag=korean-celebrity', path: '/products?tag=korean-celebrity', expectStatus: 200 },
    { name: 'collections', path: '/collections', expectStatus: 200 },
    { name: 'collection jin-live', path: '/collections/jin-live', expectStatus: 200 },
    { name: 'cart', path: '/cart', expectStatus: 200 },
    { name: 'login', path: '/login', expectStatus: 200 },
    { name: 'register', path: '/register', expectStatus: 200 },
    { name: '404', path: '/products/definitely-does-not-exist-xyz', expectStatus: 404 },
  ]
  productSlugs.forEach((slug) => cases.push({
    name: `pdp ${slug.slice(0, 30)}`,
    path: `/products/${encodeURIComponent(slug)}`,
    expectStatus: 200,
  }))
  categorySlugs.forEach((slug) => cases.push({
    name: `category ${slug}`,
    path: `/category/${slug}`,
    expectStatus: 200,
    optional: true, // PR-ε 未 merge 時 404 不算 fail
  }))
  return cases
}

async function main() {
  console.log(t(`smoke against ${BASE}`))
  const cases = await buildCases()
  console.log(t(`${cases.length} cases\n`))

  const results: Array<{ name: string; ok: boolean; status: number; reason?: string }> = []
  for (const c of cases) {
    try {
      const { status, body } = await fetchWithTimeout(`${BASE}${c.path}`)
      let ok = status === c.expectStatus
      let reason = ok ? undefined : `expected ${c.expectStatus}, got ${status}`
      if (ok && c.expectBodyIncludes && !body.includes(c.expectBodyIncludes)) {
        ok = false
        reason = `body missing "${c.expectBodyIncludes}"`
      }
      if (!ok && c.optional && status === 404) {
        // PR-ε 未 merge — 標 SKIP
        results.push({ name: c.name, ok: true, status, reason: 'optional, skipped' })
        console.log(`  ⊙ ${c.name} (optional, ${status})`)
        continue
      }
      results.push({ name: c.name, ok, status, reason })
      console.log(`  ${ok ? '✓' : '✗'} ${c.name} → ${status}${reason ? ` (${reason})` : ''}`)
      if (!ok && FAIL_FAST) break
      await sleep(50)
    } catch (e) {
      results.push({ name: c.name, ok: false, status: 0, reason: (e as Error).message })
      console.log(`  ✗ ${c.name} → ERR ${(e as Error).message}`)
      if (FAIL_FAST) break
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log(t(`\nresults: ${results.length - failed.length}/${results.length} pass`))
  if (failed.length > 0) {
    console.log('failed:')
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.reason}`))
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(2) })
```

---

## Acceptance

- [ ] `pnpm smoke:storefront` 在本機 dev server 跑 → 全 pass（含「現有 PLP/PDP/Home」）
- [ ] `BASE_URL=https://pre.chickimmiu.com pnpm smoke:storefront` → prod 跑通
- [ ] PR-ε 未 merge 時 `/category/*` 自動 skip 不算 fail
- [ ] `FAIL_FAST=1` env 第一個 fail 立刻退
- [ ] script 有 timeout 15s 防 hang
- [ ] README 補一節「How to run smoke」

## Out of scope

- 不做完整 e2e（沒登入、沒下單）— 那是 Playwright 的事
- 不接 CI（user 之後決定要不要進 GitHub Actions）
