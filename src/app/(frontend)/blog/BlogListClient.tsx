'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Sparkles,
} from 'lucide-react'

import type { BlogPageSettingsView } from './blogPageSettings'

/** 分類項目（count 為 -1 表示未知，例如 blog-categories 表尚未建立時的後備清單） */
export interface BlogCategoryView {
  value: string
  label: string
  order: number
  count: number
}

// 後備分類（DB blog-categories 為空時用）。value 對應 BlogPosts.category 的 select 值。
const FALLBACK_CATEGORIES: BlogCategoryView[] = [
  { value: 'styling', label: '穿搭教學', order: 0, count: -1 },
  { value: 'trends', label: '時尚趨勢', order: 1, count: -1 },
  { value: 'new-arrivals', label: '新品介紹', order: 2, count: -1 },
  { value: 'brand-story', label: '品牌故事', order: 3, count: -1 },
  { value: 'promotions', label: '優惠活動', order: 4, count: -1 },
]

/**
 * 互動控制項的外框。品牌色 cream-200 對白底只有 1.1:1，色弱使用者看不出邊界。
 * foreground 是 rgb(43,43,43) 而非純黑，45% 疊白只有 2.6:1 —— 量過後改用 55%
 * （疊白約 #8A8A8A，對白底 3.4:1，達 WCAG 1.4.11 非文字對比 3:1）。
 * 分隔線類（非控制項）用較淡的 /40，停用態刻意更淡以表達不可點。
 */
const CONTROL_BORDER = 'border border-foreground/55'

interface Props {
  posts: Record<string, unknown>[]
  categories: BlogCategoryView[]
  featuredPost: Record<string, unknown> | null
  settings: BlogPageSettingsView
  activeCategory: string
  currentPage: number
  totalPages: number
  totalPosts: number
}

/** 從 post.category 取分類「值」（字串值 or relationship 物件的 value/slug） */
function categoryValue(p: Record<string, unknown>): string {
  const cat = p.category
  if (typeof cat === 'string') return cat
  if (cat && typeof cat === 'object') {
    const o = cat as Record<string, unknown>
    return String(o.value ?? o.slug ?? '')
  }
  return ''
}

function imageUrlOf(p: Record<string, unknown>): string | null {
  const img = p.featuredImage as { url?: string } | null | undefined
  return img?.url || null
}

/**
 * timeZone 必須寫死：prod 的 Node 進程跑 Etc/UTC、台灣瀏覽器是 UTC+8，
 * 不指定的話 publishedAt 在 16:00 UTC 之後的文章 server 與 client 會算出差一天的
 * 日期，造成 hydration mismatch（React 19 會整段改走 client render）。
 */
function formatDate(d: unknown): string {
  if (!d || typeof d !== 'string') return ''
  try {
    return new Date(d).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Taipei',
    })
  } catch {
    return d
  }
}

function hrefFor(category: string, page = 1): string {
  const qs = new URLSearchParams()
  if (category !== 'all') qs.set('c', category)
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `/blog?${s}` : '/blog'
}

export function BlogListClient({
  posts,
  categories,
  featuredPost,
  settings,
  activeCategory,
  currentPage,
  totalPages,
  totalPosts,
}: Props) {
  const [expandedNav, setExpandedNav] = useState(false)
  const { categoryNav, layout, hero, newsletter } = settings

  /**
   * 下拉版分類選單用原生 <details>。Next 的 soft navigation 在同一個 segment
   * 只換 search params 時不會 remount 這個元件，open 狀態會殘留，選完分類後面板
   * 繼續蓋住列表；原生 <details> 也不會因為點外面或按 Esc 就關。三種情況都要手動收。
   */
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false
  }, [activeCategory, currentPage])

  useEffect(() => {
    if (categoryNav.style !== 'dropdown') return
    function close(e: Event) {
      const el = detailsRef.current
      if (!el || !el.open) return
      if (e.type === 'keydown') {
        if ((e as KeyboardEvent).key !== 'Escape') return
        el.open = false
        el.querySelector('summary')?.focus()
        return
      }
      if (!el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [categoryNav.style])

  const sourceCats = categories.length > 0 ? categories : FALLBACK_CATEGORIES
  const labelByValue = useMemo(
    () => Object.fromEntries(sourceCats.map((c) => [c.value, c.label])),
    [sourceCats],
  )

  /** 依後台設定過濾（藏空分類）＋排序；目前選取的分類一定保留 */
  const navItems = useMemo(() => {
    const kept = sourceCats.filter(
      (c) => c.value === activeCategory || !categoryNav.hideEmpty || c.count !== 0,
    )
    const sorted = [...kept]
    if (categoryNav.sortBy === 'count') {
      sorted.sort((a, b) => b.count - a.count || a.order - b.order)
    } else if (categoryNav.sortBy === 'name') {
      sorted.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'))
    } else {
      sorted.sort((a, b) => a.order - b.order)
    }
    return [{ value: 'all', label: '全部', order: -1, count: totalPosts }, ...sorted]
  }, [sourceCats, activeCategory, categoryNav.hideEmpty, categoryNav.sortBy, totalPosts])

  /**
   * 超過上限的分類收進「更多」。「全部」永遠留在最前面（否則低上限時會沒有
   * 回到全部的入口），目前選取的分類也一定留在可見區。
   */
  const { visibleItems, hiddenItems } = useMemo(() => {
    const max = categoryNav.maxVisible
    const [allItem, ...rest] = navItems
    // 只多出一個時就整排展開，避免出現「更多分類 +1」這種沒意義的收摺
    if (!allItem || !max || rest.length <= max + 1) {
      return { visibleItems: navItems, hiddenItems: [] as BlogCategoryView[] }
    }
    const head = rest.slice(0, max)
    const tail = rest.slice(max)
    const activeInTail = tail.find((c) => c.value === activeCategory)
    if (activeInTail) {
      const demoted = head[max - 1]!
      return {
        visibleItems: [allItem, ...head.slice(0, max - 1), activeInTail],
        hiddenItems: [demoted, ...tail.filter((c) => c.value !== activeCategory)],
      }
    }
    return { visibleItems: [allItem, ...head], hiddenItems: tail }
  }, [navItems, categoryNav.maxVisible, activeCategory])

  const activeLabel = activeCategory === 'all' ? '全部' : labelByValue[activeCategory] || activeCategory

  const showsCount = (c: BlogCategoryView) => categoryNav.showCount && c.count >= 0

  /** 篇數是裸數字，螢幕閱讀器會唸成「時尚趨勢30」；補完整語意並把數字設為裝飾 */
  function categoryAriaLabel(c: BlogCategoryView): string | undefined {
    return showsCount(c) ? `${c.label}，${c.count} 篇文章` : undefined
  }

  function categoryLabelOf(p: Record<string, unknown>): string {
    const v = categoryValue(p)
    return labelByValue[v] || v || '穿搭誌'
  }

  // Editor's Pick 只在第一頁的第一篇；其餘進一般列表
  const showEditorsPick = layout.showEditorsPick && currentPage === 1 && posts.length > 0
  const editorsPick = showEditorsPick ? posts[0]! : null
  const gridPosts = showEditorsPick ? posts.slice(1) : posts

  const pinnedImage = featuredPost
    ? (featuredPost.featuredImage as { url?: string; alt?: string } | null)
    : null

  const gridColsClass =
    layout.columns === '2'
      ? 'sm:grid-cols-2'
      : layout.columns === '4'
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <main className="bg-cream-50 min-h-screen">
      {hero.enabled && (
        <section className="relative bg-gradient-to-br from-cream-100 via-cream-50 to-gold-50/40 border-b border-cream-200 overflow-hidden">
          {/* Decorative orbs — 圓形鈕扣意象 */}
          <div className="absolute top-12 left-8 w-32 h-32 rounded-full bg-gold-200/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-8 right-12 w-40 h-40 rounded-full bg-blush-200/30 blur-3xl pointer-events-none" />

          <div className="container relative py-14 md:py-20">
            <div className="max-w-3xl mx-auto text-center">
              {Boolean(hero.overline) && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur border border-gold-600/50 text-[10px] tracking-[0.3em] text-gold-700 uppercase mb-5">
                  <BookOpen size={12} />
                  <span>{hero.overline}</span>
                </div>
              )}
              <h1 className="text-3xl md:text-5xl font-serif leading-tight mb-5">
                {hero.title} <span className="text-gold-700">{hero.titleAccent}</span>
              </h1>
              {Boolean(hero.description) && (
                <p className="text-base md:text-lg text-foreground/70 leading-relaxed max-w-2xl mx-auto mb-7">
                  {hero.description}
                </p>
              )}
              {hero.showActions && (
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                  <a
                    href="https://www.instagram.com/kimlafayette/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-cream-50 hover:bg-foreground/90 transition-colors"
                  >
                    <Instagram size={12} />
                    追蹤金老佛爺 IG
                  </a>
                  <Link
                    href="/collections/jin-style"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gold-600/70 text-gold-700 hover:bg-gold-50 transition-colors"
                  >
                    <Sparkles size={12} />
                    金金同款專區
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="container py-10 md:py-14">
        {/* 釘選文章（後台 featured=true）— 只在「全部」第一頁出現 */}
        {featuredPost && (
          <Link
            href={`/blog/${featuredPost.slug as string}`}
            className="group block relative w-full mb-8 md:mb-12 rounded-2xl overflow-hidden border border-cream-200 bg-white shadow-md hover:shadow-2xl transition-all duration-500"
          >
            <div className="grid md:grid-cols-[5fr_4fr]">
              <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[320px] bg-cream-100 overflow-hidden">
                {pinnedImage?.url ? (
                  <Image
                    src={pinnedImage.url}
                    alt={pinnedImage.alt || (featuredPost.title as string)}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 60vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    {featuredPost.title as string}
                  </div>
                )}
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-gold-700 text-white text-[10px] tracking-[0.25em] uppercase shadow-md">
                  ★ Featured
                </div>
              </div>

              <div className="p-6 md:p-8 lg:p-10 flex flex-col justify-center">
                <p className="text-[10px] tracking-[0.3em] uppercase text-gold-700 mb-3">
                  {categoryLabelOf(featuredPost)}
                </p>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif leading-tight mb-3 group-hover:text-gold-700 transition-colors">
                  {featuredPost.title as string}
                </h2>
                {Boolean(featuredPost.excerpt) && (
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-3 mb-5">
                    {featuredPost.excerpt as string}
                  </p>
                )}
                <span className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-foreground group-hover:text-gold-700 transition-colors">
                  Read story <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* ── 分類導覽（排列方式由後台 blog-page-settings 控制）── */}
        {categoryNav.style !== 'hidden' && navItems.length > 1 && (
          <nav aria-label="文章分類" className="mb-8 md:mb-10">
            {categoryNav.style === 'dropdown' ? (
              <details ref={detailsRef} className="relative inline-block group">
                <summary
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full bg-white ${CONTROL_BORDER} text-sm cursor-pointer list-none select-none hover:border-foreground transition-colors [&::-webkit-details-marker]:hidden`}
                >
                  <span className="text-foreground/70">分類</span>
                  <span className="font-medium">{activeLabel}</span>
                  <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                </summary>
                <ul
                  className={`absolute z-20 mt-2 min-w-[15rem] max-h-80 overflow-y-auto rounded-2xl bg-white ${CONTROL_BORDER} shadow-xl py-2`}
                >
                  {navItems.map((cat) => (
                    <li key={cat.value}>
                      <Link
                        href={hrefFor(cat.value)}
                        aria-current={activeCategory === cat.value ? 'page' : undefined}
                        aria-label={categoryAriaLabel(cat)}
                        className={`flex items-center justify-between gap-4 px-5 py-2 text-sm hover:bg-cream-100 transition-colors ${
                          activeCategory === cat.value ? 'font-medium text-gold-700' : 'text-foreground/80'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {showsCount(cat) && (
                          <span aria-hidden="true" className="text-xs text-foreground/70 tabular-nums">
                            {cat.count}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : categoryNav.style === 'underline' ? (
              <div className="flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-foreground/40 pb-3">
                {[...visibleItems, ...(expandedNav ? hiddenItems : [])].map((cat) => (
                  <Link
                    key={cat.value}
                    href={hrefFor(cat.value)}
                    aria-current={activeCategory === cat.value ? 'page' : undefined}
                    aria-label={categoryAriaLabel(cat)}
                    className={`relative text-sm pb-3 -mb-3 transition-colors ${
                      activeCategory === cat.value
                        ? 'text-foreground font-medium after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[3px] after:bg-foreground'
                        : 'text-foreground/70 hover:text-gold-700'
                    }`}
                  >
                    {cat.label}
                    {showsCount(cat) && (
                      <span
                        aria-hidden="true"
                        className="ml-1 text-[10px] text-foreground/70 tabular-nums align-super"
                      >
                        {cat.count}
                      </span>
                    )}
                  </Link>
                ))}
                {hiddenItems.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={expandedNav}
                    onClick={() => setExpandedNav((v) => !v)}
                    className="text-sm text-gold-700 hover:underline"
                  >
                    {expandedNav ? '收合分類' : `更多 +${hiddenItems.length}`}
                  </button>
                )}
              </div>
            ) : (
              <div
                className={
                  categoryNav.style === 'pills-scroll'
                    ? 'flex items-center gap-2 overflow-x-auto scrollbar-hide'
                    : 'flex flex-wrap items-center gap-2'
                }
              >
                {[...visibleItems, ...(expandedNav ? hiddenItems : [])].map((cat) => (
                  <Link
                    key={cat.value}
                    href={hrefFor(cat.value)}
                    aria-current={activeCategory === cat.value ? 'page' : undefined}
                    aria-label={categoryAriaLabel(cat)}
                    className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                      activeCategory === cat.value
                        ? 'bg-foreground text-cream-50 shadow-md border border-foreground'
                        : `bg-white ${CONTROL_BORDER} text-foreground/80 hover:border-foreground hover:text-gold-700`
                    }`}
                  >
                    {cat.label}
                    {showsCount(cat) && (
                      <span
                        aria-hidden="true"
                        className={`ml-1.5 text-[11px] tabular-nums ${
                          activeCategory === cat.value ? 'text-cream-50/80' : 'text-foreground/70'
                        }`}
                      >
                        {cat.count}
                      </span>
                    )}
                  </Link>
                ))}
                {hiddenItems.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={expandedNav}
                    onClick={() => setExpandedNav((v) => !v)}
                    className={`px-5 py-2 rounded-full text-sm whitespace-nowrap bg-white ${CONTROL_BORDER} text-foreground/80 hover:border-foreground hover:text-gold-700 transition-all inline-flex items-center gap-1`}
                  >
                    {expandedNav ? '收合分類' : `更多分類 +${hiddenItems.length}`}
                    <ChevronDown
                      size={13}
                      className={expandedNav ? 'rotate-180 transition-transform' : 'transition-transform'}
                    />
                  </button>
                )}
              </div>
            )}
          </nav>
        )}

        {posts.length === 0 && (
          <div className={`text-center py-16 bg-white rounded-2xl ${CONTROL_BORDER}`}>
            <BookOpen size={36} className="mx-auto text-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {activeCategory === 'all' ? '目前還沒有文章' : '此分類目前沒有文章'}
            </p>
            {activeCategory !== 'all' && (
              <Link href="/blog" className="inline-block mt-4 text-sm text-gold-700 hover:underline">
                看全部文章
              </Link>
            )}
          </div>
        )}

        {/* ── Editor's Pick — 當頁第一篇放大 ── */}
        {editorsPick && (
          <Link
            href={`/blog/${editorsPick.slug as string}`}
            className="group block mb-12 bg-white rounded-3xl overflow-hidden border border-cream-200 hover:shadow-xl transition-all duration-300"
          >
            <div className="grid md:grid-cols-2 gap-0">
              <div className="aspect-[4/3] md:aspect-auto relative bg-gradient-to-br from-cream-100 via-blush-100/50 to-gold-100/40 overflow-hidden">
                {imageUrlOf(editorsPick) ? (
                  <Image
                    src={imageUrlOf(editorsPick)!}
                    alt={editorsPick.title as string}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gold-700/40">
                      <BookOpen size={56} className="mx-auto mb-2" />
                      <p className="text-xs tracking-widest">FEATURED</p>
                    </div>
                  </div>
                )}
                <span className="absolute top-5 left-5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-foreground/85 backdrop-blur text-cream-50 text-[10px] tracking-[0.2em]">
                  <Sparkles size={10} />
                  EDITOR&apos;S PICK
                </span>
              </div>
              <div className="p-6 md:p-10 lg:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] tracking-widest text-gold-700 uppercase">
                    {categoryLabelOf(editorsPick)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar size={10} />
                    {formatDate(editorsPick.publishedAt)}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-serif leading-tight mb-4 group-hover:text-gold-700 transition-colors">
                  {editorsPick.title as string}
                </h2>
                {layout.showExcerpt && (
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-3 mb-6">
                    {(editorsPick.excerpt as string) || ''}
                  </p>
                )}
                <span className="inline-flex items-center gap-2 text-sm text-gold-700 font-medium group-hover:gap-3 transition-all">
                  閱讀全文 <ArrowRight size={16} />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* ── 文章列表（版型由後台切換）── */}
        {gridPosts.length > 0 && layout.style === 'minimal' && (
          <ul className="divide-y divide-foreground/40 border-y border-foreground/40">
            {gridPosts.map((post) => (
              <li key={post.id as unknown as string}>
                <Link
                  href={`/blog/${post.slug as string}`}
                  className="group flex items-center gap-4 md:gap-6 py-4 md:py-5"
                >
                  <div className="relative w-20 h-16 md:w-28 md:h-20 shrink-0 rounded-lg overflow-hidden bg-cream-100">
                    {imageUrlOf(post) ? (
                      <Image
                        src={imageUrlOf(post)!}
                        alt={post.title as string}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="112px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gold-700/40">
                        <BookOpen size={20} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[10px] tracking-widest text-gold-700 uppercase">
                        {categoryLabelOf(post)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar size={10} />
                        {formatDate(post.publishedAt)}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-base font-medium leading-relaxed line-clamp-2 group-hover:text-gold-700 transition-colors">
                      {post.title as string}
                    </h3>
                    {layout.showExcerpt && Boolean(post.excerpt) && (
                      <p className="hidden md:block text-xs text-muted-foreground line-clamp-1 mt-1">
                        {post.excerpt as string}
                      </p>
                    )}
                  </div>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-foreground/40 group-hover:text-gold-700 group-hover:translate-x-1 transition-all"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {gridPosts.length > 0 && layout.style === 'editorial' && (
          <div className="flex flex-col gap-6 md:gap-8">
            {gridPosts.map((post) => (
              <Link
                key={post.id as unknown as string}
                href={`/blog/${post.slug as string}`}
                className="group grid md:grid-cols-[2fr_3fr] gap-0 bg-white rounded-2xl overflow-hidden border border-cream-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[220px] bg-cream-100 overflow-hidden">
                  {imageUrlOf(post) ? (
                    <Image
                      src={imageUrlOf(post)!}
                      alt={post.title as string}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 40vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gold-700/40">
                      <BookOpen size={32} />
                    </div>
                  )}
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] tracking-widest text-gold-700 uppercase">
                      {categoryLabelOf(post)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar size={10} />
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>
                  <h3 className="text-lg md:text-2xl font-serif leading-snug mb-3 line-clamp-2 group-hover:text-gold-700 transition-colors">
                    {post.title as string}
                  </h3>
                  {layout.showExcerpt && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                      {(post.excerpt as string) || ''}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs text-gold-700 group-hover:gap-2.5 transition-all">
                    閱讀全文 <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {gridPosts.length > 0 && layout.style === 'masonry' && (
          <div
            className={`columns-1 gap-6 [&>a]:mb-6 ${
              layout.columns === '2'
                ? 'sm:columns-2'
                : layout.columns === '4'
                  ? 'sm:columns-2 lg:columns-4'
                  : 'sm:columns-2 lg:columns-3'
            }`}
          >
            {gridPosts.map((post, i) => {
              // 圖片高度刻意不齊 → 瀑布流的視覺節奏（依索引循環，SSR/CSR 一致）
              const ratio = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'][i % 3]!
              return (
                <Link
                  key={post.id as unknown as string}
                  href={`/blog/${post.slug as string}`}
                  className="group block break-inside-avoid bg-white rounded-2xl overflow-hidden border border-cream-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className={`relative ${ratio} bg-cream-100 overflow-hidden`}>
                    {imageUrlOf(post) ? (
                      <Image
                        src={imageUrlOf(post)!}
                        alt={post.title as string}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gold-700/40">
                        <BookOpen size={32} />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] tracking-widest text-gold-700 uppercase">
                        {categoryLabelOf(post)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar size={10} />
                        {formatDate(post.publishedAt)}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium leading-relaxed line-clamp-2 group-hover:text-gold-700 transition-colors">
                      {post.title as string}
                    </h3>
                    {layout.showExcerpt && Boolean(post.excerpt) && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-2">
                        {post.excerpt as string}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {gridPosts.length > 0 && layout.style === 'magazine' && (
          <div className={`grid grid-cols-1 ${gridColsClass} gap-6`}>
            {gridPosts.map((post) => (
              <Link
                key={post.id as unknown as string}
                href={`/blog/${post.slug as string}`}
                className="group bg-white rounded-2xl overflow-hidden border border-cream-200 hover:shadow-lg hover:border-gold-600/40 transition-all duration-300 flex flex-col"
              >
                <div className="aspect-[16/10] bg-gradient-to-br from-cream-100 to-cream-200 relative overflow-hidden">
                  {imageUrlOf(post) ? (
                    <Image
                      src={imageUrlOf(post)!}
                      alt={post.title as string}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gold-700/40">
                      <BookOpen size={32} />
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] tracking-widest text-gold-700 uppercase">
                      {categoryLabelOf(post)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar size={10} />
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium mb-2 group-hover:text-gold-700 transition-colors line-clamp-2 leading-relaxed">
                    {post.title as string}
                  </h3>
                  {layout.showExcerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                      {(post.excerpt as string) || ''}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-gold-700 mt-auto group-hover:underline">
                    閱讀更多 <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── 分頁 ── */}
        {totalPages > 1 && (
          <nav
            aria-label="文章分頁"
            className="mt-12 flex flex-wrap items-center justify-center gap-2"
          >
            <PageLink
              href={hrefFor(activeCategory, currentPage - 1)}
              disabled={currentPage <= 1}
              label="上一頁"
            >
              <ChevronLeft size={16} />
            </PageLink>
            {pageWindow(currentPage, totalPages).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="px-2 text-foreground/40">
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={hrefFor(activeCategory, p)}
                  aria-current={p === currentPage ? 'page' : undefined}
                  className={`min-w-10 h-10 px-3 inline-flex items-center justify-center rounded-full text-sm tabular-nums transition-all ${
                    p === currentPage
                      ? 'bg-foreground text-cream-50 border border-foreground'
                      : `bg-white ${CONTROL_BORDER} text-foreground/80 hover:border-foreground hover:text-gold-700`
                  }`}
                >
                  {p}
                </Link>
              ),
            )}
            <PageLink
              href={hrefFor(activeCategory, currentPage + 1)}
              disabled={currentPage >= totalPages}
              label="下一頁"
            >
              <ChevronRight size={16} />
            </PageLink>
          </nav>
        )}

        {newsletter.enabled && (
          <section className="mt-16 md:mt-24 rounded-3xl bg-gradient-to-br from-foreground via-foreground to-[#3a3530] text-cream-50 px-6 py-12 md:px-12 md:py-16 text-center overflow-hidden relative">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-blush-200/10 blur-3xl pointer-events-none" />
            <div className="relative">
              {Boolean(newsletter.overline) && (
                <p className="text-[10px] tracking-[0.4em] text-gold-300 uppercase mb-3">
                  {newsletter.overline}
                </p>
              )}
              <h2 className="text-2xl md:text-3xl font-serif mb-4">{newsletter.title}</h2>
              {Boolean(newsletter.description) && (
                <p className="text-sm text-cream-200/80 max-w-md mx-auto mb-7">
                  {newsletter.description}
                </p>
              )}
              <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 px-5 py-3 rounded-full bg-white/10 border border-white/40 text-sm text-cream-50 placeholder:text-cream-300/60 focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                />
                <button
                  type="button"
                  className="px-8 py-3 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-400 transition-colors"
                >
                  訂閱
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: ReactNode
}) {
  const base = 'w-10 h-10 inline-flex items-center justify-center rounded-full transition-all'
  if (disabled) {
    return (
      <span
        aria-hidden="true"
        className={`${base} border border-foreground/20 text-foreground/25 cursor-not-allowed`}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${base} bg-white ${CONTROL_BORDER} text-foreground/80 hover:border-foreground hover:text-gold-700`}
    >
      {children}
    </Link>
  )
}

/** 分頁號碼視窗：首頁、末頁與當前頁前後各一，其餘以 … 省略 */
function pageWindow(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: Array<number | null> = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(null)
    out.push(p)
    prev = p
  }
  return out
}
