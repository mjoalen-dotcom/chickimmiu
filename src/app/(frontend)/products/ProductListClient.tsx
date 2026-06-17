'use client'

import { useState, useMemo, useEffect, useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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

type ColorOption = { name: string; code: string }

interface Props {
  /** 當前頁的商品（server 已分頁/篩選/排序） */
  products: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  /** filter chip 用的全站可選色 / 尺寸（server 聚合） */
  colorOptions: ColorOption[]
  sizeOptions: string[]
  totalDocs: number
  totalPages: number
  currentPage: number
  pageSize: number
  pageSizeOptions: number[]
  // 目前的篩選狀態（從 URL 還原）
  activeTag: string
  activeCategory: string
  sortBy: string
  minPrice: number
  maxPrice: number
  selectedColors: string[]
  selectedSizes: string[]
  maxPriceCap: number
  showSizeFilter: boolean
}

// Canonical size display order for the filter chips
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', 'F', 'FREE', '均碼']

function getTagOptions(t: (key: string) => string) {
  return [
    { value: '', label: t('tagAll') },
    { value: 'new', label: t('tagNew') },
    { value: 'hot', label: t('tagHot') },
    { value: 'sale', label: t('tagSale') },
    { value: 'korean-celebrity', label: t('tagKoreanCelebrity') },
    { value: 'jin-style', label: t('tagJinStyle') },
  ]
}

function getSortOptions(t: (key: string) => string) {
  return [
    { value: 'newest', label: t('sortNewest') },
    { value: 'price-asc', label: t('sortPriceAsc') },
    { value: 'price-desc', label: t('sortPriceDesc') },
    { value: 'popular', label: t('sortPopular') },
  ]
}

export function ProductListClient({
  products,
  categories,
  colorOptions,
  sizeOptions,
  totalDocs,
  totalPages,
  currentPage,
  pageSize,
  pageSizeOptions = [12, 24, 48],
  activeTag,
  activeCategory,
  sortBy,
  minPrice,
  maxPrice,
  selectedColors,
  selectedSizes,
  maxPriceCap = 10000,
  showSizeFilter = true,
}: Props) {
  const t = useTranslations('products')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const TAG_OPTIONS = getTagOptions(t)
  const SORT_OPTIONS = getSortOptions(t)

  const [showFilters, setShowFilters] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<QuickViewProduct | null>(null)
  // 價格輸入用 local state，避免每打一個字就導航；blur / Enter 才套用
  const [priceMin, setPriceMin] = useState(minPrice)
  const [priceMax, setPriceMax] = useState(maxPrice)
  useEffect(() => setPriceMin(minPrice), [minPrice])
  useEffect(() => setPriceMax(maxPrice), [maxPrice])

  /** 合併更新 URL search params；改篩選預設回第 1 頁。 */
  const updateParams = useCallback(
    (updates: Record<string, string | number | string[] | null>, opts?: { scrollTop?: boolean }) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (!('page' in updates)) sp.delete('page')
      for (const [k, v] of Object.entries(updates)) {
        const empty =
          v == null ||
          v === '' ||
          (Array.isArray(v) && v.length === 0) ||
          (k === 'page' && Number(v) <= 1)
        if (empty) sp.delete(k)
        else sp.set(k, Array.isArray(v) ? v.join(',') : String(v))
      }
      const qs = sp.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
      if (opts?.scrollTop && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [router, pathname, searchParams],
  )

  // Build hierarchical category tree
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
    topLevel.sort((a, b) => {
      const so_a = a.sortOrder ?? Infinity
      const so_b = b.sortOrder ?? Infinity
      if (so_a !== so_b) return so_a - so_b
      return String(a.name).localeCompare(String(b.name))
    })
    return { topLevel, childrenMap }
  }, [categories])

  // 尺寸選項依 canonical order 排序（顯示大寫，值用原始 DB 字串）
  const sizeChips = useMemo(() => {
    return [...sizeOptions]
      .map((raw) => ({ raw, label: raw.toUpperCase() }))
      .sort((a, b) => {
        const ia = SIZE_ORDER.indexOf(a.label)
        const ib = SIZE_ORDER.indexOf(b.label)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
        return a.label.localeCompare(b.label)
      })
  }, [sizeOptions])

  const toggleColor = (name: string) => {
    const next = selectedColors.includes(name)
      ? selectedColors.filter((c) => c !== name)
      : [...selectedColors, name]
    updateParams({ colors: next })
  }

  const toggleSize = (raw: string) => {
    const next = selectedSizes.includes(raw)
      ? selectedSizes.filter((s) => s !== raw)
      : [...selectedSizes, raw]
    updateParams({ sizes: next })
  }

  const applyPrice = () => {
    updateParams({
      minPrice: priceMin > 0 ? priceMin : null,
      maxPrice: priceMax < maxPriceCap ? priceMax : null,
    })
  }

  const clearFilters = () => {
    startTransition(() => {
      router.push(pathname, { scroll: false })
    })
  }

  const hasActiveFilters =
    activeTag ||
    activeCategory ||
    selectedColors.length > 0 ||
    selectedSizes.length > 0 ||
    minPrice > 0 ||
    maxPrice < maxPriceCap

  const start = totalDocs === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalDocs)

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-12">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">{t('eyebrow')}</p>
          <h1 className="text-2xl md:text-3xl font-serif">{t('title')}</h1>
        </div>
      </div>

      <div className="container py-6 md:py-10">
        {/* Tag tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {TAG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParams({ tag: opt.value || null })}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeTag === opt.value
                  ? 'bg-foreground text-cream-50'
                  : 'bg-white border border-cream-200 text-foreground/70 hover:border-gold-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Category Navigation (always visible) ── */}
        <div className="bg-white rounded-2xl border border-cream-200 p-4 md:p-5 mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
            {t('categoryHeading')}
          </p>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => updateParams({ category: null })}
              className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
                !activeCategory
                  ? 'bg-gold-500 text-white border-gold-500'
                  : 'bg-cream-50 border-cream-200 text-foreground/70 hover:border-gold-400 hover:text-foreground'
              }`}
            >
              {t('categoryAll')}
            </button>
            {categoryTree.topLevel.map((parent) => {
              const children = categoryTree.childrenMap.get(String(parent.id)) || []
              const isParentActive = activeCategory === String(parent.id)
              const isChildActive = children.some((c) => String(c.id) === activeCategory)
              return (
                <button
                  key={String(parent.id)}
                  onClick={() => updateParams({ category: String(parent.id) })}
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

          {/* Subcategories — show when a parent with children is active */}
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
                  onClick={() => updateParams({ category: String(activeParentId.id) })}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors border ${
                    activeCategory === String(activeParentId.id)
                      ? 'bg-foreground/10 border-foreground/20 text-foreground font-medium'
                      : 'bg-cream-50 border-cream-100 text-foreground/60 hover:text-foreground'
                  }`}
                >
                  {t('categoryAllPrefix')}
                  {activeParentId.name}
                </button>
                {children.map((child) => (
                  <button
                    key={String(child.id)}
                    onClick={() => updateParams({ category: String(child.id) })}
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
              {t('moreFilters')}
              {(selectedColors.length > 0 || minPrice > 0 || maxPrice < maxPriceCap) && (
                <span className="w-2 h-2 rounded-full bg-gold-500" />
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
                {t('clearFilters')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {isPending && <Loader2 size={12} className="inline animate-spin mr-1" />}
              {totalDocs} {t('itemsCountSuffix')}
              {totalPages > 1 && ` · ${currentPage}/${totalPages}`}
            </span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => updateParams({ sort: e.target.value === 'newest' ? null : e.target.value })}
                className="appearance-none pl-3 pr-8 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
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

        {/* Additional filters panel (colors, price, size) */}
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
                  {colorOptions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
                        {t('filterColor')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {colorOptions.map((c) => (
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
                      {t('filterPriceRange')}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={priceMin || ''}
                        onChange={(e) => setPriceMin(Number(e.target.value))}
                        onBlur={applyPrice}
                        onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
                        placeholder="NT$ 0"
                        className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                      <span className="text-muted-foreground text-xs">—</span>
                      <input
                        type="number"
                        value={priceMax < maxPriceCap ? priceMax : ''}
                        onChange={(e) => setPriceMax(Number(e.target.value) || maxPriceCap)}
                        onBlur={applyPrice}
                        onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
                        placeholder={`NT$ ${maxPriceCap.toLocaleString()}`}
                        className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                  </div>

                  {/* Size filter */}
                  {showSizeFilter && sizeChips.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
                        {t('filterSize')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sizeChips.map((s) => (
                          <button
                            key={s.raw}
                            onClick={() => toggleSize(s.raw)}
                            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                              selectedSizes.includes(s.raw)
                                ? 'bg-foreground text-cream-50 border-foreground'
                                : 'border-cream-200 text-foreground/70 hover:border-gold-400 hover:text-foreground'
                            }`}
                          >
                            {s.label}
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
        {products.length > 0 ? (
          <div
            className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 transition-opacity ${
              isPending ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {products.map((p) => {
              const images = p.images as { image?: { url?: string; alt?: string } }[] | undefined
              const firstImage = images?.[0]?.image
              const variants = p.variants as
                | {
                    colorName: string
                    colorCode?: string
                    size: string
                    sku: string
                    stock: number
                    priceOverride?: number
                  }[]
                | undefined
              const colors = variants
                ? [
                    ...new Map(
                      variants.map((v) => [
                        v.colorName,
                        { name: v.colorName, code: v.colorCode || '#ccc' },
                      ]),
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
                    firstImage
                      ? { url: normalizeMediaUrl(firstImage.url) || '', alt: firstImage.alt }
                      : null
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
            <p className="text-muted-foreground mb-2">{t('noResultsTitle')}</p>
            <button onClick={clearFilters} className="text-sm text-gold-600 hover:underline">
              {t('noResultsClear')}
            </button>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalDocs > 0 && (
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Per-page selector */}
            {pageSizeOptions.length > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>每頁</span>
                <div className="relative">
                  <select
                    value={pageSize}
                    onChange={(e) => updateParams({ pageSize: Number(e.target.value) })}
                    className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-cream-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 cursor-pointer"
                  >
                    {pageSizeOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>
                <span>件</span>
              </div>
            )}

            {/* Page nav */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateParams({ page: currentPage - 1 }, { scrollTop: true })}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-cream-200 disabled:opacity-30 hover:border-gold-400 transition-colors"
                  aria-label="上一頁"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 2)
                  .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                    if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(n)
                    return acc
                  }, [])
                  .map((n, i) =>
                    n === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => updateParams({ page: n as number }, { scrollTop: true })}
                        className={`min-w-[36px] h-9 px-2 rounded-lg border text-sm transition-colors ${
                          currentPage === n
                            ? 'bg-foreground text-cream-50 border-foreground'
                            : 'border-cream-200 hover:border-gold-400'
                        }`}
                      >
                        {n}
                      </button>
                    ),
                  )}

                <button
                  onClick={() => updateParams({ page: currentPage + 1 }, { scrollTop: true })}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-cream-200 disabled:opacity-30 hover:border-gold-400 transition-colors"
                  aria-label="下一頁"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <span className="text-xs text-muted-foreground">
              {start}–{end} / {totalDocs} {t('itemsCountSuffix')}
            </span>
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
