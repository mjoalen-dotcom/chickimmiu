# Wave 1 PR-ε — `/category/[slug]` route

**Branch**: `claude/wave1-category-route`
**Date**: 2026-05-06
**Wave**: 1（與 α/β/γ/δ/ζ/θ/ι 平行）

---

## Background

[Categories.ts:72](../../../src/collections/Categories.ts) slug 欄位描述寫「用於 URL，例如 /category/dresses」，但 **route 不存在**。Categories 在前台目前只能透過 PLP 的 `?category=ID` query 觸發，URL 不友善、不能分享、SEO 弱。

---

## Goal

新建 `/category/[slug]` server-rendered route：
- 接 Categories.slug 直查
- 列該分類（含子分類）所有 published products
- 支援 `?page=N&sort=...` query
- 加上 hero（用 Categories.image + name + description）
- BreadcrumbJsonLd

**獨立 client 元件，不共用 ProductListClient**（避免 Wave 1/2 衝突）。

---

## Files

### Create
- `src/app/(frontend)/category/[slug]/page.tsx` — server component
- `src/app/(frontend)/category/[slug]/CategoryPLPClient.tsx` — 'use client'，純 grid + 分頁 + 排序
- 重用既有 `@/components/product/ProductCard`、`@/components/seo/JsonLd`

### Do NOT touch
- `src/app/(frontend)/products/**`
- `src/app/(frontend)/collections/**`
- `Categories.ts`（γ 動 endpoints，這 PR 完全不動）

---

## Implementation skeleton

```tsx
// src/app/(frontend)/category/[slug]/page.tsx
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { CategoryPLPClient } from './CategoryPLPClient'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { normalizeMediaUrl } from '@/lib/media-url'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PAGE_SIZE = 24  // Wave 2 PR-κ 會改成讀 ProductListSettings.pageSize

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1, depth: 0,
    })
    const cat = docs[0]
    if (!cat) return { title: '分類不存在' }
    const seo = (cat as Record<string, unknown>).seo as Record<string, unknown> | undefined
    return {
      title: (seo?.metaTitle as string) || `${cat.name} | CHIC KIM & MIU`,
      description: (seo?.metaDescription as string) || (cat as { description?: string }).description,
    }
  } catch { return { title: slug } }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const page = Math.max(1, parseInt((sp.page as string) || '1', 10) || 1)
  const sort = (sp.sort as string) || '-createdAt'

  if (!process.env.DATABASE_URI) notFound()

  const payload = await getPayload({ config })

  // 找 category
  const catRes = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug }, isActive: { not_equals: false } },
    limit: 1, depth: 0,
  })
  const category = catRes.docs[0] as Record<string, unknown> | undefined
  if (!category) notFound()

  // 找子分類，包進 family ids（含自己）
  const childRes = await payload.find({
    collection: 'categories',
    where: { parent: { equals: category.id } },
    limit: 100, depth: 0,
  })
  const familyIds = [category.id as number, ...childRes.docs.map((d) => d.id as number)]

  const where: Where = {
    category: { in: familyIds },
    status: { equals: 'published' },
  }

  const result = await payload.find({
    collection: 'products',
    where,
    sort,
    limit: PAGE_SIZE,
    page,
    depth: 2,
  })

  // 找上層分類（breadcrumb）
  let parent: Record<string, unknown> | null = null
  const parentId = category.parent
  if (parentId) {
    const parentRes = await payload.find({
      collection: 'categories',
      where: { id: { equals: typeof parentId === 'object' ? (parentId as { id: number }).id : parentId } },
      limit: 1, depth: 0,
    })
    parent = parentRes.docs[0] as Record<string, unknown> | null
  }

  const heroImg = normalizeMediaUrl(
    (category.image as { url?: string } | undefined)?.url,
  )

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: '首頁', href: '/' },
          { name: '全部商品', href: '/products' },
          ...(parent ? [{ name: parent.name as string, href: `/category/${parent.slug}` }] : []),
          { name: category.name as string, href: `/category/${slug}` },
        ]}
      />
      <main className="bg-cream-50 min-h-screen">
        <section className="relative bg-[#2C2C2C] py-12 md:py-20 overflow-hidden">
          {heroImg && (
            <Image src={heroImg} alt={category.name as string} fill unoptimized className="object-cover opacity-30" />
          )}
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <p className="text-[#C19A5B] text-sm tracking-[0.3em] uppercase mb-3">CATEGORY</p>
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-wider">
              {category.name as string}
            </h1>
            <div className="mt-4 w-12 h-[2px] bg-[#C19A5B] mx-auto" />
            {category.description && (
              <p className="mt-4 text-white/70 text-sm md:text-base max-w-lg mx-auto">
                {category.description as string}
              </p>
            )}
          </div>
        </section>

        <CategoryPLPClient
          products={result.docs as unknown as Record<string, unknown>[]}
          totalDocs={result.totalDocs}
          totalPages={result.totalPages}
          page={page}
          slug={slug}
          sort={sort}
        />
      </main>
    </>
  )
}
```

```tsx
// src/app/(frontend)/category/[slug]/CategoryPLPClient.tsx
'use client'
import { ProductCard } from '@/components/product/ProductCard'
import { normalizeMediaUrl } from '@/lib/media-url'
import Link from 'next/link'

interface Props {
  products: Record<string, unknown>[]
  totalDocs: number
  totalPages: number
  page: number
  slug: string
  sort: string
}

export function CategoryPLPClient({ products, totalDocs, totalPages, page, slug, sort }: Props) {
  return (
    <div className="container py-8 md:py-12">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">{totalDocs} 件商品</p>
        <form>
          <input type="hidden" name="page" value="1" />
          <select
            name="sort"
            defaultValue={sort}
            onChange={(e) => {
              const url = new URL(window.location.href)
              url.searchParams.set('sort', e.target.value)
              url.searchParams.set('page', '1')
              window.location.href = url.toString()
            }}
            className="px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm"
          >
            <option value="-createdAt">最新上架</option>
            <option value="price">價格：低到高</option>
            <option value="-price">價格：高到低</option>
          </select>
        </form>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">此分類目前沒有商品</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => {
            const images = p.images as { image?: { url?: string; alt?: string } }[] | undefined
            const firstImage = images?.[0]?.image
            return (
              <ProductCard
                key={p.id as unknown as string}
                id={p.id as unknown as string}
                slug={p.slug as string}
                name={p.name as string}
                price={p.price as number}
                salePrice={p.salePrice as number | undefined}
                image={firstImage ? { url: normalizeMediaUrl(firstImage.url) || '', alt: firstImage.alt } : null}
                isNew={p.isNew as boolean | undefined}
                isHot={p.isHot as boolean | undefined}
              />
            )
          })}
        </div>
      )}

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 10).map((n) => (
            <Link
              key={n}
              href={`/category/${slug}?page=${n}&sort=${sort}`}
              className={`w-10 h-10 flex items-center justify-center rounded-full text-sm ${
                n === page ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200 hover:border-gold-400'
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Acceptance

- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 清
- [ ] `/category/dresses`（或任一存在的 slug）200 + 顯示該分類產品
- [ ] `?page=2` 有效
- [ ] `?sort=-price` 有效
- [ ] 不存在的 slug 404
- [ ] `/category/<parent>` 列出含子分類所有商品
- [ ] BreadcrumbJsonLd output 含 parent → child 鏈

## Out of scope（Wave 2 PR-κ 會做）

- 不接 ProductListSettings.pageSize（這 PR 寫死 24）
- 不接 size/color filter
- 不取代 `/products` PLP
