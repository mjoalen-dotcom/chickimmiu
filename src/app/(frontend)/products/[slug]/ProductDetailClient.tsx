'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { normalizeMediaUrl } from '@/lib/media-url'
import {
  Heart,
  ShoppingBag,
  Minus,
  Plus,
  Truck,
  RefreshCw,
  Shield,
  ChevronLeft,
  ChevronRight,
  Ruler,
  CreditCard,
  Package,
  Clock,
  Star,
  MessageSquare,
  Zap,
  AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/stores/cartStore'
import { useWishlistStore } from '@/stores/wishlistStore'
import { ProductCard } from '@/components/product/ProductCard'
import { AISizeRecommender } from '@/components/product/AISizeRecommender'
import { AlsoBoughtSection } from '@/components/product/AlsoBoughtSection'
import { ProductPageUpsell } from '@/components/recommendation/ProductPageUpsell'
import { CampaignProductBadge } from '@/components/campaign/CampaignProductBadge'
import { trackViewContent, trackProductView } from '@/lib/tracking'
import { Price } from '@/components/common/Price'
import ImageLightbox, { type LightboxImage } from './_components/ImageLightbox'

/* ─────────────────────────────────── types ── */
export interface ReviewLite {
  id: string
  name: string
  rating: number
  date: string
  title: string
  content: string
}

interface Props {
  product: Record<string, unknown>
  relatedProducts: Record<string, unknown>[]
  initialReviews?: ReviewLite[]
}

interface LexicalNode {
  type: string
  text?: string
  children?: LexicalNode[]
  format?: number | string
  tag?: string
  direction?: string
  url?: string
  listType?: string
  value?: unknown
}

/* ─── Lexical rich-text → React ─── */
function RenderLexical({ content }: { content: unknown }) {
  if (!content || typeof content !== 'object') return null
  const root = (content as { root?: LexicalNode }).root
  if (!root?.children) return null

  return <>{root.children.map((node, i) => <LexicalNodeRenderer key={i} node={node} />)}</>
}

function LexicalNodeRenderer({ node }: { node: LexicalNode }) {
  if (node.type === 'text') {
    let el: React.ReactNode = node.text || ''
    const fmt = typeof node.format === 'number' ? node.format : 0
    if (fmt & 1) el = <strong>{el}</strong>
    if (fmt & 2) el = <em>{el}</em>
    if (fmt & 8) el = <u>{el}</u>
    if (fmt & 4) el = <s>{el}</s>
    return <>{el}</>
  }

  const children = node.children?.map((child, i) => <LexicalNodeRenderer key={i} node={child} />)

  switch (node.type) {
    case 'paragraph':
      return <p className="mb-3 leading-relaxed">{children}</p>
    case 'heading': {
      const Tag = (node.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') || 'h3'
      return <Tag className="font-semibold mb-2 mt-4">{children}</Tag>
    }
    case 'list':
      return node.listType === 'number' ? (
        <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
      ) : (
        <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
      )
    case 'listitem':
      return <li>{children}</li>
    case 'link':
      return (
        <a href={node.url || '#'} className="text-gold-600 underline" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    case 'linebreak':
      return <br />
    case 'upload': {
      // Lexical upload node — { type, relationTo, value: { id, url, mimeType, filename, alt, width, height } }
      const value = node.value as
        | {
            id?: string | number
            url?: string
            mimeType?: string
            filename?: string
            alt?: string
            width?: number
            height?: number
          }
        | undefined
      if (!value) return null
      const src = normalizeMediaUrl(value.url)
      if (!src) return null
      const isVideo = Boolean(value.mimeType?.startsWith('video/'))
      if (isVideo) {
        return (
          <div className="my-4 rounded-lg overflow-hidden">
            <video
              src={src}
              controls
              playsInline
              className="w-full h-auto"
              preload="metadata"
            />
          </div>
        )
      }
      const w = value.width || 1200
      const h = value.height || 800
      return (
        <div className="my-4 rounded-lg overflow-hidden">
          <Image
            src={src}
            alt={value.alt || value.filename || ''}
            width={w}
            height={h}
            className="w-full h-auto"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )
    }
    default:
      return <>{children}</>
  }
}

/* ─── Tab IDs ─── */
const TABS = [
  { id: 'description', label: '商品描述' },
  { id: 'info', label: '商品資訊' },
  { id: 'shipping', label: '送貨及付款方式' },
  { id: 'reviews', label: '顧客評價' },
] as const

type TabId = (typeof TABS)[number]['id']

/* ═══════════════════════════════════ Main Component ═══════════════════════════════════ */
export function ProductDetailClient({ product, relatedProducts, initialReviews = [] }: Props) {
  const router = useRouter()
  const rawImages = (product.images as { image?: { url?: string; alt?: string } }[]) || []
  // Normalise media URLs: /api/media/file/X → /media/X for static serving
  const images = rawImages.map((img) => ({
    ...img,
    image: img.image ? { ...img.image, url: normalizeMediaUrl(img.image.url) } : img.image,
  }))
  const variants = (product.variants as {
    colorName: string
    colorCode?: string
    size: string
    sku: string
    stock: number
    priceOverride?: number
  }[]) || []

  /* ─── Phase 1 public fields（前台顯示用，內部採購欄位改走 sourcing group） ─── */
  const material = (product.material as string | undefined) || undefined
  const materialDescription = (product.materialDescription as string | undefined) || undefined
  const rawMaterialImages =
    (product.materialImages as { image?: { url?: string; alt?: string }; caption?: string }[]) ||
    []
  const materialImages = rawMaterialImages
    .map((m) => ({
      ...m,
      image: m.image
        ? { ...m.image, url: normalizeMediaUrl(m.image.url) }
        : m.image,
    }))
    .filter((m) => m.image?.url)
  const careInstructions = (product.careInstructions as string | undefined) || undefined
  const stylingTips = (product.stylingTips as string | undefined) || undefined
  const purchaseLimit =
    typeof product.purchaseLimit === 'number' && product.purchaseLimit > 0
      ? Math.floor(product.purchaseLimit)
      : 0
  const introVideoRaw = product.introVideo as
    | { url?: string; mimeType?: string }
    | string
    | number
    | null
    | undefined
  const introVideoUrl =
    introVideoRaw && typeof introVideoRaw === 'object'
      ? normalizeMediaUrl(introVideoRaw.url)
      : null
  const modelInfo = product.modelInfo as
    | {
        height?: string
        weight?: string
        wearingSize?: string
        bodyShape?: string
      }
    | null
    | undefined
  // sizeChart: page.tsx 用 depth: 2 populate，這裡可能是 object / id / null
  const sizeChartRaw = product.sizeChart as
    | {
        name?: string
        unit?: 'cm' | 'inch'
        measurements?: { key: string; label: string }[]
        rows?: { size: string; values?: { key: string; value: string }[] }[]
        note?: string
      }
    | string
    | number
    | null
    | undefined
  const sizeChart =
    sizeChartRaw && typeof sizeChartRaw === 'object' ? sizeChartRaw : null
  const hasModelInfo = Boolean(
    modelInfo &&
      (modelInfo.height || modelInfo.weight || modelInfo.wearingSize || modelInfo.bodyShape),
  )

  const uniqueColors = [...new Map(variants.map((v) => [v.colorName, v])).values()]
  const [selectedColor, setSelectedColor] = useState(uniqueColors[0]?.colorName || '')
  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [currentImage, setCurrentImage] = useState(0)
  // 韓系長圖（高寬比 >1.6）改 chuu 詳情頁手法：固定框內部可上下滑動，
  // 不再被 object-cover 硬裁。載入時記各圖比例，一般圖維持原本裁切。
  const [tallImages, setTallImages] = useState<Record<string, boolean>>({})
  const [showSizeGuide, setShowSizeGuide] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('description')
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [cartToast, setCartToast] = useState<string | null>(null)
  const cartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ─── Lightbox state ─── */
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([])
  const [lightboxStart, setLightboxStart] = useState(0)
  const galleryLightboxImages: LightboxImage[] = images
    .filter((img) => img.image?.url)
    .map((img) => ({
      url: img.image!.url!,
      alt: img.image?.alt || (product.name as string),
      caption: (img as { caption?: string }).caption,
    }))
  const openGalleryLightbox = (start: number) => {
    setLightboxImages(galleryLightboxImages)
    setLightboxStart(start)
    setLightboxOpen(true)
  }
  const openMaterialLightbox = (start: number) => {
    setLightboxImages(
      materialImages.map((m) => ({
        url: m.image!.url!,
        alt: m.image?.alt || `${product.name as string} 材質說明`,
        caption: m.caption,
      })),
    )
    setLightboxStart(start)
    setLightboxOpen(true)
  }

  /* 縮圖列上限：超過此值最後一格變 +N（點開 lightbox） */
  const THUMB_LIMIT = 5

  const addItem = useCartStore((s) => s.addItem)
  const { toggleItem, isInWishlist } = useWishlistStore()
  const inWishlist = isInWishlist(product.id as unknown as string)
  const addToCartRef = useRef<HTMLDivElement>(null)
  // 未選款式時要能捲回去並閃一下的目標
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const sizePickerRef = useRef<HTMLDivElement>(null)
  const [highlightOption, setHighlightOption] = useState<'color' | 'size' | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  // Sticky bar visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    )
    if (addToCartRef.current) observer.observe(addToCartRef.current)
    return () => observer.disconnect()
  }, [])

  // ViewContent tracking + UTM 商品瀏覽事件落庫
  useEffect(() => {
    trackViewContent({
      content_id: product.id as unknown as string,
      content_name: product.name as string,
      content_type: (product.category as string) || 'product',
      value: (product.salePrice as number) ?? (product.price as number),
      currency: 'TWD',
    })
    // PR-B：把這次 PDP 瀏覽寫到 product-view-events，附帶當下 UTM
    // 使用 fire-and-forget；後端有 30s/SKU dedup 防 reload 灌爆
    trackProductView(
      product.id as unknown as string | number,
      product.name as string | undefined,
    )
  }, [product.id, product.name, product.category, product.salePrice, product.price])

  const sizes = [...new Set(
    variants
      .filter((v) => !selectedColor || v.colorName === selectedColor)
      .map((v) => v.size),
  )]

  const selectedVariant = variants.find(
    (v) => v.colorName === selectedColor && v.size === selectedSize,
  )
  // 變體 priceOverride / 商品 salePrice 只在 > 0 時採用（LB-02）：
  // prod 部分資料的 priceOverride 是 0（非 null），用 ?? 會讓 0 覆蓋原價 → 選變體變 NT$0 結帳。
  // 比照 lib/ads/feedBuilder.ts 的 > 0 守衛：任一非正值視為未設定，往下 fallback。
  const posPrice = (n: unknown): number | undefined =>
    typeof n === 'number' && n > 0 ? n : undefined
  const currentPrice =
    posPrice(selectedVariant?.priceOverride) ??
    posPrice(product.salePrice) ??
    (product.price as number)
  const originalPrice = product.price as number
  const discountPercent =
    currentPrice < originalPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : null

  // Campaign Engine：badge 的 scope 判斷資料（分類 / 標籤；rel 可能是 id 或已 populate 的物件）
  const relIdOf = (v: unknown): number | string | null =>
    v == null ? null : typeof v === 'object' ? ((v as Record<string, unknown>).id as number | string) ?? null : (v as number | string)
  const campaignCategoryIds = [
    relIdOf(product.category),
    ...(Array.isArray(product.additionalCategories) ? product.additionalCategories.map(relIdOf) : []),
  ].filter((x): x is number | string => x != null)
  const campaignTags = Array.isArray(product.tags)
    ? (product.tags as Array<Record<string, unknown>>).map((t) => String(t?.tag ?? '')).filter(Boolean)
    : []

  const canAddToCart = variants.length === 0 || (selectedColor && selectedSize)

  // 預購：allowPreOrder=true 時，缺貨 (stock=0) 的款式仍可選取並加入購物車（視為預購）。
  const allowPreOrder = Boolean(product.allowPreOrder)
  const preOrderNote = (product.preOrderNote as string) || ''
  const selectedVariantOutOfStock = Boolean(selectedVariant && selectedVariant.stock === 0)
  const isPreorderItem = selectedVariantOutOfStock && allowPreOrder

  /* ─── 買不下去時要講出原因 ───────────────────────────────────────────
   * 原本按鈕只是 disabled，顧客按不動也不知道為什麼——尤其 Free size 這種
   * 只有一個尺寸的商品，大家會以為不用選。這裡分三種情況給不同的話：
   *   ① 全款缺貨且不開放預購 → 講缺貨，不要叫人去選一個選不了的尺寸
   *   ② 這個顏色的尺寸全缺   → 叫人換顏色
   *   ③ 單純還沒選           → 講清楚缺哪一項
   */
  const isSizeBlocked = (size: string) => {
    const v = variants.find((x) => x.colorName === selectedColor && x.size === size)
    return Boolean(v && v.stock === 0 && !allowPreOrder)
  }
  const selectableSizes = sizes.filter((s) => !isSizeBlocked(s))
  const allSoldOut =
    variants.length > 0 && !allowPreOrder && variants.every((v) => v.stock === 0)
  const colorSoldOut = !allSoldOut && sizes.length > 0 && selectableSizes.length === 0
  const missingOptions = [
    uniqueColors.length > 0 && !selectedColor ? '顏色' : null,
    sizes.length > 0 && !selectedSize ? '尺寸' : null,
  ].filter((x): x is string => x != null)
  const selectionHint = canAddToCart
    ? null
    : allSoldOut
      ? '本商品目前缺貨，可先加入追蹤清單'
      : colorSoldOut
        ? '此顏色目前缺貨，請換一個顏色'
        : missingOptions.length > 0
          ? `請先選擇${missingOptions.join('與')}`
          : '請先選擇商品款式'

  /* ─── Quick Win D2: 韓系電商 social proof + 韓星同款 + 金老佛爺穿過 三種徽章 ─── */
  const totalSold = (product.totalSold as number) ?? 0
  // 50/100/300/500/1000+ 階梯顯示，避免冷啟動 "5 件" 不夠氣勢
  const totalSoldDisplay = (() => {
    if (totalSold >= 1000) return '1000+'
    if (totalSold >= 500) return '500+'
    if (totalSold >= 300) return '300+'
    if (totalSold >= 100) return '100+'
    if (totalSold >= 50) return '50+'
    return null
  })()
  const collectionTags = ((product.collectionTags as string[] | undefined) || []) as string[]
  const koreanCelebRef = product.koreanCelebrityRef as
    | { celebrityName?: string; dramaOrShow?: string; sourceBrand?: string }
    | undefined
  const koreanCelebrityBadge = collectionTags.includes('korean-celebrity') || collectionTags.includes('celebrity-style')
    ? [koreanCelebRef?.celebrityName, koreanCelebRef?.dramaOrShow]
        .filter(Boolean)
        .join(' · ') || '韓星同款'
    : null
  const jinStyleBadge =
    collectionTags.includes('jin-style') || collectionTags.includes('jin-live')

  const handleAddToCart = useCallback(() => {
    if (!canAddToCart) return false
    const result = addItem(
      {
        productId: product.id as unknown as string,
        slug: product.slug as string,
        name: product.name as string,
        image: images[0]?.image?.url,
        price: originalPrice,
        salePrice: currentPrice !== originalPrice ? currentPrice : undefined,
        variant: selectedVariant
          ? {
              colorName: selectedVariant.colorName,
              colorCode: selectedVariant.colorCode,
              size: selectedVariant.size,
              sku: selectedVariant.sku,
            }
          : undefined,
        purchaseLimit: purchaseLimit > 0 ? purchaseLimit : undefined,
      },
      quantity,
    )
    if (!result.ok) {
      setCartToast(result.message || '加入購物車失敗')
      if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
      cartToastTimerRef.current = setTimeout(() => setCartToast(null), 1800)
      return false
    }
    setCartToast('✅ 已加入購物車')
    if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
    cartToastTimerRef.current = setTimeout(() => setCartToast(null), 1300)
    return true
  }, [
    addItem,
    canAddToCart,
    product,
    images,
    originalPrice,
    currentPrice,
    selectedVariant,
    purchaseLimit,
    quantity,
  ])

  const handleBuyNow = useCallback(() => {
    const ok = handleAddToCart()
    if (ok) router.push('/checkout')
  }, [handleAddToCart, router])

  /**
   * 款式沒選完時，把「按不動」換成「按了有話說」：跳提示 + 捲回選項 + 閃一下。
   * 選完了才真的執行加入購物車／立即購買。
   */
  const runWithSelectionGuard = useCallback(
    (action: () => void) => {
      if (canAddToCart) {
        action()
        return
      }
      setCartToast(selectionHint)
      if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
      cartToastTimerRef.current = setTimeout(() => setCartToast(null), 2600)

      if (allSoldOut) return // 真的沒貨，捲去哪都沒用
      const target =
        colorSoldOut || missingOptions[0] === '顏色' ? 'color' : 'size'
      const node = (target === 'color' ? colorPickerRef : sizePickerRef).current
      if (node) {
        // 手機視窗實測 smooth 捲動不一定會動（html 有 scroll-behavior:smooth，
        // 部分瀏覽器把程式化 smooth 捲動吃掉）→ 先試 smooth，沒動就硬跳。
        const top = Math.max(node.getBoundingClientRect().top + window.scrollY - 120, 0)
        window.scrollTo({ top, behavior: 'smooth' })
        // 判斷「有沒有到目標」而不是「有沒有移動」——sticky bar 一出現會讓版面
        // 位移幾十 px，用「有移動」判斷會誤以為捲動已生效。
        // 另外兩參數的 scrollTo(0, y) 會沿用 CSS scroll-behavior:smooth，
        // 連 fallback 都會被吃掉，所以明確指定 instant。
        setTimeout(() => {
          if (Math.abs(window.scrollY - top) > 24) {
            window.scrollTo({ top, behavior: 'instant' as ScrollBehavior })
          }
        }, 500)
      }
      setHighlightOption(target)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = setTimeout(() => setHighlightOption(null), 2600)
    },
    [canAddToCart, selectionHint, missingOptions, allSoldOut, colorSoldOut],
  )

  const handleWishlist = () => {
    toggleItem({
      productId: product.id as unknown as string,
      slug: product.slug as string,
      name: product.name as string,
      image: images[0]?.image?.url,
      price: originalPrice,
      salePrice: (product.salePrice as number | undefined) ?? undefined,
    })
  }

  const prevImage = () => setCurrentImage((i) => (i === 0 ? images.length - 1 : i - 1))
  const nextImage = () => setCurrentImage((i) => (i === images.length - 1 ? 0 : i + 1))

  /* ── Category info ── */
  const category = product.category as { name?: string; slug?: string } | string | undefined
  const categoryName = typeof category === 'object' ? category?.name : undefined

  return (
    <main className="bg-cream-50 min-h-screen pb-20 md:pb-0">
      {/* Breadcrumb */}
      <div className="container py-4">
        <nav className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Link href="/" className="hover:text-gold-600 transition-colors">首頁</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-gold-600 transition-colors">全部商品</Link>
          {categoryName && (
            <>
              <span>/</span>
              <span className="text-foreground/60">{categoryName}</span>
            </>
          )}
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{product.name as string}</span>
        </nav>
      </div>

      <div className="container pb-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ══════════ Gallery ══════════ */}
          <div className="flex gap-3">
            {/* Thumbnails — vertical on desktop（最多 5 格，多餘合併成 +N，點開全螢幕 lightbox） */}
            {images.length > 1 && (
              <div className="hidden md:flex flex-col gap-2 w-[72px] shrink-0">
                {(() => {
                  const overflow = images.length > THUMB_LIMIT
                  const visibleCount = overflow ? THUMB_LIMIT - 1 : images.length
                  const visible = images.slice(0, visibleCount)
                  return (
                    <>
                      {visible.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImage(i)}
                          className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors ${
                            i === currentImage
                              ? 'border-gold-500'
                              : 'border-cream-200 hover:border-gold-300'
                          }`}
                          aria-label={`商品圖 ${i + 1}`}
                        >
                          {img.image?.url ? (
                            <Image
                              src={img.image.url}
                              alt={img.image.alt || `${product.name} ${i + 1}`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="bg-cream-100 w-full h-full" />
                          )}
                        </button>
                      ))}
                      {overflow && (
                        <button
                          type="button"
                          onClick={() => openGalleryLightbox(visibleCount)}
                          className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-cream-200 hover:border-gold-500 transition-colors group"
                          aria-label={`查看全部 ${images.length} 張圖片`}
                        >
                          {images[visibleCount]?.image?.url && (
                            <Image
                              src={images[visibleCount].image!.url!}
                              alt=""
                              fill
                              className="object-cover opacity-60 group-hover:opacity-50 transition-opacity"
                              unoptimized
                            />
                          )}
                          <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-sm font-medium tracking-wide">
                            +{images.length - visibleCount}
                          </span>
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* Main image */}
            <div className="flex-1 space-y-3">
              {introVideoUrl && (
                <div className="rounded-2xl overflow-hidden border border-cream-200 bg-black">
                  <video
                    src={introVideoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full max-h-[480px] object-cover"
                  />
                </div>
              )}
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 border border-cream-200">
                {images[currentImage]?.image?.url ? (
                  tallImages[images[currentImage].image!.url!] ? (
                    <>
                      {/* 長圖：框內滑動（chuu-detail 手法） */}
                      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={images[currentImage].image!.url!}
                          alt={images[currentImage].image!.alt || (product.name as string)}
                          className="w-full h-auto"
                        />
                      </div>
                      <span className="absolute bottom-3 right-3 px-2.5 py-1 bg-neutral-900/80 text-white text-[10px] tracking-[0.15em] rounded-full pointer-events-none">
                        ↕ 圖片可滑動
                      </span>
                    </>
                  ) : (
                    <Image
                      src={images[currentImage].image!.url!}
                      alt={images[currentImage].image!.alt || (product.name as string)}
                      fill
                      className="object-cover"
                      priority
                      unoptimized
                      onLoad={(e) => {
                        const el = e.currentTarget
                        // key 用 attribute 原始值（unoptimized 下 = 資料庫 url），
                        // currentSrc 是絕對網址會跟查表 key 對不上
                        const key = el.getAttribute('src')
                        if (key && el.naturalWidth > 0 && el.naturalHeight / el.naturalWidth > 1.6) {
                          setTallImages((prev) => ({ ...prev, [key]: true }))
                        }
                      }}
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    {product.name as string}
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {Boolean(product.isNew) && (
                    <span className="px-3 py-1 bg-gold-500 text-white text-xs rounded-full tracking-wider">NEW</span>
                  )}
                  {Boolean(product.isHot) && (
                    <span className="px-3 py-1 bg-red-500 text-white text-xs rounded-full tracking-wider">HOT</span>
                  )}
                  {discountPercent && (
                    <span className="px-3 py-1 bg-blush-200 text-red-600 text-xs rounded-full tracking-wider">
                      -{discountPercent}%
                    </span>
                  )}
                  {/* Campaign Engine：活動資格 badge（真正折抵仍以結帳 server 報價為準） */}
                  <CampaignProductBadge
                    productId={product.id as string | number}
                    categoryIds={campaignCategoryIds}
                    tags={campaignTags}
                    className="px-3 py-1 text-xs"
                  />
                  {totalSoldDisplay && (
                    <span
                      className="px-3 py-1 bg-amber-500 text-white text-xs rounded-full tracking-wider shadow-sm"
                      title={`累計售出 ${(product.totalSold as number) || 0} 件`}
                    >
                      ✦ 售出 {totalSoldDisplay}
                    </span>
                  )}
                  {koreanCelebrityBadge && (
                    <span
                      className="px-3 py-1 bg-rose-100 text-rose-700 text-xs rounded-full tracking-wider border border-rose-200"
                      title={koreanCelebrityBadge}
                    >
                      ★ 韓星同款
                    </span>
                  )}
                  {jinStyleBadge && (
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-200 to-orange-200 text-amber-800 text-xs rounded-full tracking-wider">
                      ✿ 金老佛爺已穿
                    </span>
                  )}
                </div>

                {/* Nav arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
              </div>

              {/* Mobile thumbnails — horizontal（同樣最多 5 格 + +N） */}
              {images.length > 1 && (
                <div className="flex md:hidden gap-2 overflow-x-auto scrollbar-hide">
                  {(() => {
                    const overflow = images.length > THUMB_LIMIT
                    const visibleCount = overflow ? THUMB_LIMIT - 1 : images.length
                    const visible = images.slice(0, visibleCount)
                    return (
                      <>
                        {visible.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentImage(i)}
                            className={`relative w-14 h-[70px] rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                              i === currentImage ? 'border-gold-500' : 'border-cream-200'
                            }`}
                            aria-label={`商品圖 ${i + 1}`}
                          >
                            {img.image?.url ? (
                              <Image src={img.image.url} alt="" fill className="object-cover" unoptimized />
                            ) : (
                              <div className="bg-cream-100 w-full h-full" />
                            )}
                          </button>
                        ))}
                        {overflow && (
                          <button
                            type="button"
                            onClick={() => openGalleryLightbox(visibleCount)}
                            className="relative w-14 h-[70px] rounded-lg overflow-hidden shrink-0 border-2 border-cream-200 hover:border-gold-500 transition-colors group"
                            aria-label={`查看全部 ${images.length} 張圖片`}
                          >
                            {images[visibleCount]?.image?.url && (
                              <Image
                                src={images[visibleCount].image!.url!}
                                alt=""
                                fill
                                className="object-cover opacity-60 group-hover:opacity-50 transition-opacity"
                                unoptimized
                              />
                            )}
                            <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-xs font-medium">
                              +{images.length - visibleCount}
                            </span>
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ══════════ Product Info ══════════ */}
          <div className="space-y-6 max-w-lg">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif mb-3">{product.name as string}</h1>
              <div className="flex items-baseline gap-3">
                <Price
                  twd={currentPrice}
                  className="text-2xl font-medium text-gold-600"
                />
                {currentPrice < originalPrice && (
                  <Price
                    twd={originalPrice}
                    className="text-base text-muted-foreground line-through"
                  />
                )}
                {discountPercent && (
                  <span className="text-sm text-red-500 font-medium">-{discountPercent}%</span>
                )}
              </div>
            </div>

            {/* Color selector */}
            {uniqueColors.length > 0 && (
              <div
                ref={colorPickerRef}
                className={`rounded-xl transition-all ${
                  highlightOption === 'color'
                    ? 'ring-2 ring-gold-500 ring-offset-4 ring-offset-cream-50'
                    : ''
                }`}
              >
                <p className="text-sm mb-3">
                  顏色：<span className="text-gold-600">{selectedColor}</span>
                </p>
                <div className="flex flex-wrap gap-3">
                  {uniqueColors.map((c) => (
                    <button
                      key={c.colorName}
                      onClick={() => { setSelectedColor(c.colorName); setSelectedSize('') }}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        selectedColor === c.colorName
                          ? 'border-gold-500 ring-2 ring-gold-500/30 scale-110'
                          : 'border-cream-200 hover:border-gold-300'
                      }`}
                      style={{ backgroundColor: c.colorCode || '#ccc' }}
                      title={c.colorName}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Size selector */}
            {sizes.length > 0 && (
              <div
                ref={sizePickerRef}
                className={`rounded-xl transition-all ${
                  highlightOption === 'size'
                    ? 'ring-2 ring-gold-500 ring-offset-4 ring-offset-cream-50'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm">
                    尺寸{selectedSize ? `：${selectedSize}` : ''}
                    {!selectedSize && selectableSizes.length > 0 && (
                      <span className="ml-1 text-gold-600">（請選擇）</span>
                    )}
                  </p>
                  <button
                    onClick={() => setShowSizeGuide(!showSizeGuide)}
                    className="flex items-center gap-1 text-xs text-gold-600 hover:underline"
                  >
                    <Ruler size={12} />
                    尺寸表
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const variant = variants.find((v) => v.colorName === selectedColor && v.size === s)
                    const outOfStock = Boolean(variant && variant.stock === 0)
                    // 缺貨且「不」開放預購才真正鎖住；開放預購時缺貨款式仍可選（預購）。
                    const blocked = outOfStock && !allowPreOrder
                    const preorderable = outOfStock && allowPreOrder
                    return (
                      <button
                        key={s}
                        onClick={() => !blocked && setSelectedSize(s)}
                        disabled={blocked}
                        className={`px-4 py-2 text-sm rounded-xl border transition-colors ${
                          selectedSize === s
                            ? 'border-gold-500 bg-gold-500/10 text-gold-600 font-medium'
                            : blocked
                              ? 'border-cream-200 text-muted-foreground/30 line-through cursor-not-allowed'
                              : 'border-cream-200 hover:border-gold-400'
                        }`}
                      >
                        {s}
                        {variant && variant.stock > 0 && variant.stock <= 3 && (
                          <span className="ml-1 text-[10px] text-red-500">僅剩{variant.stock}件</span>
                        )}
                        {preorderable && (
                          <span className="ml-1 text-[10px] text-blue-500">預購</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* AI Size Recommender */}
                <AISizeRecommender
                  availableSizes={sizes}
                  onSizeSelect={(s) => setSelectedSize(s)}
                  productCategory={(product.category as string) || undefined}
                />

                {/* Size guide */}
                <AnimatePresence>
                  {showSizeGuide && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <div className="bg-white rounded-xl border border-cream-200 p-4 text-xs">
                        {sizeChart?.measurements?.length && sizeChart?.rows?.length ? (
                          <>
                            {sizeChart.name && (
                              <p className="text-[11px] text-foreground/50 mb-2">
                                參考尺寸表：{sizeChart.name}
                              </p>
                            )}
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-cream-200">
                                  <th className="py-2 text-left font-medium">尺寸</th>
                                  {sizeChart.measurements.map((m) => (
                                    <th key={m.key} className="py-2 text-center font-medium">
                                      {m.label}
                                      {sizeChart.unit ? `(${sizeChart.unit})` : ''}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="text-muted-foreground">
                                {sizeChart.rows.map((row, rowIdx) => (
                                  <tr key={`${row.size}-${rowIdx}`}>
                                    <td className="py-1.5">{row.size}</td>
                                    {sizeChart.measurements!.map((m) => {
                                      const match = row.values?.find((val) => val.key === m.key)
                                      return (
                                        <td key={m.key} className="text-center">
                                          {match?.value || '-'}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {sizeChart.note && (
                              <p className="mt-3 text-[11px] text-muted-foreground whitespace-pre-line">
                                {sizeChart.note}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-center py-4 text-muted-foreground">
                            尚未設定尺寸表（後台可至「商品管理 → 尺寸表」建立並關聯到此商品）
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Quantity */}
            <div>
              <p className="text-sm mb-3">數量</p>
              <div className="inline-flex items-center border border-cream-200 rounded-xl">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* ── Action buttons (加入購物車 + 立即購買) ── */}
            <div ref={addToCartRef} className="space-y-3">
              {purchaseLimit > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  每人限購 {purchaseLimit} 件
                </div>
              )}
              {allowPreOrder && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  🕒 本商品開放預購{preOrderNote ? `：${preOrderNote}` : '，下單後將依到貨時程為您安排出貨'}
                </div>
              )}
              {selectionHint && (
                <div className="flex items-center gap-2 rounded-xl border border-gold-600 bg-gold-500/10 px-3 py-2 text-sm text-gold-700">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {selectionHint}
                </div>
              )}
              {cartToast && (
                <div className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm text-foreground/80 shadow-sm">
                  {cartToast}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => runWithSelectionGuard(handleAddToCart)}
                  aria-disabled={!canAddToCart}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide transition-colors ${
                    canAddToCart ? 'hover:bg-foreground/90' : 'opacity-40'
                  }`}
                >
                  <ShoppingBag size={18} />
                  {isPreorderItem ? '預購加入購物車' : '加入購物車'}
                </button>
                <button
                  onClick={() => runWithSelectionGuard(handleBuyNow)}
                  aria-disabled={!canAddToCart}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#f4aaa4] text-white rounded-xl text-sm tracking-wide transition-colors ${
                    canAddToCart ? 'hover:bg-[#e89d97]' : 'opacity-40'
                  }`}
                >
                  <Zap size={18} />
                  {isPreorderItem ? '立即預購' : '立即購買'}
                </button>
              </div>

              {/* Wishlist */}
              <button
                onClick={handleWishlist}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-sm text-foreground/60 hover:text-red-500 transition-colors"
              >
                <Heart size={16} className={inWishlist ? 'fill-red-500 text-red-500' : ''} />
                {inWishlist ? '已加入追蹤清單' : '加入追蹤清單'}
              </button>
              <Link
                href="https://page.line.me/nqo0262k"
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-cream-200 bg-white py-2.5 text-sm text-foreground/70 transition-colors hover:border-gold-300 hover:text-gold-700"
              >
                <MessageSquare size={16} />
                LINE 詢問尺寸 / 現貨
              </Link>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                { icon: Truck, label: '滿額免運' },
                { icon: Clock, label: '現貨快出' },
                { icon: RefreshCw, label: '14 天鑑賞期' },
                { icon: Shield, label: '安全付款' },
              ].map((b) => (
                <div
                  key={b.label}
                  className="flex flex-col items-center gap-1.5 py-3 bg-white rounded-xl border border-cream-200"
                >
                  <b.icon size={16} className="text-gold-500" />
                  <span className="text-[10px] text-muted-foreground">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════ Tabs Section ══════════ */}
        <div className="mt-12 md:mt-16">
          {/* Tab navigation */}
          <div className="flex border-b border-cream-200 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-gold-500 text-gold-600 font-medium'
                    : 'border-transparent text-foreground/60 hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="py-8 md:py-10">
            {/* ── 商品描述 ── */}
            {activeTab === 'description' && (
              <div className="max-w-3xl mx-auto">
                {/* Arrival time banner */}
                <div className="bg-cream-100 rounded-2xl p-6 mb-8 text-center">
                  <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">ARRIVAL TIME</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    賣場商品皆為現貨＋預購<br />
                    現貨商品售完即需等候追加<br />
                    追加約需 <strong>7-14 個工作天</strong>（不含假日）
                  </p>
                </div>

                {/* Rich text description */}
                {Boolean(product.description) && (
                  <div className="prose prose-sm max-w-none text-foreground/80">
                    <RenderLexical content={product.description} />
                  </div>
                )}

                {/* Product images in description — grid，超過 5 張第 5 格變 +N，點開全螢幕滑行檢視 */}
                {(() => {
                  const descImages = images.slice(1).filter((img) => img.image?.url)
                  if (descImages.length === 0) return null
                  const DESC_LIMIT = 5
                  const overflow = descImages.length > DESC_LIMIT
                  const visibleCount = overflow ? DESC_LIMIT - 1 : descImages.length
                  const visible = descImages.slice(0, visibleCount)
                  return (
                    <div className="mt-8">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {visible.map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openGalleryLightbox(i + 1)}
                            className="relative w-full aspect-[3/4] rounded-xl overflow-hidden group cursor-zoom-in"
                            aria-label={`放大商品圖 ${i + 2}`}
                          >
                            <Image
                              src={img.image!.url!}
                              alt={img.image!.alt || `${product.name} 商品圖 ${i + 2}`}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              unoptimized
                            />
                          </button>
                        ))}
                        {overflow && (
                          <button
                            type="button"
                            onClick={() => openGalleryLightbox(visibleCount + 1)}
                            className="relative w-full aspect-[3/4] rounded-xl overflow-hidden group cursor-zoom-in"
                            aria-label={`查看全部 ${descImages.length} 張商品圖`}
                          >
                            {descImages[visibleCount]?.image?.url && (
                              <Image
                                src={descImages[visibleCount].image!.url!}
                                alt=""
                                fill
                                className="object-cover opacity-50 group-hover:opacity-40 transition-opacity"
                                unoptimized
                              />
                            )}
                            <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xl md:text-2xl font-medium tracking-wide">
                              +{descImages.length - visibleCount}
                            </span>
                          </button>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-foreground/40 text-center">
                        點圖片放大檢視，可左右滑行瀏覽
                      </p>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── 商品資訊 ── */}
            {activeTab === 'info' && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-cream-100">
                        <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium w-32">商品名稱</td>
                        <td className="px-5 py-3.5">{product.name as string}</td>
                      </tr>
                      {categoryName && (
                        <tr className="border-b border-cream-100">
                          <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium">商品分類</td>
                          <td className="px-5 py-3.5">{categoryName}</td>
                        </tr>
                      )}
                      {material && (
                        <tr className="border-b border-cream-100">
                          <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium">材質</td>
                          <td className="px-5 py-3.5">{material}</td>
                        </tr>
                      )}
                      {Boolean(product.productOrigin) && (
                        <tr className="border-b border-cream-100">
                          <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium">原產地</td>
                          <td className="px-5 py-3.5">{product.productOrigin as string}</td>
                        </tr>
                      )}
                      {Boolean(product.brand) && (
                        <tr className="border-b border-cream-100">
                          <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium">品牌</td>
                          <td className="px-5 py-3.5">{product.brand as string}</td>
                        </tr>
                      )}
                      {variants.length > 0 && (
                        <tr className="border-b border-cream-100">
                          <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium">可選顏色</td>
                          <td className="px-5 py-3.5">{uniqueColors.map(c => c.colorName).join('、')}</td>
                        </tr>
                      )}
                      {sizes.length > 0 && (
                        <tr className="border-b border-cream-100">
                          <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium">可選尺寸</td>
                          <td className="px-5 py-3.5">{sizes.join('、')}</td>
                        </tr>
                      )}
                      {Boolean(product.weight) && (
                        <tr>
                          <td className="px-5 py-3.5 bg-cream-50 text-foreground/60 font-medium">商品重量</td>
                          <td className="px-5 py-3.5">{product.weight as number} kg</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Material description + images */}
                {(materialDescription || materialImages.length > 0) && (
                  <div className="mt-6 bg-white rounded-2xl border border-cream-200 p-6">
                    <h3 className="font-medium text-sm mb-4">材質說明</h3>
                    {materialDescription && (
                      <p className="text-sm text-foreground/70 whitespace-pre-line mb-5">
                        {materialDescription}
                      </p>
                    )}
                    {materialImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {materialImages.map((m, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openMaterialLightbox(i)}
                            className="group cursor-zoom-in"
                            aria-label={`放大材質圖片 ${i + 1}`}
                          >
                            <div className="relative w-full aspect-square rounded-xl overflow-hidden">
                              <Image
                                src={m.image!.url!}
                                alt={m.image?.alt || `${product.name} 材質 ${i + 1}`}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                unoptimized
                              />
                            </div>
                            {m.caption && (
                              <p className="mt-2 text-xs text-foreground/60 text-center">
                                {m.caption}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Care instructions */}
                <div className="mt-6 bg-white rounded-2xl border border-cream-200 p-6">
                  <h3 className="font-medium text-sm mb-4">洗滌保養說明</h3>
                  {careInstructions ? (
                    <div className="text-sm text-foreground/70 whitespace-pre-line">
                      {careInstructions}
                    </div>
                  ) : (
                    <ul className="space-y-2 text-sm text-foreground/70">
                      <li className="flex items-start gap-2">
                        <span className="text-gold-500 mt-0.5">•</span>
                        建議以冷水手洗或放入洗衣袋以洗衣機柔洗
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gold-500 mt-0.5">•</span>
                        請勿使用漂白劑，避免長時間浸泡
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gold-500 mt-0.5">•</span>
                        建議反面晾曬，避免陽光直射
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gold-500 mt-0.5">•</span>
                        如需熨燙，請使用低溫並墊布熨燙
                      </li>
                    </ul>
                  )}
                </div>

                {/* Model info */}
                {hasModelInfo && (
                  <div className="mt-6 bg-white rounded-2xl border border-cream-200 p-6">
                    <h3 className="font-medium text-sm mb-4">模特兒資訊</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {modelInfo?.height && (
                        <div>
                          <p className="text-xs text-foreground/50 mb-1">身高</p>
                          <p>{modelInfo.height}</p>
                        </div>
                      )}
                      {modelInfo?.weight && (
                        <div>
                          <p className="text-xs text-foreground/50 mb-1">體重</p>
                          <p>{modelInfo.weight}</p>
                        </div>
                      )}
                      {modelInfo?.wearingSize && (
                        <div>
                          <p className="text-xs text-foreground/50 mb-1">穿著尺寸</p>
                          <p>{modelInfo.wearingSize}</p>
                        </div>
                      )}
                      {modelInfo?.bodyShape && (
                        <div>
                          <p className="text-xs text-foreground/50 mb-1">體型</p>
                          <p>{modelInfo.bodyShape}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Styling tips */}
                {stylingTips && (
                  <div className="mt-6 bg-white rounded-2xl border border-cream-200 p-6">
                    <h3 className="font-medium text-sm mb-4">穿搭建議</h3>
                    <div className="text-sm text-foreground/70 whitespace-pre-line">
                      {stylingTips}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 送貨及付款方式 ── */}
            {activeTab === 'shipping' && (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Shipping methods */}
                <div className="bg-white rounded-2xl border border-cream-200 p-6">
                  <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                    <Truck size={16} className="text-gold-500" />
                    配送方式
                  </h3>
                  <div className="space-y-3 text-sm">
                    {[
                      { method: '宅配到府', desc: '黑貓宅急便 / 新竹物流', fee: '運費 NT$100，滿 NT$1,000 免運' },
                      { method: '超商取貨', desc: '7-11 / 全家 / 萊爾富 / OK', fee: '運費 NT$70，滿 NT$1,000 免運' },
                      { method: '工作室自取', desc: '台北市松山區 (需預約)', fee: '免運費' },
                    ].map((s) => (
                      <div key={s.method} className="flex items-start gap-3 p-3 bg-cream-50 rounded-xl">
                        <Package size={16} className="text-gold-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{s.method}</p>
                          <p className="text-foreground/60 text-xs mt-0.5">{s.desc}</p>
                          <p className="text-gold-600 text-xs mt-0.5">{s.fee}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery time */}
                <div className="bg-white rounded-2xl border border-cream-200 p-6">
                  <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-gold-500" />
                    到貨時間
                  </h3>
                  <div className="space-y-2 text-sm text-foreground/70">
                    <p><strong>現貨商品：</strong>付款完成後 1-3 個工作天出貨</p>
                    <p><strong>預購商品：</strong>約 7-14 個工作天到貨（依商品頁面標示）</p>
                    <p className="text-xs text-foreground/50 mt-3">
                      ※ 週末及國定假日不出貨，出貨時間順延。如遇天候或不可抗力因素，出貨時間可能調整。
                    </p>
                  </div>
                </div>

                {/* Payment methods */}
                <div className="bg-white rounded-2xl border border-cream-200 p-6">
                  <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-gold-500" />
                    付款方式
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {['信用卡（VISA / Mastercard / JCB）', 'LINE Pay', 'Apple Pay', 'ATM 虛擬帳號', '超商代碼繳費', '貨到付款（限宅配）'].map((m) => (
                      <div key={m} className="flex items-center gap-2 p-2.5 bg-cream-50 rounded-lg">
                        <Shield size={12} className="text-gold-500 shrink-0" />
                        <span className="text-xs">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return policy */}
                <div className="bg-white rounded-2xl border border-cream-200 p-6">
                  <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                    <RefreshCw size={16} className="text-gold-500" />
                    退換貨政策
                  </h3>
                  <ul className="space-y-2 text-sm text-foreground/70">
                    <li>• 收到商品後享有 14 天鑑賞期</li>
                    <li>• 商品需保持全新未穿著、吊牌完整、原包裝未拆封</li>
                    <li>• 退貨運費由買方負擔（商品瑕疵除外）</li>
                    <li>• 詳細說明請參閱 <Link href="/return-policy" className="text-gold-600 underline">退換貨政策</Link></li>
                  </ul>
                </div>
              </div>
            )}

            {/* ── 顧客評價 ── */}
            {activeTab === 'reviews' && (
              <ProductReviewsSection reviews={initialReviews} />
            )}
          </div>
        </div>

        {/* ── AI 推薦 ── */}
        <ProductPageUpsell
          currentProductId={product.id as unknown as string}
          currentPrice={(product.salePrice as number) || (product.price as number) || 0}
        />
        <AlsoBoughtSection context="product_page" products={relatedProducts} />

        {/* ── Related Products ── */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 md:mt-24">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">YOU MAY ALSO LIKE</p>
                <h2 className="text-xl md:text-2xl font-serif">推薦商品</h2>
              </div>
              <Link href="/products" className="text-sm text-foreground/60 hover:text-gold-600 transition-colors">
                查看全部 →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((p) => {
                const imgs = p.images as { image?: { url?: string; alt?: string } }[] | undefined
                const firstImg = imgs?.[0]?.image
                return (
                  <ProductCard
                    key={p.id as unknown as string}
                    id={p.id as unknown as string}
                    slug={p.slug as string}
                    name={p.name as string}
                    price={p.price as number}
                    salePrice={p.salePrice as number | undefined}
                    image={firstImg ? { url: normalizeMediaUrl(firstImg.url) || '', alt: firstImg.alt } : null}
                    isNew={p.isNew as boolean | undefined}
                    isHot={p.isHot as boolean | undefined}
                  />
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* ══════════ Sticky Bottom Bar (mobile) ══════════ */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            // --consent-h 由 CookieConsentBanner 提供：同意條還在時往上讓位，避免購買列被蓋住
            style={{ bottom: 'var(--consent-h, 0px)' }}
            className="fixed left-0 right-0 z-50 bg-white border-t border-cream-200 shadow-lg px-4 py-3 flex items-center gap-3 md:hidden"
          >
            {/* 手機：提示要跟著這條購買列走，桌機那條提示在畫面外看不到 */}
            {(cartToast || selectionHint) && (
              <div className="absolute bottom-full left-0 right-0 mx-4 mb-2 flex items-center gap-2 rounded-xl border border-gold-600 bg-white px-3 py-2 text-sm text-gold-700 shadow-lg">
                {!cartToast && <AlertCircle size={16} className="flex-shrink-0" />}
                {cartToast || selectionHint}
              </div>
            )}
            <div className="flex-shrink-0">
              <p className="text-xs text-foreground/50 leading-none">價格</p>
              <Price twd={currentPrice} className="text-lg font-medium text-gold-600 leading-tight block" />
            </div>
            <button
              onClick={() => runWithSelectionGuard(handleAddToCart)}
              aria-disabled={!canAddToCart}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 bg-foreground text-cream-50 rounded-xl text-sm ${
                canAddToCart ? '' : 'opacity-40'
              }`}
            >
              <ShoppingBag size={16} />
              加入購物車
            </button>
            <button
              onClick={() => runWithSelectionGuard(handleBuyNow)}
              aria-disabled={!canAddToCart}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 bg-[#f4aaa4] text-white rounded-xl text-sm ${
                canAddToCart ? '' : 'opacity-40'
              }`}
            >
              <Zap size={16} />
              立即購買
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox — 商品圖庫 / 材質說明圖共用 */}
      <ImageLightbox
        open={lightboxOpen}
        images={lightboxImages}
        startIndex={lightboxStart}
        onClose={() => setLightboxOpen(false)}
      />
    </main>
  )
}

/* ══════════ Product Reviews Section ══════════ */

function ProductReviewsSection({ reviews }: { reviews: ReviewLite[] }) {
  const count = reviews.length
  const avgRating = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0
  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({
    stars: r,
    count: reviews.filter((rv) => rv.rating === r).length,
  }))

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {count > 0 ? (
            <>
              <p className="text-4xl font-medium text-gold-600">{avgRating.toFixed(1)}</p>
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={16}
                      className={s <= Math.round(avgRating) ? 'text-gold-500 fill-gold-500' : 'text-cream-300'}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{count} 則評價</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">尚無評價</p>
          )}
        </div>
        <Link
          href="/account/reviews"
          className="text-sm px-5 py-2 bg-gold-500 text-white rounded-xl hover:bg-gold-600 transition-colors flex items-center gap-2"
        >
          <MessageSquare size={14} />
          撰寫評價
        </Link>
      </div>

      {count > 0 && (
        <>
          {/* Rating bars */}
          <div className="space-y-2 mb-8">
            {ratingCounts.map((rc) => (
              <div key={rc.stars} className="flex items-center gap-3">
                <span className="text-sm w-8 text-right">{rc.stars} 星</span>
                <div className="flex-1 h-2 rounded-full bg-cream-200 overflow-hidden">
                  <div
                    className="h-full bg-gold-500 rounded-full"
                    style={{ width: `${(rc.count / count) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-6">{rc.count}</span>
              </div>
            ))}
          </div>

          {/* Review list */}
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl border border-cream-200 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium">{review.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            className={s <= review.rating ? 'text-gold-500 fill-gold-500' : 'text-cream-300'}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                    </div>
                  </div>
                </div>
                {review.title && <p className="text-sm font-medium mb-1">{review.title}</p>}
                <p className="text-sm text-muted-foreground leading-relaxed">{review.content}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
