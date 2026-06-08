'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Calendar, BookOpen, Instagram, Sparkles } from 'lucide-react'

// 後備分類（DB blog-categories 為空時用）。value 對應 BlogPosts.category 的 select 值。
const FALLBACK_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'styling', label: '穿搭教學' },
  { value: 'trends', label: '時尚趨勢' },
  { value: 'new-arrivals', label: '新品介紹' },
  { value: 'brand-story', label: '品牌故事' },
  { value: 'promotions', label: '優惠活動' },
]

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

// Demo posts when DB has no data
const DEMO_POSTS = [
  {
    id: '1', slug: 'autumn-style-guide', title: '秋冬穿搭指南：5 個打造日常優雅的秘訣',
    excerpt: '從基本款單品開始，學會混搭出高級感的秋冬造型，讓你每天都像走在時裝週。',
    category: 'styling', publishedAt: '2024-12-01', featuredImage: null,
  },
  {
    id: '2', slug: 'knit-collection-review', title: '本季必入手：韓系針織系列全開箱',
    excerpt: '從慵懶 oversize 到合身剪裁，每一款都讓你愛不釋手。',
    category: 'new-arrivals', publishedAt: '2024-11-25', featuredImage: null,
  },
  {
    id: '3', slug: 'size-inclusive-fashion', title: '包容性尺碼的時尚革命：美麗沒有標準答案',
    excerpt: 'CHIC KIM & MIU 相信每位女性都值得穿上讓自己自信的衣服。',
    category: 'brand-story', publishedAt: '2024-11-20', featuredImage: null,
  },
  {
    id: '4', slug: 'office-to-date-look', title: '辦公室到約會：一套衣服兩種風格',
    excerpt: '教你如何用最少的單品，從白天的幹練切換到晚上的甜美。',
    category: 'styling', publishedAt: '2024-11-15', featuredImage: null,
  },
  {
    id: '5', slug: 'winter-trends-2024', title: '2024 冬季時尚趨勢預覽',
    excerpt: '從巧克力棕到奶油白，今年冬季的色彩趨勢比你想像的更柔軟。',
    category: 'trends', publishedAt: '2024-11-10', featuredImage: null,
  },
  {
    id: '6', slug: 'morning-routine', title: '晨間穿搭儀式感：從選衣服開始的美好一天',
    excerpt: '養成每天花 5 分鐘搭配衣服的習慣，為自己注入一整天的好心情。',
    category: 'styling', publishedAt: '2024-11-05', featuredImage: null,
  },
]

interface Props {
  initialPosts: Record<string, unknown>[]
  categories?: Array<{ value: string; label: string }>
}

export function BlogListClient({ initialPosts, categories }: Props) {
  const posts = initialPosts.length > 0 ? initialPosts : DEMO_POSTS
  const cats = categories && categories.length > 0 ? categories : FALLBACK_CATEGORIES
  const labelByValue: Record<string, string> = Object.fromEntries(cats.map((c) => [c.value, c.label]))
  const [activeCategory, setActiveCategory] = useState('all')

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return posts
    return posts.filter((p) => categoryValue(p) === activeCategory)
  }, [posts, activeCategory])

  const [featured, ...rest] = filtered

  function getCategoryLabel(p: Record<string, unknown>): string {
    const v = categoryValue(p)
    return labelByValue[v] || v || '穿搭教學'
  }

  function getFeaturedImageUrl(p: Record<string, unknown>): string | null {
    const img = p.featuredImage as { url?: string } | null | undefined
    return img?.url || null
  }

  function formatDate(d: unknown): string {
    if (!d || typeof d !== 'string') return ''
    try {
      return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
    } catch {
      return d
    }
  }

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* ── KOL Hero — 金老佛爺主理人引言 ── */}
      <section className="relative bg-gradient-to-br from-cream-100 via-cream-50 to-gold-50/40 border-b border-cream-200 overflow-hidden">
        {/* Decorative orbs — 圓形鈕扣意象 */}
        <div className="absolute top-12 left-8 w-32 h-32 rounded-full bg-gold-200/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-8 right-12 w-40 h-40 rounded-full bg-blush-200/30 blur-3xl pointer-events-none" />

        <div className="container relative py-14 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur border border-gold-200/60 text-[10px] tracking-[0.3em] text-gold-600 uppercase mb-5">
              <BookOpen size={12} />
              <span>Style Journal · 穿搭誌</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-serif leading-tight mb-5">
              讓每一天 <span className="text-gold-600">都成為經典</span>
            </h1>
            <p className="text-base md:text-lg text-foreground/70 leading-relaxed max-w-2xl mx-auto mb-7">
              韓系穿搭靈感、時尚趨勢解讀、編輯部精選 — 由金老佛爺帶領，
              讓你從通勤到約會，從日常到重要時刻都有屬於自己的風格答案。
            </p>
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gold-300 text-gold-700 hover:bg-gold-50 transition-colors"
              >
                <Sparkles size={12} />
                金金同款專區
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container py-10 md:py-14">
        {/* Category tabs */}
        <div className="flex items-center gap-2 mb-10 overflow-x-auto scrollbar-hide">
          {[{ value: 'all', label: '全部' }, ...cats].map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                activeCategory === cat.value
                  ? 'bg-foreground text-cream-50 shadow-md'
                  : 'bg-white border border-cream-200 text-foreground/70 hover:border-gold-400 hover:text-gold-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-cream-200">
            <BookOpen size={36} className="mx-auto text-cream-300 mb-3" />
            <p className="text-muted-foreground">此分類目前沒有文章</p>
          </div>
        )}

        {/* ── Featured Post — 第一篇放大 ── */}
        {featured && (
          <Link
            href={`/blog/${featured.slug as string}`}
            className="group block mb-12 bg-white rounded-3xl overflow-hidden border border-cream-200 hover:shadow-xl transition-all duration-300"
          >
            <div className="grid md:grid-cols-2 gap-0">
              <div className="aspect-[4/3] md:aspect-auto relative bg-gradient-to-br from-cream-100 via-blush-100/50 to-gold-100/40 overflow-hidden">
                {getFeaturedImageUrl(featured) ? (
                  <Image
                    src={getFeaturedImageUrl(featured)!}
                    alt={featured.title as string}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gold-700/30">
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
                  <span className="text-[10px] tracking-widest text-gold-500 uppercase">
                    {getCategoryLabel(featured)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar size={10} />
                    {formatDate(featured.publishedAt)}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-serif leading-tight mb-4 group-hover:text-gold-700 transition-colors">
                  {featured.title as string}
                </h2>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-3 mb-6">
                  {(featured.excerpt as string) || ''}
                </p>
                <span className="inline-flex items-center gap-2 text-sm text-gold-600 font-medium group-hover:gap-3 transition-all">
                  閱讀全文 <ArrowRight size={16} />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* ── Posts grid ── */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post) => {
              const imageUrl = getFeaturedImageUrl(post)
              return (
                <Link
                  key={post.id as unknown as string}
                  href={`/blog/${post.slug as string}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-cream-200 hover:shadow-lg hover:border-gold-200 transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-[16/10] bg-gradient-to-br from-cream-100 to-cream-200 relative overflow-hidden">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={post.title as string}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gold-700/30">
                        <BookOpen size={32} />
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] tracking-widest text-gold-500 uppercase">
                        {getCategoryLabel(post)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar size={10} />
                        {formatDate(post.publishedAt)}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium mb-2 group-hover:text-gold-600 transition-colors line-clamp-2 leading-relaxed">
                      {post.title as string}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                      {(post.excerpt as string) || ''}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-gold-600 mt-auto group-hover:underline">
                      閱讀更多 <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── Newsletter CTA — Bottom hero ── */}
        <section className="mt-16 md:mt-24 rounded-3xl bg-gradient-to-br from-foreground via-foreground to-[#3a3530] text-cream-50 px-6 py-12 md:px-12 md:py-16 text-center overflow-hidden relative">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-blush-200/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] tracking-[0.4em] text-gold-400 uppercase mb-3">Stay in Style</p>
            <h2 className="text-2xl md:text-3xl font-serif mb-4">每週一封穿搭靈感信</h2>
            <p className="text-sm text-cream-200/80 max-w-md mx-auto mb-7">
              訂閱穿搭誌 newsletter — 第一時間收到新品上市、季節穿搭與會員專屬優惠
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-5 py-3 rounded-full bg-white/10 border border-white/20 text-sm text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:ring-2 focus:ring-gold-400/40"
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
      </div>
    </main>
  )
}
