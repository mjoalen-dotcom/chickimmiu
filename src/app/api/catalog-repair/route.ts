import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { safeRevalidate } from '@/lib/revalidate'

const FALLBACK_CATEGORY = {
  name: '未分類',
  slug: 'uncategorized',
  description: '系統 fallback 分類：用於沒有分類或分類關聯失效的商品。',
}

type CategoryLite = {
  id: number | string
  name?: string | null
  slug?: string | null
}

type ProductLite = {
  id: number | string
  name?: string | null
  slug?: string | null
  category?: unknown
  sourcing?: { sourceId?: string | null } | null
}

type PlannedUpdate = {
  id: number | string
  name: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  reasons: string[]
}

function relationId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return String(id)
  }
  return null
}

function normalizeSlug(value: string): string {
  return value.trim().replace(/^-+|-+$/g, '')
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'product'
  )
}

function slugSuffix(product: ProductLite): string {
  const sourceId = product.sourcing?.sourceId?.trim()
  if (sourceId) return sourceId.slice(-6).toLowerCase()
  return String(product.id)
}

function uniqueSlug(base: string, used: Set<string>, product: ProductLite): string {
  const cleanBase = slugify(base)
  const suffix = slugSuffix(product)
  let candidate = `${cleanBase}-${suffix}`
  let counter = 2

  while (used.has(candidate)) {
    candidate = `${cleanBase}-${suffix}-${counter}`
    counter += 1
  }

  used.add(candidate)
  return candidate
}

async function findAll<T>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: 'categories' | 'products',
): Promise<T[]> {
  const docs: T[] = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      collection,
      depth: 0,
      limit: 500,
      page,
    })

    docs.push(...(result.docs as T[]))
    hasNextPage = Boolean(result.hasNextPage)
    page += 1
  }

  return docs
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user || user.role !== 'admin') {
    return jsonError('需要管理員權限', 403)
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') !== '0'
  const dedupeSlugs =
    url.searchParams.get('dedupeSlugs') === '1' ||
    url.searchParams.get('dedupe-slug') === '1'
  const sampleLimit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get('sampleLimit') || 50) || 50),
  )

  const categories = await findAll<CategoryLite>(payload, 'categories')
  const categoryIds = new Set(categories.map((category) => String(category.id)))
  let fallbackCategory = categories.find((category) => category.slug === FALLBACK_CATEGORY.slug)
  fallbackCategory ||= categories.find((category) => category.name === FALLBACK_CATEGORY.name)

  let createdFallbackCategory = false
  if (!fallbackCategory && !dryRun) {
    fallbackCategory = (await payload.create({
      collection: 'categories',
      data: FALLBACK_CATEGORY,
    })) as CategoryLite
    categoryIds.add(String(fallbackCategory.id))
    createdFallbackCategory = true
  }

  const products = await findAll<ProductLite>(payload, 'products')
  const updates = new Map<string, PlannedUpdate>()

  function ensureUpdate(product: ProductLite): PlannedUpdate {
    const key = String(product.id)
    const existing = updates.get(key)
    if (existing) return existing

    const update: PlannedUpdate = {
      id: product.id,
      name: product.name || '',
      before: {},
      after: {},
      reasons: [],
    }
    updates.set(key, update)
    return update
  }

  for (const product of products) {
    const categoryId = relationId(product.category)
    if (!categoryId || !categoryIds.has(categoryId)) {
      const update = ensureUpdate(product)
      update.before.category = categoryId
      update.after.category = fallbackCategory?.id ?? null
      update.reasons.push(categoryId ? 'orphan-category' : 'missing-category')
    }
  }

  const usedSlugs = new Set<string>()
  const sortedProducts = [...products].sort((a, b) => Number(a.id) - Number(b.id))

  for (const product of sortedProducts) {
    const currentSlug = normalizeSlug(product.slug || '')
    if (!currentSlug) {
      const nextSlug = uniqueSlug(product.name || 'product', usedSlugs, product)
      const update = ensureUpdate(product)
      update.before.slug = product.slug || ''
      update.after.slug = nextSlug
      update.reasons.push('missing-slug')
      continue
    }

    if (!usedSlugs.has(currentSlug)) {
      usedSlugs.add(currentSlug)
      continue
    }

    if (dedupeSlugs) {
      const nextSlug = uniqueSlug(currentSlug, usedSlugs, product)
      const update = ensureUpdate(product)
      update.before.slug = currentSlug
      update.after.slug = nextSlug
      update.reasons.push('duplicate-slug')
    }
  }

  const plannedUpdates = Array.from(updates.values())
  const blockedCategoryFixes = plannedUpdates.filter(
    (update) => 'category' in update.after && !fallbackCategory,
  )

  if (!dryRun && blockedCategoryFixes.length > 0) {
    return jsonError('找不到 fallback 分類，且建立「未分類」失敗', 500)
  }

  let committed = 0
  const failures: { id: number | string; name: string; message: string }[] = []

  if (!dryRun) {
    for (const update of plannedUpdates) {
      const data: Record<string, unknown> = {}
      if ('category' in update.after) data.category = update.after.category
      if ('slug' in update.after) data.slug = update.after.slug

      if (Object.keys(data).length === 0) continue

      try {
        await payload.update({
          collection: 'products',
          id: update.id,
          data,
        })
        committed += 1
      } catch (err) {
        failures.push({
          id: update.id,
          name: update.name,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (committed > 0 || createdFallbackCategory) {
      safeRevalidate(['/', '/products'], ['products', 'categories'])
    }
  }

  const categoryFixes = plannedUpdates.filter((update) => 'category' in update.after)
  const slugFixes = plannedUpdates.filter((update) => 'slug' in update.after)

  return NextResponse.json({
    success: failures.length === 0,
    mode: dryRun ? 'dry-run' : 'commit',
    fallbackCategory: fallbackCategory
      ? {
          id: fallbackCategory.id,
          name: fallbackCategory.name,
          slug: fallbackCategory.slug,
          created: createdFallbackCategory,
        }
      : {
          ...FALLBACK_CATEGORY,
          id: null,
          willCreateOnCommit: true,
        },
    options: {
      dedupeSlugs,
      note:
        'dedupeSlugs=1 會改 PDP URL；上線後應補 aliasSlugs/301，避免舊商品網址斷掉。',
    },
    counts: {
      productsScanned: products.length,
      categoriesScanned: categories.length,
      plannedProductUpdates: plannedUpdates.length,
      categoryFixes: categoryFixes.length,
      slugFixes: slugFixes.length,
      committed,
      failures: failures.length,
    },
    samples: {
      updates: plannedUpdates.slice(0, sampleLimit),
      failures: failures.slice(0, sampleLimit),
    },
  })
}
