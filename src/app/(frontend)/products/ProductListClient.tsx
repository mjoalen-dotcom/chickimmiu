'use client'

import { useState, useMemo } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductQuickView, type QuickViewProduct } from '@/components/product/ProductQuickView'

interface CategoryItem {
  id: string | number
  name: string
  slug: string
  parent?: string | number | { id: string | number; name?: string } | null
}

interface Props {
  initialProducts: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  initialTag?: string
  initialCategory?: string
}

const TAG_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'new', label: '新品上市' },
  { value: 'hot', label: '熱銷推薦' },
  { value: 'sale', label: '限時優惠' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: '最新上架' },
  { value: 'price-asc', label: '價格：低到高' },
  { value: 'price-desc', label: '價格：高到低' },
  { value: 'popular', label: '人氣推薦' },
]

export function ProductListClient({
  initialProducts,
  categories,
  initialTag,
  initialCategory,
}: Props) {
  const [activeTag, setActiveTag] = useState(initialTag || '')
  const [activeCategory, setActiveCategory] = useState(initialCategory || '')
  const [sortBy, setSortBy] = useState('newest')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000])
  const [showFilters, setShowFilters] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<QuickViewProduct | null>(null)

  // Build hierarchical category tree
  const categoryTree = useMemo(() => {
    const cats = categories as unknown as CategoryItem[]
    // Separate top-level vs children
    const topLevel: CategoryItem[] = []
    const childrenMap = new Map<string | number, CategoryItem[]>()

    for (const cat of cats) {
      const parentId = cat.parent
        ? typeof cat.parent === 'object' ? cat.parent.id : cat.parent
        : null
      if (!parentId) {
        topLevel.push(cat)
      } else {
        const key = String(parentId)
        if (!childrenMap.has(key)) childrenMap.set(key, [])
        childrenMap.get(key)!.push(cat)
      }
    }

    // Sort: put categories with products first, then alphabetically
    // Define display order for top-level categories
    const displayOrder = [
      'new-arrival', 'all-products', 'theme-picks', 'dresses', 'bottoms',
      'sets', 'outer', 'accessories', 'jewelry', 'formal-dresses',
      'rush-delivery', 'swimwear', 'brand-custom', 'k-drama',
    ]

    topLevel.sort((a, b) => {
      const ai = displayOrder.indexOf(a.slug)
      const bi = displayOrder.indexOf(b.slug)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return String(a.name).localeCompare(String(b.name))
    })

    return { topLevel, childrenMap }
  }, [categories])

  // Get all child category IDs for a parent (for filtering)
  const getCategoryFamily = useMemo(() => {
    return (catId: string) => {
      const children = categoryTree.childrenMap.get(catId) || []
      return [catId, ...children.map(c => String(c.id))]
    }
  }, [categoryTree])

  // Extract unique colors from all products
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

  const [selectedColors, setSelectedColors] = useState<string[]>([])

  // Filter and sort products
  const filtered = useMemo(() => {
    let list = [...initialProducts]

    // Tag filter
    if (activeTag === 'new') list = list.filter((p) => p.isNew)
    if (activeTag === 'hot') list = list.filter((p) => p.isHot)
    if (activeTag === 'sale')
      list = list.filter((p) => {
        const sp = p.salePrice as number | undefined
        return sp && sp > 0
      })

    // Category filter (includes children of parent categories)
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

    // Color filter
    if (selectedColors.length > 0) {
      list = list.filter((p) => {
        const variants = p.variants as { colorName: string }[] | undefined
        return variants?.some((v) => selectedColors.includes(v.colorName))
      })
    }

    // Sort
    list.sort((a, b) => {
      const priceA = ((a.salePrice as number) || (a.price as number)) ?? 0
      const priceB = ((b.salePrice as number) || (b.price as number)) ?? 0
      if (sortBy === 'price-asc') return priceA - priceB
      if (sortBy === 'price-desc') return priceB - priceA
      return 0 // newest is default from server
    })

    return list
  }, [initialProducts, activeTag, activeCategory, priceRange, selectedColors, sortBy])

  const toggleColor = (name: string) => {
    setSelectedColors((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )
  }

  const clearFilters = () => {
    setActiveTag('')
    setActiveCategory('')
    setPriceRange([0, 10000])
    setSelectedColors([])
  }

  const hasActiveFilters =
    activeTag || activeCategory || selectedColors.length > 0 || priceRange[0] > 0 || priceRange[1] < 10000

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-12">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">PRODUCTS</p>
          <h1 className="text-2xl md:text-3xl font-serif">全部商品</h1>
        </div>
      </div>

      <div className="container py-6 md:py-10">
        {/* Tag tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {TAG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveTag(opt.value)}
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
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">商品分類</p>
          {/* Top-level categories — horizontal scrollable */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => setActiveCategory('')}
              className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
                !activeCategory
                  ? 'bg-gold-500 text-white border-gold-500'
                  : 'bg-cream-50 border-cream-200 text-foreground/70 hover:border-gold-400 hover:text-foreground'
              }`}
            >
              全部分類
            </button>
            {categoryTree.topLevel.map((parent) => {
              const children = categoryTree.childrenMap.get(String(parent.id)) || []
              const isParentActive = activeCategory === String(parent.id)
              const isChildActive = children.some(c => String(c.id) === activeCategory)

              return (
                <button
                  key={String(parent.id)}
                  onClick={() => setActiveCategory(String(parent.id))}
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
            // Find which parent is active (or which parent owns the active child)
            const activeParentId = categoryTree.topLevel.find(p => {
              if (String(p.id) === activeCategory) return true
              const kids = categoryTree.childrenMap.get(String(p.id)) || []
              return kids.some(c => String(c.id) === activeCategory)
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
                  onClick={() => setActiveCategory(String(activeParentId.id))}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors border ${
                    activeCategory === String(activeParentId.id)
                      ? 'bg-foreground/10 border-foreground/20 text-foreground font-medium'
                      : 'bg-cream-50 border-cream-100 text-foreground/60 hover:text-foreground'
                  }`}
                >
                  全部{activeParentId.name}
                </button>
                {children.map((child) => (
                  <button
                    key={String(child.id)}
                    onClick={() => setActiveCategory(String(child.id))}
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
              更多篩選
              {(selectedColors.length > 0 || priceRange[0] > 0 || priceRange[1] < 10000) && (
                <span className="w-2 h-2 rounded-full bg-gold-500" />
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
                清除篩選
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {filtered.length} 件商品
            </span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
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
                {allColors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
                      顏色
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
                    價格範圍
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={priceRange[0]}
                      onChange={(e) =>
                        setPriceRange([Number(e.target.value), priceRange[1]])
                      }
                      placeholder="NT$ 0"
                      className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                    />
                    <span className="text-muted-foreground text-xs">—</span>
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={(e) =>
                        setPriceRange([priceRange[0], Number(e.target.value)])
                      }
                      placeholder="NT$ 10,000"
                      className="w-full px-3 py-2 border border-cream-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                    />
                  </div>
                </div>

                {/* Size placeholder */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider">
                    尺寸
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1.5 text-xs border border-cream-200 rounded-lg text-foreground/70 hover:border-gold-400 cursor-pointer transition-colors"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
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
                  image={firstImage ? { url: firstImage.url || '', alt: firstImage.alt } : null}
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
                          img.image?.url ? { url: img.image.url, alt: img.image.alt } : null,
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
            <p className="text-muted-foreground mb-2">目前沒有符合條件的商品</p>
            <button
              onClick={clearFilters}
              className="text-sm text-gold-600 hover:underline"
            >
              清除篩選條件
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
