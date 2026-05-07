/**
 * Storefront smoke test — PR-θ (Wave 1)
 *
 * Usage:
 *   pnpm smoke:storefront                          # 本機 dev server (port 3006)
 *   BASE_URL=https://pre.chickimmiu.com pnpm smoke:storefront
 *   FAIL_FAST=1 pnpm smoke:storefront              # 第一個 fail 立刻退出
 */
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = process.env.BASE_URL || 'http://localhost:3006'
const TIMEOUT_MS = 15_000
const FAIL_FAST = process.env.FAIL_FAST === '1'

type Case = {
  name: string
  path: string
  expectStatus: number
  expectBodyIncludes?: string
  optional?: boolean
}

const t = (s: string) => `[${new Date().toISOString().slice(11, 19)}] ${s}`

async function fetchWithTimeout(url: string): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'manual' })
    const body = await r.text()
    return { status: r.status, body }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchProductSlugs(): Promise<string[]> {
  try {
    const { body } = await fetchWithTimeout(`${BASE}/api/products?limit=10&depth=0`)
    const j = JSON.parse(body) as { docs?: { slug: string }[] }
    return (j.docs || []).map((d) => d.slug).filter(Boolean)
  } catch {
    return []
  }
}

async function fetchCategorySlugs(): Promise<string[]> {
  try {
    const { body } = await fetchWithTimeout(
      `${BASE}/api/categories?limit=5&where[isActive][not_equals]=false&depth=0`,
    )
    const j = JSON.parse(body) as { docs?: { slug: string }[] }
    return (j.docs || []).map((d) => d.slug).filter(Boolean)
  } catch {
    return []
  }
}

async function buildCases(): Promise<Case[]> {
  const [productSlugs, categorySlugs] = await Promise.all([
    fetchProductSlugs(),
    fetchCategorySlugs(),
  ])

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
    { name: '404 pdp', path: '/products/definitely-does-not-exist-xyz', expectStatus: 404 },
  ]

  productSlugs.forEach((slug) =>
    cases.push({
      name: `pdp ${slug.slice(0, 30)}`,
      path: `/products/${encodeURIComponent(slug)}`,
      expectStatus: 200,
    }),
  )

  categorySlugs.forEach((slug) =>
    cases.push({
      name: `category ${slug}`,
      path: `/category/${slug}`,
      expectStatus: 200,
      optional: true,
    }),
  )

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

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
