'use client'

import { useState, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductQuickView, type QuickViewProduct } from '@/components/product/ProductQuickView'
import { normalizeMediaUrl } from '@/lib/media-url'

interface CategoryItem {
  id: string | number
  name: string
  slug: string
  sortOrder?: number | null
  parent?: string | number | { id: string | number; name?: string } | null
}

interface Props {
  initialProducts: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  initialTag?: string
  initialCategory?: string
  sort: string
  page: number
  totalPages: number
  totalDocs: number
  showSizeFilter: boolean
  plsTitle: string
  plsOverline: string
}

const TAG_KEYS = ['', 'new', 'hot', 'sale', 'korean-celebrity', 'jin-style'] as const
const SORT_KEYS = ['newest', 'price-asc', 'price-desc', 'popular'] as const
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free']

export function ProductListClient({
  initialProducts,
  categories,
  initialTag,
  initialCategory,
  sort,
  page,
  totalPages,
  totalDocs,
  showSizeFilter,
  plsTitle,
  plsOverline,
}: Props) {
  const t = useTranslations('productList')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<QuickViewProduct | null>(null)

  const activeTag = initialTag || ''
  const activeCategory = initialCategory || ''

  // Build URL helper — preserves unrelated params
  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === '') {
        p.delete(k)
      } else {
        p.set(k, v)
      }
    }
    // always reset page when filter/sort changes (unless page is the key being set)
    if (!('page' in overrides)) p.delete('page')
    const qs = p.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  // Category tree — server already sorted by sortOrder, keep that order
  const categoryTree = useMemo(() => {
    const cats = categories as unknown as CategoryItem[]
    const topLevel: CategoryItem[] = []
    const childrenMap = new Map<string | number, CategoryItem[]>()

    for (const cat of cats) {
      const parentId = cat.parent
        ? typeof cat.parent === 'object'
          ? cat.parent.id
          : cat.parent
        : null
      if (!parentId) {
        topLevel.push(cat)
      } else {
        const key = String(parentId)
        if (!childrenMap.has(key)) childrenMap.set(key, [])
        childrenMap.get(key)!.push(cat)
      }
    }
    // server sorted by sortOrder — preserve order for children too
    return { topLevel, childrenMap }
  }, [categories])

  // Get category family (parent + all children) for filtering
  const getCategoryFamily = useMemo(() => {
    return (catId: string) => {
      const children = categoryTree.childrenMap.get(catId) || []
      return [catId, ...children.map((c) => String(c.id))]
    }
  }, [categoryTree])

  // Extract unique colors from loaded products
  const allColors = useMemo(() => {
    const colorMap = new Map<string, string>()
    initialProducts.forEach((p) => {
      const variants = p.variants as { colorName: string; colorCode?: string }[] | undefined
      variants?.forEach((v) => {
        if (v.colorCode) colorMap.set(v.colorName, v.colorCode)
      })
    })
    return [...colorMap.entries()].map(([name, code]) => ({ name, code }))
  }, [initialProducts])

  // Client-side filters (price / color / size) applied on top of server results
  const filtered = useMemo(() => {
    let list = [...initialProducts]

    // Category filter (client-side handles children of selected parent)
    if (activeCategory) {
      const familyIds = getCategoryFamily(activeCategory)
      list = list.filter((p) => {
        const cat = p.category as unknown as Record<string, unknown> | string | number | undefined
        if (!cat) return false
        const catId = typeof cat === 'object' ? String(cat.id) : String(cat)
        return familyIds.includes(catId)
      })
    }

    // Price range
    list = list.filter((p) => {
      const price = ((p.salePrice as number) || (p.price as number)) ?? 0
      return price >= priceRange[0] && price <= priceRange[1]
    })

    // Color
    if (selectedColors.length > 0) {
      list = list.filter((p) => {
        const variants = p.variants as { colorName: string }[] | undefined
        return variants?.some((v) => selectedColors.includes(v.colorName))
      })
    }

    // Size
    if (selectedSizes.length > 0) {
      list = list.filter((p) => {
        const variants = p.variants as { size?: string }[] | undefined
        return variants?.some((v) => v.size && selectedSizes.includes(v.size))
      })
    }

    return list
  }, [initialProducts, activeCategory, priceRange, selectedColors, selectedSizes, getCategoryFamily])

  const toggleColor = (name: string) =>
    setSelectedColors((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))

  const toggleSize = (s: string) =>
    setSelectedSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const clearClientFilters = () => {
    setPriceRange([0, 10000])
    setSelectedColors([])
    setSelectedSizes([])
  }

  const hasClientFilters =
    selectedColors.length > 0 || selectedSizes.length > 0 || priceRange[0] > 0 || priceRange[1] < 10000

  const hasAnyFilters = activeTag || activeCategory || hasClientFilters

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-12">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">{plsOverline}</p>
          <h1 className="text-2xl md:text-3xl font-serif">{plsTitle}</h1>
        </div>
      </div>

      <div className="container py-6 md:py-10">
        {/* Tag tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {TAG_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => router.push(buildUrl({ tag: key || undefined }))}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeTag === key
                  ? 'bg-foreground text-cream-50'
                  : 'bg-white border border-cream-200 text-foreground/70 hover:border-gold-400'
              }`}
            >
              {t(`tags.${key === '' ? 'all' : key === 'korean-celebrity' ? 'koreanCelebrity' : key === 'jin-style' ? 'jinStyle' : key}`)}
            </button>
          ))}
        </div>

        {/* Category Navigation */}
        <div className="bg-white rounded-2xl border border-cream-200 p-4 md:p-5 mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
            {t('categoryNav.label')}
          </p>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => router.push(buildUrl({ category: undefined }))}
              className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
                !activeCategory
                  ? 'bg-gold-500 text-white border-gold-500'
                  : 'bg-cream-50 border-cream-200 text-foreground/70 hover:border-gold-400 hover:text-foreground'
              }`}
            >
              {t('categoryNav.all')}
            </button>
            {categoryTree.topLevel.map((parent) => {
              const children = categoryTree.childrenMap.get(String(parent.id)) || []
              const isParentActive = activeCategory === String(parent.id)
              const isChildActive = children.some((c) => String(c.id) === activeCategory)

              return (
                <button
                  key={String(parent.id)}
                  onClick={() => router.push(buildUrl({ category: String(parent.id) }))}
                  className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
                    isParentActive || isChildActive
                      ? 'bg-gold-500 text-white border-gold-500'
                      : 'bg-cream-50 border-cream-200 text-foreground/70 hover:border-gold-400 hover:text-foreground'
                  }`}
                >
                  {parent.name}
                </button>
              )
            })}
          </div>

          {/* Subcategories */}
          {(() => {
            const activeParentId = categoryTree.topLevel.find((p) => {
              if (String(p.id) === activeCategory) return true
              const kids = categoryTree.childrenMap.get(String(p.id)) || []
              return kids.some((c) => String(c.id) === activeCategory)
            })
            if (!activeParentId) return null
            const children = categoryTree.childrenMap.get(String(activeParentId.id)) || []
            if (children.length === 0) return null

            return (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center gap-2 mt-3 pt-3 border-t border-cream-100 overflow-x-auto scrollbar-hide"
              >
                <button
                  onClick={() => router.push(buildUrl({ category: String(activeParentId.id) }))}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors border ${
                    activeCategory === String(activeParentId.id)
                      ? 'bg-foreground/10 border-foreground/20 text-foreground font-medium'
                      : 'bg-cream-50 border-cream-100 text-foreground/60 hover:text-foreground'
                  }`}
                >
                  {t('categoryNav.allOf', { name: activeParentId.name })}
                </button>
                {children.map((child) => (
                  <button
                    key={String(child.id)}
                    onClick={() => router.push(buildUrl({ category: String(child.id) }))}
                    className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors border ${
                      activeCategory === String(child.id)
                        ? 'bg-foreground/10 border-foreground/20 text-foreground font-medium'
                        : 'bg-cream-50 border-cream-100 text-foreground/60 hover:text-foreground'
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </motion.div>
            )
          })()}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-cream-200 rounded-xl text-sm hover:border-gold-400 transition-colors"
            >
              <SlidersHorizontal size={16} />
              {t('filters.more')}
              {hasClientFilters && <span className="w-2 h-2 rounded-full bg-gold-500" />}
            </button>
            {hasAnyFilters && (
              <button
                onClick={() => {
                  clearClientFilters()
                  router.push(pathname)
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
                {t('filters.clear')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {t('count', { n: totalDocs })}
            </span>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => router.push(buildUrl({ sort: e.target.value }))}
                className="appearance-none pl-3 pr-8 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 cursor-pointer"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`sort.${key === 'price-asc' ? 'priceAsc' : key === 'price-desc' ? 'priceDesc' : key}`)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Additional filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Colors */}
                  {allColors.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
                        {t('filters.color')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {allColors.map((c) => (
                          <button
                            key={c.name}
                            onClick={() => toggleColor(c.name)}
                            className={`w-7 h-7 rounded-full border-2 transition-all ${
                              selectedColors.includes(c.name)
                                ? 'border-gold-500 ring-2 ring-gold-500/30 scale-110'
                                : 'border-cream-200'
                            }`}
                            style={{ backgroundColor: c.code }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price range */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
                      {t('filters.priceRange')}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={priceRange[0]}
                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                        placeholder={t('filters.minPlaceholder')}
                        className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                      <span className="text-muted-foreground text-xs">—</span>
                      <input
                        type="number"
                        value={priceRange[1]}
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                        placeholder={t('filters.maxPlaceholder')}
                        className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                  </div>

                  {/* Size filter */}
                  {showSizeFilter && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
                        {t('filters.size')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SIZES.map((s) => (
                          <button
                            key={s}
                            onClick={() => toggleSize(s)}
                            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                              selectedSizes.includes(s)
                                ? 'border-gold-500 bg-gold-50 text-gold-700 font-medium'
                                : 'border-cream-200 text-foreground/70 hover:border-gold-400'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filtered.map((p) => {
              const images = p.images as { image?: { url?: string; alt?: string } }[] | undefined
              const firstImage = images?.[0]?.image
              const variants = p.variants as {
                colorName: string
                colorCode?: string
                size: string
                sku: string
                stock: number
                priceOverride?: number
              }[] | undefined
              const colors = variants
                ? [
                    ...new Map(
                      variants.map((v) => [v.colorName, { name: v.colorName, code: v.colorCode || '#ccc' }]),
                    ).values(),
                  ]
                : undefined

              return (
                <ProductCard
                  key={p.id as unknown as string}
                  id={p.id as unknown as string}
                  slug={p.slug as string}
                  name={p.name as string}
                  price={p.price as number}
                  salePrice={p.salePrice as number | undefined}
                  image={
                    firstImage ? { url: normalizeMediaUrl(firstImage.url) || '', alt: firstImage.alt } : null
                  }
                  colors={colors}
                  isNew={p.isNew as boolean | undefined}
                  isHot={p.isHot as boolean | undefined}
                  onQuickView={() =>
                    setQuickViewProduct({
                      id: p.id as unknown as string,
                      slug: p.slug as string,
                      name: p.name as string,
                      price: p.price as number,
                      salePrice: p.salePrice as number | undefined,
                      images: images
                        ?.map((img) =>
                          img.image?.url
                            ? { url: normalizeMediaUrl(img.image.url) || '', alt: img.image.alt }
                            : null,
                        )
                        .filter(Boolean) as { url: string; alt?: string }[],
                      variants,
                    })
                  }
                />
              )
            })}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-muted-foreground mb-2">{t('empty.title')}</p>
            <button
              onClick={() => {
                clearClientFilters()
                router.push(pathname)
              }}
              className="text-sm text-gold-600 hover:underline"
            >
              {t('empty.cta')}
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => router.push(buildUrl({ page: String(page - 1) }))}
              disabled={page <= 1}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-cream-200 hover:border-gold-400 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={t('pagination.previous')}
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => router.push(buildUrl({ page: String(n) }))}
                className={`w-10 h-10 flex items-center justify-center rounded-full text-sm ${
                  n === page
                    ? 'bg-foreground text-cream-50'
                    : 'bg-white border border-cream-200 hover:border-gold-400'
                }`}
              >
                {n}
              </button>
            ))}

            <button
              onClick={() => router.push(buildUrl({ page: String(page + 1) }))}
              disabled={page >= totalPages}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-cream-200 hover:border-gold-400 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={t('pagination.next')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <ProductQuickView
        product={quickViewProduct}
        open={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </main>
  )
}
